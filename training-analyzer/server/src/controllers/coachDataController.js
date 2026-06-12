const { Weight, BodyMeasurement, NutritionLog, SleepLog } = require('../models');
const { makeDateUpsertController } = require('../utils/crud');

// Letture READ-ONLY del coach sui dati sensibili del cliente, gated dall'opt-in
// del cliente (requireSharing in routes/coach.js): body → peso+misure,
// nutrition → diario alimentare, sleep → sonno. Si espone SOLO `list` del
// date-upsert (mai create/update/destroy: il coach non scrive questi dati).
const listOnly = (Model, entityName) =>
  makeDateUpsertController({
    Model,
    pickFields: () => ({}),
    entityName,
    ownerId: (req) => req.clientId,
  }).list;

module.exports = {
  listWeights: listOnly(Weight, 'Weight entry'),
  listBodyMeasurements: listOnly(BodyMeasurement, 'Body measurement'),
  listNutrition: listOnly(NutritionLog, 'Nutrition log'),
  listSleep: listOnly(SleepLog, 'Sleep log'),
};
