import { signal } from '@preact/signals';
import { api } from '@/lib/api';

// Log sonno: un record per giorno (data = giorno del risveglio), upsert su
// (userId,date). Port della parte sleep di js/recovery.js (M3 Body).
export interface SleepRecord {
  id: string;
  date: string;
  durationHours?: number | null;
  quality?: number | null;
  notes?: string | null;
}

export const sleep = signal<SleepRecord[]>([]);
let loaded = false;

function sortAsc(list: SleepRecord[]): SleepRecord[] {
  return [...list].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export async function loadSleep(force = false): Promise<void> {
  if (loaded && !force) return;
  loaded = true;
  try {
    const list = await api.get<SleepRecord[]>('/api/sleep').catch(() => []);
    sleep.value = sortAsc(Array.isArray(list) ? list : []);
  } catch (e) {
    console.error('Failed to load sleep:', e);
  }
}

export async function saveSleep(payload: Partial<SleepRecord> & { date: string }): Promise<SleepRecord> {
  const saved = await api.post<SleepRecord>('/api/sleep', payload);
  const rest = sleep.value.filter((r) => r.date !== saved.date);
  sleep.value = sortAsc([...rest, saved]);
  return saved;
}

export async function deleteSleep(id: string): Promise<void> {
  await api.del('/api/sleep/' + id);
  sleep.value = sleep.value.filter((r) => r.id !== id);
}
