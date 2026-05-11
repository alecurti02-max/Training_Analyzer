const { NutritionLog } = require('../models');
const { makeDateUpsertController, pickFieldsFromSpec } = require('../utils/crud');

const FIELD_SPEC = {
  numbers: [
    { name: 'calories', min: 0 },
    { name: 'proteinG', min: 0 },
    { name: 'carbsG', min: 0 },
    { name: 'fatG', min: 0 },
  ],
  strings: [
    { name: 'notes', maxLength: 1000 },
  ],
};

const pickFields = (body) => pickFieldsFromSpec(body, FIELD_SPEC);

const handlers = makeDateUpsertController({
  Model: NutritionLog,
  pickFields,
  entityName: 'Nutrition log',
});

module.exports = handlers;
