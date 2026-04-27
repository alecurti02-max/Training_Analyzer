const { Exercise } = require('../models');

async function list(req, res, next) {
  try {
    const exercises = await Exercise.findAll({
      where: { userId: req.user.uid },
      order: [['name', 'ASC']],
    });
    res.json(exercises);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, muscle, param, weightMode, barbellWeight, isUnilateral } = req.body;
    if (!name || !muscle) {
      return res.status(400).json({ error: { message: 'name and muscle are required' } });
    }

    const exercise = await Exercise.create({
      userId: req.user.uid,
      name: name.trim(),
      muscle,
      param: param || 'reps',
      weightMode: weightMode || 'total',
      barbellWeight: barbellWeight ?? null,
      isUnilateral: !!isUnilateral,
    });

    res.status(201).json(exercise);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: { message: 'Exercise already exists' } });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const exercise = await Exercise.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!exercise) return res.status(404).json({ error: { message: 'Exercise not found' } });

    const { name, muscle, param, weightMode, barbellWeight, isUnilateral } = req.body;
    if (name) exercise.name = name.trim();
    if (muscle) exercise.muscle = muscle;
    if (param) exercise.param = param;
    if (weightMode !== undefined) exercise.weightMode = weightMode;
    if (barbellWeight !== undefined) exercise.barbellWeight = barbellWeight;
    if (isUnilateral !== undefined) exercise.isUnilateral = !!isUnilateral;
    await exercise.save();

    res.json(exercise);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const exercise = await Exercise.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!exercise) return res.status(404).json({ error: { message: 'Exercise not found' } });

    await exercise.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Replace the user's whole exercise library with the array in req.body.
// The client manages the library as a single list and sends the full set
// on every add/edit/duplicate/delete, so we wipe and re-insert atomically.
async function bulkReplace(req, res, next) {
  const { sequelize } = require('../config/database');
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: { message: 'Body must be an array of exercises' } });
    }
    const userId = req.user.uid;
    // De-duplicate by name (DB has UNIQUE [userId, name])
    const seen = new Set();
    const rows = [];
    for (const e of req.body) {
      if (!e || !e.name || !e.muscle) continue;
      const name = String(e.name).trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      rows.push({
        userId,
        name,
        muscle: e.muscle,
        param: e.param || 'reps',
        weightMode: e.weightMode || 'total',
        barbellWeight: e.barbellWeight ?? null,
        isUnilateral: !!e.isUnilateral,
      });
    }
    await sequelize.transaction(async (t) => {
      await Exercise.destroy({ where: { userId }, transaction: t });
      if (rows.length) await Exercise.bulkCreate(rows, { transaction: t });
    });
    const fresh = await Exercise.findAll({
      where: { userId },
      order: [['name', 'ASC']],
    });
    res.json(fresh);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, destroy, bulkReplace };
