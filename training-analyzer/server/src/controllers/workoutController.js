const { Op } = require('sequelize');
const multer = require('multer');
const { Workout } = require('../models');
const { parseWorkoutFile } = require('../services/workoutImporter');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function list(req, res, next) {
  try {
    const { type, from, to, limit = 50, offset = 0 } = req.query;
    const where = { userId: req.user.uid };

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

    res.json({ workouts: rows, total: count, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
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

    const workout = await Workout.create({
      userId: req.user.uid,
      type,
      date,
      score: data?.scores?.overall ?? null,
      data: data || {},
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
    const created = await Workout.bulkCreate(records);
    res.status(201).json({ imported: created.length });
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

module.exports = { list, getById, create, bulkCreate, update, destroy, destroyAll, importFile, upload };
