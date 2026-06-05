import { signal } from '@preact/signals';

// Impostazioni utente + due derivati che loadAllData estrae da settings
// (activeSports, muscleGroups). Tenuti qui perché usati trasversalmente.
export const settings = signal<Record<string, any>>({});
export const activeSports = signal<string[]>(['gym', 'running']);
export const muscleGroups = signal<string[]>([]);

export function setSettings(s: Record<string, any> | null | undefined): void {
  settings.value = s || {};
}
export function setActiveSports(list: string[] | null | undefined): void {
  if (Array.isArray(list)) activeSports.value = list;
}
export function setMuscleGroups(list: string[] | null | undefined): void {
  if (Array.isArray(list)) muscleGroups.value = list;
}
