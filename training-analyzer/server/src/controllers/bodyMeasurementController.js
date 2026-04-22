const { BodyMeasurement } = require('../models');
const { Op } = require('sequelize');

const ALLOWED_FIELDS = BodyMeasurement.FIELDS;

function pickFields(body) {
  const out = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] === null || body[f] === '') {
      out[f] = null;
    } else if (body[f] !== undefined) {
      const n = Number(body[f]);
      if (Number.isFinite(n) && n >= 0) out[f] = n;
    }
  }
  return out;
}

async function list(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = { userId: req.user.uid };
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }
    const rows = await BodyMeasurement.findAll({ where, order: [['date', 'ASC']] });
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: { message: 'date is required' } });
    const data = pickFields(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: { message: 'at least one measurement field is required' } });
    }

    const [row, created] = await BodyMeasurement.findOrCreate({
      where: { userId: req.user.uid, date },
      defaults: { userId: req.user.uid, date, ...data },
    });
    if (!created) await row.update(data);
    res.status(created ? 201 : 200).json(row);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const row = await BodyMeasurement.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!row) return res.status(404).json({ error: { message: 'Measurement not found' } });
    const data = pickFields(req.body);
    if (req.body.date) data.date = req.body.date;
    await row.update(data);
    res.json(row);
  } catch (err) { next(err); }
}

async function destroy(req, res, next) {
  try {
    const row = await BodyMeasurement.findOne({
      where: { id: req.params.id, userId: req.user.uid },
    });
    if (!row) return res.status(404).json({ error: { message: 'Measurement not found' } });
    await row.destroy();
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, create, update, destroy };
