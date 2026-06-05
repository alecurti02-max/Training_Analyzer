import { signal } from '@preact/signals';

// Forma runtime "appiattita" del workout: campi DB (id/type/date) + JSONB .data
// uniti al top-level + _tonnage calcolato. Tipizzazione permissiva ora; verrà
// stretta a Workout (src/types/workout) in Fase 8, quando le pagine tipizzate
// eserciteranno il contratto.
export type WorkoutRecord = Record<string, any> & { id: string; type: string; date: string };

// Sorgente di verità per la lista allenamenti. In Fase 7a è alimentata dal mirror
// legacy (dataSync.syncFromLegacy); in Fase 9 i load* vivranno qui.
export const workouts = signal<WorkoutRecord[]>([]);

export function setWorkouts(list: WorkoutRecord[] | null | undefined): void {
  workouts.value = Array.isArray(list) ? list : [];
}
export function addWorkout(w: WorkoutRecord): void {
  workouts.value = [...workouts.value, w];
}
export function removeWorkout(id: string): void {
  workouts.value = workouts.value.filter((w) => w.id !== id);
}
export function removeWorkouts(ids: Set<string> | string[]): void {
  const set = ids instanceof Set ? ids : new Set(ids);
  workouts.value = workouts.value.filter((w) => !set.has(w.id));
}
export function updateWorkout(w: WorkoutRecord): void {
  workouts.value = workouts.value.map((x) => (x.id === w.id ? w : x));
}
