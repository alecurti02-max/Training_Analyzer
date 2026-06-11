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
 *   - ownerId(req): resolver for the row owner (default: the authenticated user).
 *     The coach routes pass req => req.clientId (after loadCoachClient) to operate
 *     on a client's calendar without duplicating these handlers.
 *   - stampFields(req): extra server-controlled fields merged into the CREATE
 *     defaults only (e.g. { createdByCoachId }) — never from the body, and never
 *     applied when the upsert lands on an existing row: ownership of a row must
 *     not be reassigned by an upsert (a coach pinning over a client-created plan
 *     updates its content but the row stays the client's).
 *   - mutationWhere(req): extra WHERE for update/destroy (e.g. a coach may only
 *     mutate rows they created).
 */
function makeDateUpsertController({
  Model,
  pickFields,
  entityName,
  requireAtLeastOneField = true,
  ownerId = (req) => req.user.uid,
  stampFields = null,
  mutationWhere = null,
}) {
  async function list(req, res, next) {
    try {
      const { from, to } = req.query;
      const where = { userId: ownerId(req) };
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
      const stamp = stampFields ? stampFields(req) : {};
      const uid = ownerId(req);
      const [row, created] = await Model.findOrCreate({
        where: { userId: uid, date },
        defaults: { userId: uid, date, ...data, ...stamp },
      });
      if (!created) await row.update(data);
      res.status(created ? 201 : 200).json(row);
    } catch (err) { next(err); }
  }

  async function update(req, res, next) {
    try {
      const row = await Model.findOne({
        where: { id: req.params.id, userId: ownerId(req), ...(mutationWhere ? mutationWhere(req) : {}) },
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
        where: { id: req.params.id, userId: ownerId(req), ...(mutationWhere ? mutationWhere(req) : {}) },
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
