// Validation for the schema-less `workouts.data` JSONB payload.
//
// Permissive BY DESIGN. workouts.data is client-computed and varies per sport;
// real payloads carry many extra keys (advice, _tonnage, _pace, paceInput,
// runType, imported, maxhr, notes, id, secondaryMuscles, ...) AND some legitimate
// quirks — e.g. set `weight`/`reps` are sometimes strings (form inputs that
// scoring coerces with `"20" * reps`). So this schema guards only:
//   1. `data` is a non-null, non-array object,
//   2. the user-visible `scores.overall` (if present) is a finite number in [0,10],
//   3. container shapes are right: exercises/sets/splits/hrSeries are arrays.
// It does NOT enforce numeric purity on individual measures — that would reject
// real historical data (verified against the 20-workout prod backup: 0 false
// rejections). The goal is catching GROSS corruption, not normalizing values.
//
// `looseObject` passes unknown keys through, so adding a new sport field needs no
// schema change. Start lenient; tighten once more real payloads are sampled.

const { z } = require('zod');

// User-visible score: if present, a finite number in [0,10] (or null). Real data
// always stores overall as a number — this catches a 999 / "high" / NaN.
const scoresSchema = z.looseObject({
  overall: z.number().min(0).max(10).nullable().optional(),
});

const setSchema = z.looseObject({
  drops: z.array(z.looseObject({})).optional(), // if present, an array of objects
});

const exerciseSchema = z.looseObject({
  sets: z.array(setSchema).optional(),          // if present, an array of sets
});

const common = { scores: scoresSchema.optional() };

const gymSchema = z.looseObject({ ...common, exercises: z.array(exerciseSchema).optional() });

const enduranceSchema = z.looseObject({
  ...common,
  splits: z.array(z.looseObject({})).optional(),
  hrSeries: z.array(z.unknown()).optional(),
});

// karting + all other sports (~22 types: yoga, walking, cycling, swimming, …).
const baseSchema = z.looseObject({ ...common });

function schemaFor(type) {
  if (type === 'gym') return gymSchema;
  if (type === 'running') return enduranceSchema;
  return baseSchema;
}

// Returns { ok: true } or { ok: false, issues: [{ path, message }] }.
function validateWorkoutData(type, data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, issues: [{ path: 'data', message: 'data must be an object' }] };
  }
  const result = schemaFor(type).safeParse(data);
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.length ? i.path.join('.') : 'data',
      message: i.message,
    })),
  };
}

module.exports = { validateWorkoutData };
