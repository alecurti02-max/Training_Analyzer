// Config e helper puri delle misurazioni corporee (port da js/bodyMeasurements.js).
// FIELDS è la singola fonte di verità: form, storico e grafici si adattano.

export interface FieldDef {
  key: string;
  label: string;
  unit: string;
  group: 'circ' | 'comp';
  chart: 'circ' | 'compPct' | 'compMass' | 'visceral';
  overview: boolean;
  color: string;
}

export const FIELDS: FieldDef[] = [
  // Circonferenze
  { key: 'circChest', label: 'Petto', unit: 'cm', group: 'circ', chart: 'circ', overview: true, color: '#00E5CE' },
  { key: 'circWaist', label: 'Vita', unit: 'cm', group: 'circ', chart: 'circ', overview: true, color: '#5FF3DF' },
  { key: 'circHips', label: 'Fianchi', unit: 'cm', group: 'circ', chart: 'circ', overview: true, color: '#FF2D46' },
  { key: 'circShoulders', label: 'Spalle', unit: 'cm', group: 'circ', chart: 'circ', overview: false, color: '#FFD60A' },
  { key: 'circBicep', label: 'Bicipite', unit: 'cm', group: 'circ', chart: 'circ', overview: false, color: '#FB923C' },
  { key: 'circNeck', label: 'Collo', unit: 'cm', group: 'circ', chart: 'circ', overview: false, color: '#FB923C' },
  { key: 'circThigh', label: 'Coscia', unit: 'cm', group: 'circ', chart: 'circ', overview: false, color: '#A78BFA' },
  { key: 'circCalf', label: 'Polpaccio', unit: 'cm', group: 'circ', chart: 'circ', overview: false, color: '#7C3AED' },
  // Composizione: percentuali
  { key: 'bodyFat', label: 'Massa grassa', unit: '%', group: 'comp', chart: 'compPct', overview: true, color: '#FF2D46' },
  { key: 'skeletalMuscle', label: 'Muscolo scheletr.', unit: '%', group: 'comp', chart: 'compPct', overview: true, color: '#10B981' },
  { key: 'subcutaneousFat', label: 'Grasso sottocut.', unit: '%', group: 'comp', chart: 'compPct', overview: false, color: '#FFD60A' },
  { key: 'bodyWater', label: 'Acqua', unit: '%', group: 'comp', chart: 'compPct', overview: true, color: '#22D3EE' },
  { key: 'protein', label: 'Proteine', unit: '%', group: 'comp', chart: 'compPct', overview: false, color: '#67E8F9' },
  // Composizione: masse
  { key: 'muscleMass', label: 'Massa muscolare', unit: 'kg', group: 'comp', chart: 'compMass', overview: false, color: '#10B981' },
  { key: 'boneMass', label: 'Massa ossea', unit: 'kg', group: 'comp', chart: 'compMass', overview: false, color: '#9CA0AB' },
  // Composizione: viscerale (scala a sé)
  { key: 'visceralFat', label: 'Grasso viscerale', unit: 'indice', group: 'comp', chart: 'visceral', overview: true, color: '#FF2D46' },
];

// I campi composizione sincronizzati measurement → settings (syncSettingsFromMeasurement
// legacy): mantiene la doppia fonte (Settings/BodyMeasurement) in pari come prima.
export const SYNC_TO_SETTINGS_FIELDS = [
  'circChest', 'circWaist', 'circHips', 'circShoulders', 'circBicep', 'circNeck', 'circThigh', 'circCalf',
  'bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat', 'bodyWater', 'muscleMass', 'boneMass', 'protein',
];

export const VISCERAL_ZONES = [
  { max: 9, label: 'Buono', color: 'rgba(16,185,129,0.12)', stroke: 'rgba(16,185,129,0.35)' },
  { max: 12, label: 'Attenzione', color: 'rgba(255,214,10,0.15)', stroke: 'rgba(255,214,10,0.4)' },
  { max: Infinity, label: 'Alto', color: 'rgba(255,45,70,0.12)', stroke: 'rgba(255,45,70,0.35)' },
];

export const RANGE_OPTIONS = [
  { key: '30d', label: '30 gg', days: 30 },
  { key: '90d', label: '90 gg', days: 90 },
  { key: '6m', label: '6 mesi', days: 183 },
  { key: '1y', label: '1 anno', days: 365 },
  { key: 'all', label: 'Tutto', days: null as number | null },
];

export const CHART_TABS = [
  { key: 'weight', label: 'Peso' },
  { key: 'circ', label: 'Circonferenze' },
  { key: 'compPct', label: 'Composizione %' },
  { key: 'compMass', label: 'Masse (kg)' },
  { key: 'visceral', label: 'Grasso viscerale' },
  { key: 'overview', label: "Vista d'insieme" },
];

export function fieldByKey(k: string): FieldDef | undefined { return FIELDS.find((f) => f.key === k); }
export function fieldsInTab(tab: string): FieldDef[] { return FIELDS.filter((f) => f.chart === tab); }

export function filterByRange<T extends { date: string }>(rows: T[], rangeKey: string): T[] {
  const opt = RANGE_OPTIONS.find((r) => r.key === rangeKey);
  if (!opt || opt.days == null) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - opt.days);
  return rows.filter((r) => new Date(r.date) >= cutoff);
}

export function bmi(w?: number | null, h?: number | null): string {
  if (!w || !h) return '—';
  const m = h / 100;
  return (w / (m * m)).toFixed(1);
}
export function whtr(waist?: number | null, h?: number | null): string {
  if (!waist || !h) return '';
  return 'WHtR ' + (waist / h).toFixed(2);
}
export function visceralBadge(v: number): string {
  if (v <= 9) return '🟢';
  if (v <= 12) return '🟡';
  return '🔴';
}
