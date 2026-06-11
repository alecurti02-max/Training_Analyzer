const { PlannedWorkout } = require('../models');
const { makeDateUpsertController } = require('../utils/crud');

// muscleGroups + exercises sono JSONB (array) → pickFields custom (lo spec
// generico copre solo number/string). Tutto bounded per sicurezza.
function pickFields(body) {
  const out = {};
  if (typeof body.type === 'string' && body.type.trim()) {
    out.type = body.type.trim().slice(0, 40);
  }
  if (Array.isArray(body.muscleGroups)) {
    out.muscleGroups = body.muscleGroups
      .filter((m) => typeof m === 'string')
      .slice(0, 30)
      .map((m) => m.slice(0, 40));
  }
  if (Array.isArray(body.exercises)) {
    // esercizi pre-impostati (forma libera {name, muscle, sets?, ...}): bounded
    // nel numero e filtrati ai soli plain object (niente scalari/array iniettati)
    out.exercises = body.exercises
      .filter((e) => e && typeof e === 'object' && !Array.isArray(e))
      .slice(0, 40);
  }
  if (body.note === null || body.note === '') out.note = null;
  else if (typeof body.note === 'string') out.note = body.note.slice(0, 1000);
  return out;
}

module.exports = {
  ...makeDateUpsertController({
    Model: PlannedWorkout,
    pickFields,
    entityName: 'Planned workout',
    requireAtLeastOneField: false,
  }),
  // Riusato dalla variante coach (controllers/coachClientsController.js)
  pickFields,
};
