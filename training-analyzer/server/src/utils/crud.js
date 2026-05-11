const { Op } = require('sequelize');

/**
 * Generates list/create/update/destroy handlers for resources that follow the
 * "one row per (userId, date)" pattern with upsert-on-conflict (Sleep, Nutrition,
 * BodyMeasurement, Weight).
 *
 * Caller provides:
 *   - Model: Sequelize model
 *   - pickFields(body): function that returns only safe/validated fields from body
 *   - entityName: used in error messages ('Sleep log', 'Weight entry', ...)
 *   - requireAtLeastOneField: when true, create returns 400 if pickFields returns {}
 */
function makeDateUpsertController({ Model, pickFields, entityName, requireAtLeastOneField = true }) {
  async function list(req, res, next) {
    try {
      const { from, to } = req.query;
      const where = { userId: req.user.uid };
      if (from || to) {
        where.date = {};
        if (from) where.date[Op.gte] = from;
        if (to) where.date[Op.lte] = to;
      }
      const rows = await Model.findAll({ where, order: [['date', 'ASC']] });
      res.json(rows);
    } catch (err) { next(err); }
  }

  async function create(req, res, next) {
    try {
      const { date } = req.body;
      if (!date) return res.status(400).json({ error: { message: 'date is required' } });
      const data = pickFields(req.body);
      if (requireAtLeastOneField && Object.keys(data).length === 0) {
        return res.status(400).json({ error: { message: `at least one ${entityName.toLowerCase()} field is required` } });
      }
      const [row, created] = await Model.findOrCreate({
        where: { userId: req.user.uid, date },
        defaults: { userId: req.user.uid, date, ...data },
      });
      if (!created) await row.update(data);
      res.status(created ? 201 : 200).json(row);
    } catch (err) { next(err); }
  }

  async function update(req, res, next) {
    try {
      const row = await Model.findOne({
        where: { id: req.params.id, userId: req.user.uid },
      });
      if (!row) return res.status(404).json({ error: { message: `${entityName} not found` } });
      const data = pickFields(req.body);
      if (req.body.date) data.date = req.body.date;
      await row.update(data);
      res.json(row);
    } catch (err) { next(err); }
  }

  async function destroy(req, res, next) {
    try {
      const row = await Model.findOne({
        where: { id: req.params.id, userId: req.user.uid },
      });
      if (!row) return res.status(404).json({ error: { message: `${entityName} not found` } });
      await row.destroy();
      res.status(204).end();
    } catch (err) { next(err); }
  }

  return { list, create, update, destroy };
}

/**
 * Builds a pickFields helper from a spec describing the allowed fields and their constraints.
 *
 * spec = {
 *   numbers: [{ name, min?, max?, integer?, nullable? }, ...],
 *   strings: [{ name, maxLength?, nullable? }, ...],
 * }
 */
function pickFieldsFromSpec(body, spec) {
  const out = {};
  for (const f of spec.numbers || []) {
    const v = body[f.name];
    if (v === null || v === '') {
      if (f.nullable !== false) out[f.name] = null;
      continue;
    }
    if (v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (f.min != null && n < f.min) continue;
    if (f.max != null && n > f.max) continue;
    out[f.name] = f.integer ? Math.round(n) : n;
  }
  for (const f of spec.strings || []) {
    const v = body[f.name];
    if (v === null || v === '') {
      if (f.nullable !== false) out[f.name] = null;
      continue;
    }
    if (typeof v !== 'string') continue;
    out[f.name] = f.maxLength ? v.slice(0, f.maxLength) : v;
  }
  return out;
}

module.exports = { makeDateUpsertController, pickFieldsFromSpec };
