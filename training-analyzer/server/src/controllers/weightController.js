const { Weight } = require('../models');
const { Op } = require('sequelize');

async function list(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = { userId: req.user.uid };

    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    const weights = await Weight.findAll({
      where,
      order: [['date', 'ASC']],
    });
    res.json(weights);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { date, value } = req.body;
    if (!date || value == null) {
      return res.status(400).json({ error: { message: 'date and value are required' } });
    }
    if (typeof value !== 'number' || value <= 0) {
      return res.status(400).json({ error: { message: 'value must be a positive number' } });
    }

    // Upsert: if same day exists, update
    const [weight, created] = await Weight.findOrCreate({
      where: { userId: req.user.uid, date },
      defaults: { userId: req.user.uid, date, value },
    });

    if (!created) {
      await weight.update({ value });
    }

    res.status(created ? 201 : 200).json(weight);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const weight = await Weight.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!weight) return res.status(404).json({ error: { message: 'Weight entry not found' } });

    const { date, value } = req.body;
    if (date) weight.date = date;
    if (value != null) weight.value = value;
    await weight.save();

    res.json(weight);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const weight = await Weight.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!weight) return res.status(404).json({ error: { message: 'Weight entry not found' } });

    await weight.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, destroy };
