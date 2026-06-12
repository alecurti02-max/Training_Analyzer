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

// Pre-compilazione del wizard da un allenamento PROGRAMMATO (PlannedWorkout).
// La Dashboard "Prossima sessione → registra" chiama startFromPlan(plan) e poi
// showPage('train'); il LogWizard reagisce al signal e inizializza
// tipo/muscoli/esercizi (via logic/planPrefill).
export const pendingPlan = signal(null);
export function startFromPlan(plan) { pendingPlan.value = plan || null; }

// Avvio della SESSIONE LIVE pre-compilata da un piano (con esercizi + serie).
// La LiveSession auto-parte coi suoi esercizi; requestedTab apre il tab giusto.
export const pendingLivePlan = signal(null);
export function startLiveFromPlan(plan) { pendingLivePlan.value = plan || null; }

// I consume si azzerano a vicenda: lo stesso piano non deve pre-compilare
// ANCHE l'altro tab (doppio inserimento) né restare in attesa per ore.
export function consumePendingPlan() {
  const p = pendingPlan.value;
  pendingPlan.value = null;
  pendingLivePlan.value = null;
  return p;
}
export function consumePendingLivePlan() {
  const p = pendingLivePlan.value;
  pendingLivePlan.value = null;
  pendingPlan.value = null;
  return p;
}

// TrainApp legge questo al mount per aprire 'manual' | 'live'.
export const requestedTab = signal(null);
export function setRequestedTab(tab) { requestedTab.value = tab || null; }
export function consumeRequestedTab() { const t = requestedTab.value; requestedTab.value = null; return t; }

// Active sports list, mirroring sports.js getUserActiveSports (gym + running always first).
export function activeSportsFrom(settings) {
  const sports = ['gym', 'running'];
  (settings?.activeSports || []).forEach((s) => { if (!sports.includes(s)) sports.push(s); });
  return sports;
}

// Last gym performance — implementazione spostata in logic/planPrefill.js
// (logic/ resta store-free); ri-esportata qui per i consumer esistenti.
export { lastPerformance } from '../pages/Train/logic/planPrefill.js';
