import { signal } from '@preact/signals';
import { api } from '@/lib/api';
import { DEFAULT_MUSCLES } from '../../js/sports.js';

// Impostazioni utente + due derivati che loadAllData estrae da settings
// (activeSports, muscleGroups). Tenuti qui perché usati trasversalmente.
// M1: questi signal SONO la fonte di verità; ui.js li specchia in let di
// sola lettura. muscleGroups parte dai default (stessa semantica pre-load
// del vecchio let legacy).
export const settings = signal<Record<string, any>>({});
export const activeSports = signal<string[]>(['gym', 'running']);
export const muscleGroups = signal<string[]>([...DEFAULT_MUSCLES]);

export function setSettings(s: Record<string, any> | null | undefined): void {
  settings.value = s || {};
}
export function setActiveSports(list: string[] | null | undefined): void {
  if (Array.isArray(list)) activeSports.value = list;
}
export function setMuscleGroups(list: string[] | null | undefined): void {
  if (Array.isArray(list)) muscleGroups.value = list;
}

// Persistenza (M2): aggiorna ottimisticamente il signal e fa PUT. settings è
// upsert/merge lato server. Sostituisce ui.js::saveSettingsToServer.
export async function persistSettings(s: Record<string, any>): Promise<void> {
  setSettings(s);
  await api.put('/api/settings', s);
}

// Patch parziale (M3 Body): merge ottimistico nel signal + PUT del solo subset.
// Il server fa upsert/merge, quindi PUT parziale aggiorna solo i campi passati —
// niente footgun del full-object (che azzererebbe i campi non montati).
export async function patchSettings(partial: Record<string, any>): Promise<void> {
  setSettings({ ...settings.value, ...partial });
  await api.put('/api/settings', partial);
}
