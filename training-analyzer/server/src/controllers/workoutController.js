const { Op } = require('sequelize');
const multer = require('multer');
const { Workout, Program, ProgramAssignment } = require('../models');
const { parseWorkoutFile } = require('../services/workoutImporter');
const { validateWorkoutData } = require('../validation/workoutData');
const { weekOf } = require('../services/assignmentMath');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CRM F2 — "lift" del riferimento scheda: il client mette {assignmentId, dayKey}
// in data._assignment; qui lo si valida (anti-forgery: l'assignment deve essere
// DEL cliente autenticato) e lo si materializza nelle colonne assignment*.
// La settimana è calcolata server-side da startDate+data del workout (non ci si
// fida del client). Meta non valida → scartata in silenzio, il workout si salva.
// NB: lo status dell'assignment NON è verificato di proposito — una live avviata
// con la scheda attiva deve potersi salvare anche se nel frattempo il coach l'ha
// chiusa (l'aderenza guarda comunque solo l'assignment attivo).
async function liftAssignmentMeta(meta, userId, date) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const id = meta.assignmentId;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return {};
  const assignment = await ProgramAssignment.findByPk(id, {
    include: [{ model: Program, as: 'program', attributes: ['weeks'] }],
  });
  if (!assignment || assignment.clientId !== userId) return {};
  return {
    assignmentId: assignment.id,
    assignmentDayKey: typeof meta.dayKey === 'string' && meta.dayKey ? meta.dayKey.slice(0, 8) : null,
    assignmentWeek: weekOf(assignment.startDate, date, assignment.program?.weeks || 1),
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Query condivisa tra la lista dell'utente e la vista coach sul cliente
// (routes/coach.js): stesso filtraggio/paginazione, cambia solo lo userId.
async function queryWorkouts(userId, query) {
  const { type, from, to, limit = 50, offset = 0 } = query;
  const where = { userId };

  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) where.date[Op.gte] = from;
    if (to) where.date[Op.lte] = to;
  }

  const { count, rows } = await Workout.findAndCountAll({
    where,
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    limit: Math.min(parseInt(limit, 10) || 50, 5000),
    offset: parseInt(offset, 10) || 0,
  });

  return { workouts: rows, total: count, limit: parseInt(limit, 10), offset: parseInt(offset, 10) };
}

async function list(req, res, next) {
  try {
    res.json(await queryWorkouts(req.user.uid, req.query));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const workout = await Workout.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!workout) return res.status(404).json({ error: { message: 'Workout not found' } });
    res.json(workout);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { type, date, data } = req.body;
    if (!type || !date) {
      return res.status(400).json({ error: { message: 'type and date are required' } });
    }

    const valid = validateWorkoutData(type, data || {});
    if (!valid.ok) {
      return res.status(400).json({ error: { message: 'Invalid workout data', issues: valid.issues } });
    }

    const assignmentFields = await liftAssignmentMeta(data?._assignment, req.user.uid, date);

    const workout = await Workout.create({
      userId: req.user.uid,
      type,
      date,
      score: data?.scores?.overall ?? null,
      data: data || {},
      ...assignmentFields,
    });

    res.status(201).json(workout);
  } catch (err) {
    next(err);
  }
}

async function bulkCreate(req, res, next) {
  try {
    const { workouts } = req.body;
    if (!Array.isArray(workouts) || !workouts.length) {
      return res.status(400).json({ error: { message: 'workouts array is required' } });
    }

    for (let i = 0; i < workouts.length; i += 1) {
      const w = workouts[i];
      if (!w || typeof w !== 'object') {
        return res.status(400).json({ error: { message: `workouts[${i}] must be an object` } });
      }
      const valid = validateWorkoutData(w.type, w.data || {});
      if (!valid.ok) {
        return res.status(400).json({ error: { message: `Invalid data in workouts[${i}]`, issues: valid.issues } });
      }
    }

    const records = workouts.map((w) => ({
      userId: req.user.uid,
      type: w.type,
      date: w.date,
      score: w.data?.scores?.overall ?? null,
      data: w.data || {},
    }));

    const created = await Workout.bulkCreate(records);
    res.status(201).json({ count: created.length });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const workout = await Workout.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!workout) return res.status(404).json({ error: { message: 'Workout not found' } });

    const { type, date, data } = req.body;
    const updates = {};
    if (type) updates.type = type;
    if (date) updates.date = date;
    if (data) {
      updates.data = { ...workout.data, ...data };
      const valid = validateWorkoutData(updates.type || workout.type, updates.data);
      if (!valid.ok) {
        return res.status(400).json({ error: { message: 'Invalid workout data', issues: valid.issues } });
      }
      updates.score = data.scores?.overall ?? workout.score;
    }

    await workout.update(updates);
    res.json(workout);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const workout = await Workout.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!workout) return res.status(404).json({ error: { message: 'Workout not found' } });

    await workout.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function importFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'No file uploaded' } });
    const { records } = parseWorkoutFile(req.file, req.user.uid);

    // Importers are lenient: keep the valid rows, skip + report the rest, rather
    // than failing the whole file on one malformed record.
    const toCreate = [];
    const skipped = [];
    records.forEach((r, i) => {
      if (!r.date) { skipped.push({ row: i, reason: 'missing date' }); return; }
      const valid = validateWorkoutData(r.type, r.data || {});
      if (!valid.ok) { skipped.push({ row: i, issues: valid.issues }); return; }
      toCreate.push(r);
    });

    const created = toCreate.length ? await Workout.bulkCreate(toCreate) : [];
    res.status(201).json({
      imported: created.length,
      skipped: skipped.length,
      ...(skipped.length ? { skippedDetails: skipped.slice(0, 20) } : {}),
    });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: { message: err.message } });
    next(err);
  }
}

async function destroyAll(req, res, next) {
  try {
    const count = await Workout.destroy({ where: { userId: req.user.uid } });
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, bulkCreate, update, destroy, destroyAll, importFile, upload, queryWorkouts };
