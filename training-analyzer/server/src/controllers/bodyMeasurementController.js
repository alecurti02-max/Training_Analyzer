const { BodyMeasurement } = require('../models');
const { makeDateUpsertController } = require('../utils/crud');

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

const handlers = makeDateUpsertController({
  Model: BodyMeasurement,
  pickFields,
  entityName: 'Measurement',
});

module.exports = handlers;
