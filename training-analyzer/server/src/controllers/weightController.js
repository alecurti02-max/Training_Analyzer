const { Weight } = require('../models');
const { makeDateUpsertController } = require('../utils/crud');

function pickFields(body) {
  const out = {};
  if (body.value !== undefined) {
    const n = Number(body.value);
    if (Number.isFinite(n) && n > 0) out.value = n;
  }
  return out;
}

const handlers = makeDateUpsertController({
  Model: Weight,
  pickFields,
  entityName: 'Weight entry',
  requireAtLeastOneField: true,
});

module.exports = handlers;
