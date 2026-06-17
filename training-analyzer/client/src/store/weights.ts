import { signal } from '@preact/signals';

// Pesi corporei (ordinati per data crescente, come in loadAllData).
export const weights = signal<any[]>([]);

export function setWeights(list: any[] | null | undefined): void {
  weights.value = Array.isArray(list) ? list : [];
}

// Upsert per data + riordino crescente (M2): un solo peso per giorno, come il
// vecchio saveWeight in ui.js. Pura sul signal (il POST resta nel chiamante,
// che legge il valore dal form). Ritorna la nuova lista per comodità.
export function upsertWeight(entry: { date: string; value: number; id?: string }): any[] {
  const next = [...weights.value];
  const i = next.findIndex((w) => w.date === entry.date);
  if (i >= 0) next[i] = entry; else next.push(entry);
  next.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  setWeights(next);
  return next;
}
