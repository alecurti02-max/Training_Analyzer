// Build the workout payload from wizard / live-session state.
//
// CRITICAL: the output must be byte-identical to the legacy wizSaveWorkout
// (js/ui.js ~852-927) and liveSaveWorkout (~1549-1630), because `scores` is
// user-visible and persisted. The scoring/advice/tonnage calls themselves stay
// in scoring.ts — this module only assembles the object handed to them. Verified
// against the P0 characterization fixture via node.
//
// Pure: no DOM, no network. The caller passes already-collected field values and
// injects the scoring fns (so this module has no import cycle with scoring).

import { paceToSeconds } from '@/lib/utils.js';

// Filter + normalise gym exercises into the persisted shape.
// `onlyDone` = live session (only completed sets count); wizard saves all entered.
export function buildGymExercises(exercises, { onlyDone = false } = {}) {
  const out = [];
  (exercises || []).forEach((ex) => {
    const isReps = (ex.param || 'reps') === 'reps';
    const sets = (ex.sets || [])
      .filter((s) => {
        if (onlyDone && !s.done) return false;
        return (s.reps > 0) || (s.repsLeft > 0) || (s.repsRight > 0);
      })
      .map((s) => {
        let o;
        if (ex.isUnilateral) {
          o = isReps
            ? { reps: s.reps, weightLeft: s.weightLeft || 0, weightRight: s.weightRight || 0, rpe: s.rpe || null }
            : { repsLeft: s.repsLeft || 0, repsRight: s.repsRight || 0, rpe: s.rpe || null };
        } else {
          o = { reps: s.reps, weight: s.weight || 0, rpe: s.rpe || null };
          const drops = Array.isArray(s.drops)
            ? s.drops.filter((d) => d.reps > 0).map((d) => ({ reps: d.reps, weight: d.weight || 0 }))
            : [];
          if (drops.length) o.drops = drops;
        }
        if (s.bodyweight) o.bodyweight = true;
        return o;
      });
    if (sets.length) {
      out.push({
        name: ex.name,
        muscle: ex.muscle,
        secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
        weightMode: ex.weightMode || 'total',
        barbellWeight: ex.barbellWeight || null,
        isUnilateral: !!ex.isUnilateral,
        param: ex.param || 'reps',
        sets,
      });
    }
  });
  return out;
}

// Serie con dati inseriti ma mai segnate "Fatto": al salvataggio live
// (onlyDone:true) buildGymExercises le scarta — il finish screen le segnala
// all'utente invece di perderle in silenzio. Stesso predicato del filtro sopra.
export function countSkippedSets(exercises) {
  let n = 0;
  (exercises || []).forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      if (!s.done && ((s.reps > 0) || (s.repsLeft > 0) || (s.repsRight > 0))) n++;
    });
  });
  return n;
}

// Apply the running pace transform in place: pace string → paceInput + numeric _pace.
// Mirrors js/ui.js:909-914 / 1608-1613 exactly.
export function applyRunningPace(workout) {
  const paceStr = workout.pace;
  workout.paceInput = paceStr;
  workout._pace = paceToSeconds(paceStr)
    || (workout.duration && workout.distance ? (workout.duration * 60) / workout.distance : 0);
  delete workout.pace;
  return workout;
}

// Assemble a gym workout object (pre-scoring). `meta` = { id, date, duration, rpe, notes }.
export function buildGymWorkout(exercises, meta, { onlyDone = false } = {}) {
  return {
    id: meta.id,
    type: 'gym',
    date: meta.date,
    duration: meta.duration ?? null,
    rpe: meta.rpe ?? null,
    notes: meta.notes || '',
    exercises: buildGymExercises(exercises, { onlyDone }),
  };
}

// Assemble a non-gym sport workout (pre-scoring) from collected field values.
// `fieldDefs` = FIELD_DEFS (for number coercion); `fields` = { key: rawValue }.
// `muscles` (optional) = explicit muscle chips (wizard non-gym). `extra` = { duration, rpe }
// for live (duration from timer, not a field). Mirrors the legacy non-gym branches.
export function buildSportWorkout(type, fields, meta, fieldDefs, { muscles, extra } = {}) {
  const workout = { id: meta.id, type, date: meta.date, notes: meta.notes || '' };
  if (extra && extra.duration != null) workout.duration = extra.duration;
  if (extra && extra.rpe) workout.rpe = extra.rpe;

  Object.entries(fields || {}).forEach(([key, raw]) => {
    const f = fieldDefs[key];
    if (f?.type === 'number') workout[key] = parseFloat(raw) || null;
    else workout[key] = raw || null;
  });

  if (type === 'running') applyRunningPace(workout);
  if (Array.isArray(muscles) && muscles.length) workout.muscles = muscles;
  return workout;
}

// Attach tonnage + scores + advice using injected scoring fns (from scoring.ts).
// Returns the same workout, mutated like the legacy code did right before save.
export function attachScores(workout, { workoutsCache, settings, calcTonnage, scoreWorkout, getAdvice }) {
  if (workout.type === 'gym' && typeof calcTonnage === 'function') {
    workout._tonnage = calcTonnage(workout.exercises, settings?.bodyweight || 0);
  }
  workout.scores = scoreWorkout(workout, workoutsCache, settings);
  workout.advice = getAdvice(workout, workoutsCache, settings);
  return workout;
}
