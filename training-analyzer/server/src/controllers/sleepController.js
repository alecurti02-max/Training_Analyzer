const { SleepLog } = require('../models');
const { makeDateUpsertController, pickFieldsFromSpec } = require('../utils/crud');

const FIELD_SPEC = {
  numbers: [
    { name: 'durationHours', min: 0, max: 24 },
    { name: 'quality', min: 1, max: 10, integer: true },
  ],
  strings: [
    { name: 'notes', maxLength: 1000 },
  ],
};

const pickFields = (body) => pickFieldsFromSpec(body, FIELD_SPEC);

const handlers = makeDateUpsertController({
  Model: SleepLog,
  pickFields,
  entityName: 'Sleep log',
});

module.exports = handlers;
