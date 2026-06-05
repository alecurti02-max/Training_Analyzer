import { signal } from '@preact/signals';

// Libreria esercizi. Il caso EXERCISES_LOAD_FAILED (errore rete) resta gestito
// in ui.js::loadAllData per ora; qui arriva sempre un array valido via mirror.
export const exercises = signal<any[]>([]);

export function setExercises(list: any[] | null | undefined): void {
  if (Array.isArray(list)) exercises.value = list;
}
