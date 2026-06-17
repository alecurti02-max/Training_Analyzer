import { signal } from '@preact/signals';
import { api } from '@/lib/api';

// Libreria esercizi. Il caso EXERCISES_LOAD_FAILED (errore rete) resta gestito
// in ui.js::loadAllData; qui arriva sempre un array valido.
export const exercises = signal<any[]>([]);

export function setExercises(list: any[] | null | undefined): void {
  if (Array.isArray(list)) exercises.value = list;
}

// Persistenza (M2): aggiorna ottimisticamente il signal e fa PUT dell'intera
// libreria. Sostituisce ui.js::saveExercisesToServer.
export async function persistExercises(lib: any[]): Promise<void> {
  setExercises(lib);
  await api.put('/api/exercises', lib);
}
