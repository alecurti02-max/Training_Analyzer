const { Program, ProgramAssignment } = require('../models');

// CRUD delle schede (programs) del coach. Tutte le route sotto requireTrainer;
// l'ownership è sempre `coachId = req.user.uid` nella WHERE (mai dal body).

// Bound rigidi su tutto il payload (mass-assignment safe). `partial=true` per
// gli update: i campi assenti non vengono toccati.
function pickProgramFields(body, { partial = false } = {}) {
  const out = {};

  if (typeof body.title === 'string' && body.title.trim()) out.title = body.title.trim().slice(0, 120);
  else if (!partial) out.title = null; // farà fallire il NOT NULL → 400 sotto

  if (body.goal === null || body.goal === '') out.goal = null;
  else if (typeof body.goal === 'string') out.goal = body.goal.slice(0, 200);

  if (body.notes === null || body.notes === '') out.notes = null;
  else if (typeof body.notes === 'string') out.notes = body.notes.slice(0, 2000);

  if (body.weeks !== undefined) {
    const w = Number(body.weeks);
    if (Number.isFinite(w)) out.weeks = Math.max(1, Math.min(52, Math.round(w)));
  }

  if (Array.isArray(body.days)) {
    const seen = new Set();
    out.days = body.days
      .filter((d) => d && typeof d === 'object' && !Array.isArray(d))
      .slice(0, 10)
      .map((d, i) => {
        let key = typeof d.key === 'string' && d.key.trim() ? d.key.trim().slice(0, 8) : String.fromCharCode(65 + i);
        while (seen.has(key)) key = `${key}_`.slice(0, 8);
        seen.add(key);
        return {
          key,
          label: typeof d.label === 'string' ? d.label.slice(0, 40) : '',
          type: typeof d.type === 'string' && d.type.trim() ? d.type.trim().slice(0, 40) : 'gym',
          muscleGroups: Array.isArray(d.muscleGroups)
            ? d.muscleGroups.filter((m) => typeof m === 'string').slice(0, 30).map((m) => m.slice(0, 40))
            : [],
          note: typeof d.note === 'string' ? d.note.slice(0, 500) : null,
          exercises: Array.isArray(d.exercises)
            ? d.exercises.filter((e) => e && typeof e === 'object' && !Array.isArray(e)).slice(0, 40)
            : [],
        };
      });
  }

  if (Array.isArray(body.progressions)) {
    out.progressions = body.progressions
      .filter((p) => p && typeof p === 'object' && Number.isFinite(Number(p.week)))
      .slice(0, 52)
      .map((p) => ({
        week: Math.max(1, Math.min(52, Math.round(Number(p.week)))),
        loadPct: Number.isFinite(Number(p.loadPct)) ? Math.max(10, Math.min(200, Number(p.loadPct))) : 100,
        deload: !!p.deload,
        note: typeof p.note === 'string' ? p.note.slice(0, 200) : null,
      }));
  }

  if (typeof body.status === 'string' && ['draft', 'active', 'archived'].includes(body.status)) {
    out.status = body.status;
  }

  return out;
}

async function list(req, res, next) {
  try {
    const rows = await Program.findAll({
      where: { coachId: req.user.uid },
      order: [['updatedAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const row = await Program.findOne({ where: { id: req.params.id, coachId: req.user.uid } });
    if (!row) return res.status(404).json({ error: { message: 'Scheda non trovata' } });
    res.json(row);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = pickProgramFields(req.body);
    if (!data.title) return res.status(400).json({ error: { message: 'title is required' } });
    const row = await Program.create({ ...data, coachId: req.user.uid });
    res.status(201).json(row);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const row = await Program.findOne({ where: { id: req.params.id, coachId: req.user.uid } });
    if (!row) return res.status(404).json({ error: { message: 'Scheda non trovata' } });
    await row.update(pickProgramFields(req.body, { partial: true }));
    res.json(row);
  } catch (err) { next(err); }
}

// DELETE bloccata se ci sono assegnazioni attive: il coach archivia invece.
async function destroy(req, res, next) {
  try {
    const row = await Program.findOne({ where: { id: req.params.id, coachId: req.user.uid } });
    if (!row) return res.status(404).json({ error: { message: 'Scheda non trovata' } });
    const activeCount = await ProgramAssignment.count({ where: { programId: row.id, status: 'active' } });
    if (activeCount > 0) {
      return res.status(409).json({
        error: { message: 'Scheda assegnata a clienti attivi: archiviala invece di eliminarla', code: 'has_active_assignments' },
      });
    }
    await row.destroy();
    res.status(204).end();
  } catch (err) { next(err); }
}

async function duplicate(req, res, next) {
  try {
    const row = await Program.findOne({ where: { id: req.params.id, coachId: req.user.uid } });
    if (!row) return res.status(404).json({ error: { message: 'Scheda non trovata' } });
    const copy = await Program.create({
      coachId: req.user.uid,
      title: `${row.title} (copia)`.slice(0, 120),
      goal: row.goal,
      notes: row.notes,
      weeks: row.weeks,
      days: row.days,
      progressions: row.progressions,
      status: 'draft',
    });
    res.status(201).json(copy);
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, destroy, duplicate, pickProgramFields };
