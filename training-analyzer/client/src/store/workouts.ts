import { signal } from '@preact/signals';
import { api } from '@/lib/api';
import { getDefaultMusclesForSport } from '../../js/sports.js';

// Forma runtime "appiattita" del workout: campi DB (id/type/date) + JSONB .data
// uniti al top-level + _tonnage calcolato. Tipizzazione permissiva ora; verrà
// stretta a Workout (src/types/workout) in Fase 8, quando le pagine tipizzate
// eserciteranno il contratto.
export type WorkoutRecord = Record<string, any> & { id: string; type: string; date: string };

// Sorgente di verità per la lista allenamenti (M1). ui.js la legge via effect();
// le azioni di persistenza qui sotto (M2) parlano col server e aggiornano il
// signal — sono il rimpiazzo definitivo delle save/delete che vivevano in ui.js.
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

// ── Azioni di persistenza (M2): API + signal in un posto solo ──────────────

// Autofill dei muscoli di default per gli sport senza muscles esplicito (import,
// live recording). I flussi a form passano già un array esplicito. Muta in place
// come faceva il vecchio saveWorkout: il chiamante riusa lo stesso oggetto in
// addWorkout, quindi i muscoli devono finire anche lì.
export function fillDefaultMuscles(workout: WorkoutRecord): WorkoutRecord {
  if (workout.type !== 'gym' && workout.muscles === undefined) {
    const defaults = getDefaultMusclesForSport(workout.type);
    if (defaults.length) workout.muscles = defaults;
  }
  return workout;
}

// POST di un nuovo workout. Ritorna la riga salvata dal server (con id). NON
// tocca il signal: il flusso Train fa addWorkout in onSaved col record completo,
// così non c'è doppio inserimento.
export async function postWorkout(workout: WorkoutRecord): Promise<any> {
  fillDefaultMuscles(workout);
  const { type, date, ...rest } = workout;
  return api.post('/api/workouts', { type, date, data: rest });
}

export async function deleteWorkoutById(id: string): Promise<void> {
  await api.del('/api/workouts/' + id);
  removeWorkout(id);
}

// Elimina N workout (best-effort: prosegue sui singoli errori). Ritorna il
// numero di cancellazioni riuscite.
export async function deleteManyWorkouts(ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    try { await api.del('/api/workouts/' + id); deleted++; } catch (e) { console.error('Delete error', id, e); }
  }
  removeWorkouts(ids);
  return deleted;
}

export async function deleteAllWorkouts(): Promise<any> {
  const res = await api.del('/api/workouts');
  setWorkouts([]);
  return res;
}
