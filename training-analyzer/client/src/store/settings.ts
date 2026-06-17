import { signal } from '@preact/signals';
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
