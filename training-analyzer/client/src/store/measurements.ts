import { signal } from '@preact/signals';
import { api } from '@/lib/api';
import { patchSettings } from '@/store/settings';
import { SYNC_TO_SETTINGS_FIELDS } from '@/pages/Body/logic/measurementsConfig';

// Misurazioni corporee (storico per-data). Port di js/bodyMeasurements.js (data
// layer) ai signal store. Upsert per data lato server (findOrCreate userId+date).
export interface MeasurementRecord {
  id: string;
  date: string;
  [key: string]: any;
}

export const measurements = signal<MeasurementRecord[]>([]);
let loaded = false;

function sortAsc(list: MeasurementRecord[]): MeasurementRecord[] {
  return [...list].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export async function loadMeasurements(force = false): Promise<void> {
  if (loaded && !force) return;
  loaded = true;
  try {
    const res = await api.get<MeasurementRecord[]>('/api/body-measurements');
    measurements.value = sortAsc(Array.isArray(res) ? res : []);
  } catch (e) {
    console.error('Failed to load measurements:', e);
  }
}

// Ultima misurazione (per i prefill del form e le tile riepilogo).
export function latestMeasurement(): MeasurementRecord | Record<string, never> {
  const list = measurements.value;
  return list.length ? list[list.length - 1] : {};
}

// Salva una misurazione + sincronizza i campi composizione in Settings, così la
// doppia fonte (BodyMeasurement / Settings) resta in pari come faceva il vecchio
// syncSettingsFromMeasurement. payload contiene solo i campi compilati.
export async function saveMeasurement(payload: { date: string; [k: string]: any }): Promise<MeasurementRecord> {
  const saved = await api.post<MeasurementRecord>('/api/body-measurements', payload);
  const rest = measurements.value.filter((m) => m.date !== saved.date);
  measurements.value = sortAsc([...rest, saved]);
  // Mirror in settings (solo i campi presenti nel payload).
  const patch: Record<string, any> = {};
  for (const k of SYNC_TO_SETTINGS_FIELDS) {
    if (saved[k] != null) patch[k] = saved[k];
  }
  if (Object.keys(patch).length) { try { await patchSettings(patch); } catch (_) { /* best effort */ } }
  return saved;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await api.del('/api/body-measurements/' + id);
  measurements.value = measurements.value.filter((m) => m.id !== id);
}
