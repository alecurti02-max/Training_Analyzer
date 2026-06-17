import { signal } from '@preact/signals';
import { api } from '@/lib/api';
import { uid } from '@/lib/utils';

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

// Azione (M3 Body): POST del peso + upsert sul signal. Il server fa upsert per
// data; se non torna un id usiamo uno locale (come il vecchio saveWeight).
export async function addWeightEntry(date: string, value: number): Promise<void> {
  const saved = await api.post<any>('/api/weights', { date, value });
  upsertWeight(saved && saved.id ? saved : { id: uid(), date, value });
}
