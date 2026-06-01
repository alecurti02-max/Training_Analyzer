// Train data snapshot, fed from the legacy bridge.
//
// The new Train Preact UI needs read access to workouts (for "last performance"),
// settings (active sports, bodyweight), and the exercise library. Rather than
// reaching into ui.js globals, the bridge pushes a snapshot here on mount. This is
// the small, flag-protected slice of the P3 state migration — the full rip-out of
// onDataChanged + every legacy page is deferred until a runtime env exists.
//
// `saveWorkout` is injected (the legacy saveWorkout, which POSTs and updates the
// legacy caches) so the new UI doesn't fork the persistence path.

import { signal } from '@preact/signals';

export const trainData = signal({
  workouts: [],
  settings: {},
  exercises: [],
});

// Injected legacy callbacks so the new UI reuses the exact persistence + nav paths.
export const trainBridge = {
  saveWorkout: null,   // async (workout) => savedRow
  onSaved: null,       // (workout) => void  — push to legacy cache + toast + navigate
  getDefaultExercises: null,
};

export function setTrainData(snapshot) {
  trainData.value = {
    workouts: snapshot.workouts || [],
    settings: snapshot.settings || {},
    exercises: snapshot.exercises || [],
  };
}

export function setTrainBridge(bridge) {
  Object.assign(trainBridge, bridge);
}

// Active sports list, mirroring sports.js getUserActiveSports (gym + running always first).
export function activeSportsFrom(settings) {
  const sports = ['gym', 'running'];
  (settings?.activeSports || []).forEach((s) => { if (!sports.includes(s)) sports.push(s); });
  return sports;
}

// Last gym performance of an exercise by name (mirrors ui.js getLastPerformance).
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
