import { test, expect } from 'vitest';
import { planToEditableExercises, lastPerformance } from '../planPrefill.js';

const workouts = [
  { type: 'gym', date: '2026-06-01', exercises: [{ name: 'Panca', sets: [{ reps: 8, weight: 70, rpe: 7 }] }] },
  { type: 'gym', date: '2026-05-01', exercises: [{ name: 'Panca', sets: [{ reps: 8, weight: 65 }] }, { name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] },
  { type: 'running', date: '2026-06-05' },
];

test('lastPerformance: ultima occorrenza gym per nome, null se assente', () => {
  expect(lastPerformance(workouts, 'Panca').sets[0].weight).toBe(70);
  expect(lastPerformance(workouts, 'Squat').sets[0].weight).toBe(100);
  expect(lastPerformance(workouts, 'Stacco')).toBeNull();
  expect(lastPerformance(null, 'Panca')).toBeNull();
});

test('piano CON serie: live resetta done, wizard le copia intatte', () => {
  const plan = { exercises: [{ name: 'Panca', muscle: 'Petto', sets: [{ reps: 8, weight: 70, done: true }, { reps: 8, weight: 70 }] }] };
  const live = planToEditableExercises(plan, workouts, { live: true });
  expect(live[0].sets.every((s) => s.done === false)).toBe(true);
  expect(live[0].sets.length).toBe(2);
  const wiz = planToEditableExercises(plan, workouts);
  expect(wiz[0].sets).toEqual(plan.exercises[0].sets);
  expect(wiz[0].sets).not.toBe(plan.exercises[0].sets); // copia, non riferimento
});

test('piano SENZA serie: fallback initialSets (copia ultima performance)', () => {
  const plan = { exercises: [{ name: 'Panca', muscle: 'Petto' }] };
  const [ex] = planToEditableExercises(plan, workouts, { live: true });
  expect(ex.lastPerf).not.toBeNull();
  expect(ex.sets.length).toBe(1);          // 1 set nell'ultima performance
  expect(ex.sets[0].weight).toBe(70);      // copiato dall'ultima volta
  expect(ex.sets[0].done).toBe(false);     // live → done resettato
});

test('lastPerf agganciata; default per campi mancanti; piano vuoto → []', () => {
  const plan = { exercises: [{ name: 'Stacco', muscle: 'Schiena' }] };
  const [ex] = planToEditableExercises(plan, workouts);
  expect(ex.lastPerf).toBeNull();
  expect(ex.weightMode).toBe('total');
  expect(ex.param).toBe('reps');
  expect(ex.isUnilateral).toBe(false);
  expect(ex.sets.length).toBe(1);          // serie vuota
  expect(planToEditableExercises({}, workouts)).toEqual([]);
  expect(planToEditableExercises(null, workouts)).toEqual([]);
});
