const { Op, fn, col } = require('sequelize');
const { User, Workout, CoachClient, PlannedWorkout } = require('../models');
const { queryWorkouts } = require('./workoutController');
const { computeStats } = require('./userController');
const { makeDateUpsertController } = require('../utils/crud');
const { pickFields: pickPlannedFields } = require('./plannedWorkoutController');

// Whitelist degli attributi User esposti al coach sui PROPRI clienti (l'email
// serve: è il contatto che il PT ha in mano). Mai spread di toPublicJSON qui.
const CLIENT_ATTRS = ['uid', 'displayName', 'photoURL', 'email'];

// L'AI analysis del cliente non è visibile al coach (vincolo di privacy del
// piano CRM): strip esplicito su ogni lettura workout lato coach.
const AI_FIELDS = ['aiAnalysis', 'aiAnalysisGeneratedAt', 'aiAnalysisModel', 'aiAnalysisVersion'];
function stripAi(workout) {
  const plain = typeof workout.get === 'function' ? workout.get({ plain: true }) : { ...workout };
  for (const f of AI_FIELDS) delete plain[f];
  return plain;
}

function pickRel(rel) {
  return {
    id: rel.id,
    status: rel.status,
    invitedAt: rel.invitedAt,
    acceptedAt: rel.acceptedAt,
    sharing: rel.sharing,
  };
}

// Statistiche per il roster: 3 query raggruppate su tutti i clientIds (niente
// N+1). Le soglie 7/30 giorni sono stringhe DATEONLY calcolate in JS, portabili
// tra Postgres e SQLite (test).
async function rosterStats(clientIds) {
  const cutoff = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  const grouped = (where, aggr) =>
    Workout.findAll({
      where: { userId: { [Op.in]: clientIds }, ...where },
      attributes: ['userId', [aggr, 'v']],
      group: ['userId'],
      raw: true,
    });

  const [last, w7, w30] = await Promise.all([
    grouped({}, fn('MAX', col('date'))),
    grouped({ date: { [Op.gte]: cutoff(7) } }, fn('COUNT', col('id'))),
    grouped({ date: { [Op.gte]: cutoff(30) } }, fn('COUNT', col('id'))),
  ]);

  const out = {};
  for (const id of clientIds) out[id] = { lastWorkoutDate: null, workouts7d: 0, workouts30d: 0 };
  last.forEach((r) => { out[r.userId].lastWorkoutDate = r.v; });
  w7.forEach((r) => { out[r.userId].workouts7d = Number(r.v); });
  w30.forEach((r) => { out[r.userId].workouts30d = Number(r.v); });
  return out;
}

// GET /api/coach/clients?includeStats=1 — roster (pending + active)
async function listClients(req, res, next) {
  try {
    const rels = await CoachClient.findAll({
      where: { coachId: req.user.uid, status: { [Op.in]: ['pending', 'active'] } },
      include: [{ model: User, as: 'client', attributes: CLIENT_ATTRS }],
      order: [['createdAt', 'DESC']],
    });

    let statsByUid = {};
    if (req.query.includeStats === '1') {
      const activeIds = rels.filter((r) => r.status === 'active').map((r) => r.clientId);
      if (activeIds.length) statsByUid = await rosterStats(activeIds);
    }

    res.json(rels.map((r) => ({
      relationship: pickRel(r),
      user: r.client,
      ...(statsByUid[r.clientId] || {}),
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/coach/clients/invites { email } — invito per email esatta.
// Una riga (coachId, clientId) è UNIQUE: il re-invito dopo ended/declined la
// riusa resettandola a pending.
async function invite(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: { message: 'email is required' } });

    const target = await User.findOne({ where: { email }, attributes: CLIENT_ATTRS });
    if (!target) {
      return res.status(404).json({ error: { message: 'Utente non registrato', code: 'user_not_found' } });
    }
    if (target.uid === req.user.uid) {
      return res.status(400).json({ error: { message: 'Non puoi invitare te stesso', code: 'self_invite' } });
    }

    const existing = await CoachClient.findOne({
      where: { coachId: req.user.uid, clientId: target.uid },
    });
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'active') {
        return res.status(409).json({
          error: {
            message: existing.status === 'active' ? 'Cliente già collegato' : 'Invito già inviato',
            code: `already_${existing.status}`,
          },
        });
      }
      await existing.update({
        status: 'pending',
        invitedBy: 'coach',
        invitedAt: new Date(),
        acceptedAt: null,
        endedAt: null,
        endedBy: null,
      });
      return res.status(201).json({ relationship: pickRel(existing), user: target });
    }

    const rel = await CoachClient.create({
      coachId: req.user.uid,
      clientId: target.uid,
      status: 'pending',
      invitedBy: 'coach',
      invitedAt: new Date(),
    });
    res.status(201).json({ relationship: pickRel(rel), user: target });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/coach/clients/:relationshipId — termina (da active) o revoca
// l'invito (da pending). La riga resta per il re-invito futuro.
async function removeClient(req, res, next) {
  try {
    const rel = await CoachClient.findOne({
      where: {
        id: req.params.relationshipId,
        coachId: req.user.uid,
        status: { [Op.in]: ['pending', 'active'] },
      },
    });
    if (!rel) return res.status(404).json({ error: { message: 'Relazione non trovata' } });

    await rel.update({ status: 'ended', endedBy: 'coach', endedAt: new Date() });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Le route sotto richiedono loadCoachClient (req.clientId = cliente verificato).

async function clientWorkouts(req, res, next) {
  try {
    const result = await queryWorkouts(req.clientId, req.query);
    res.json({ ...result, workouts: result.workouts.map(stripAi) });
  } catch (err) {
    next(err);
  }
}

async function clientWorkoutById(req, res, next) {
  try {
    const workout = await Workout.findOne({
      where: { id: req.params.id, userId: req.clientId },
    });
    if (!workout) return res.status(404).json({ error: { message: 'Workout not found' } });
    res.json(stripAi(workout));
  } catch (err) {
    next(err);
  }
}

async function clientStats(req, res, next) {
  try {
    res.json(await computeStats(req.clientId));
  } catch (err) {
    next(err);
  }
}

// Pianificazione sul calendario del cliente: stesso date-upsert del planner
// personale, ma owner = cliente e firma createdByCoachId sulle righe NUOVE.
// Il coach può modificare/eliminare via /:id SOLO le righe firmate da lui
// (mutationWhere); se il cliente ha già un planned su quella data, l'upsert ne
// aggiorna il contenuto (200 invece di 201) ma la riga resta del cliente — la
// proprietà non viene mai riassegnata da un upsert.
const coachPlanned = makeDateUpsertController({
  Model: PlannedWorkout,
  pickFields: pickPlannedFields,
  entityName: 'Planned workout',
  requireAtLeastOneField: false,
  ownerId: (req) => req.clientId,
  stampFields: (req) => ({ createdByCoachId: req.user.uid }),
  mutationWhere: (req) => ({ createdByCoachId: req.user.uid }),
});

module.exports = {
  listClients,
  invite,
  removeClient,
  clientWorkouts,
  clientWorkoutById,
  clientStats,
  coachPlanned,
};
