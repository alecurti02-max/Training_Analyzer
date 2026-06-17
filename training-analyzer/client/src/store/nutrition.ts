import { signal } from '@preact/signals';
import { api } from '@/lib/api';

// Log alimentazione: un record per giorno, upsert su (userId,date) lato server.
// Port del modulo legacy js/recovery.js (parte nutrition) ai signal store (M3 Body).
export interface NutritionRecord {
  id: string;
  date: string;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  notes?: string | null;
}

export const nutrition = signal<NutritionRecord[]>([]);
let loaded = false;

function sortAsc(list: NutritionRecord[]): NutritionRecord[] {
  return [...list].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

// Carica una sola volta per sessione (come il vecchio loadRecoveryData al boot).
export async function loadNutrition(force = false): Promise<void> {
  if (loaded && !force) return;
  loaded = true;
  try {
    const list = await api.get<NutritionRecord[]>('/api/nutrition').catch(() => []);
    nutrition.value = sortAsc(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error('Failed to load nutrition:', e);
  }
}

// Upsert per data: POST (il server fa findOrCreate su userId+date) + signal.
export async function saveNutrition(payload: Partial<NutritionRecord> & { date: string }): Promise<NutritionRecord> {
  const saved = await api.post<NutritionRecord>('/api/nutrition', payload);
  const rest = nutrition.value.filter((r) => r.date !== saved.date);
  nutrition.value = sortAsc([...rest, saved]);
  return saved;
}

export async function deleteNutrition(id: string): Promise<void> {
  await api.del('/api/nutrition/' + id);
  nutrition.value = nutrition.value.filter((r) => r.id !== id);
}
