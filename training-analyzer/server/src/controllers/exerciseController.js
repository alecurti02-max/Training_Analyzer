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
    const { name, muscle, param } = req.body;
    if (!name || !muscle) {
      return res.status(400).json({ error: { message: 'name and muscle are required' } });
    }

    const exercise = await Exercise.create({
      userId: req.user.uid,
      name: name.trim(),
      muscle,
      param: param || 'reps',
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

    const { name, muscle, param } = req.body;
    if (name) exercise.name = name.trim();
    if (muscle) exercise.muscle = muscle;
    if (param) exercise.param = param;
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

module.exports = { list, create, update, destroy };
