// Pre-compilazione esercizi da un PlannedWorkout, condivisa da wizard e live
// (prima il live aveva il suo mapping inline e il wizard SVUOTAVA gli esercizi:
// stesso piano, due comportamenti). Pure: no DOM, no store.

import { initialSets } from './setModel.js';

// Ultima performance gym di un esercizio per nome (specchio di ui.js
// getLastPerformance; spostata qui da store/train.js per tenere logic/ libero
// dagli store — lo store la ri-esporta per i consumer esistenti).
export function lastPerformance(workouts, exerciseName) {
  const sorted = [...(workouts || [])]
    .filter((w) => w.type === 'gym')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const w of sorted) {
    const ex = (w.exercises || []).find((e) => e.name === exerciseName);
    if (ex && ex.sets && ex.sets.length) return ex;
  }
  return null;
}

// plan.exercises → shape dell'editor (ExerciseCard), con lastPerf agganciata.
// Serie: quelle del piano se presenti (live: done resettato; wizard: copia),
// altrimenti initialSets (copia dell'ultima performance o una serie vuota) —
// lo stesso comportamento dell'aggiunta manuale di un esercizio.
export function planToEditableExercises(plan, workouts, { live = false } = {}) {
  return ((plan && plan.exercises) || []).map((e) => {
    const ex = {
      name: e.name,
      muscle: e.muscle,
      secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles.slice() : [],
      weightMode: e.weightMode || 'total',
      barbellWeight: e.barbellWeight || null,
      isUnilateral: !!e.isUnilateral,
      param: e.param || 'reps',
      lastPerf: lastPerformance(workouts, e.name),
    };
    if (Array.isArray(e.sets) && e.sets.length) {
      ex.sets = e.sets.map((st) => (live ? { ...st, done: false } : { ...st }));
    } else {
      ex.sets = initialSets(ex, ex.lastPerf, { live });
    }
    return ex;
  });
}
