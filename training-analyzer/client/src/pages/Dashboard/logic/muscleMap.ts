// Mapping puro nome gruppo muscolare → regioni della mappa anatomica
// (BodyMapSvg). I gruppi sono stringhe user-configurabili: i nomi non mappati
// tornano null e finiscono nei chip di fallback sotto la mappa.

export type RegionId =
  | 'chest' | 'abs' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'traps' | 'back';

export function normalizeMuscle(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

// Copre DEFAULT_MUSCLES (js/sports.js) + sinonimi comuni.
const MUSCLE_REGIONS: Record<string, RegionId[]> = {
  petto: ['chest'],
  pettorali: ['chest'],
  schiena: ['back'],
  dorsali: ['back'],
  lombari: ['back'],
  spalle: ['shoulders'],
  deltoidi: ['shoulders'],
  bicipiti: ['biceps'],
  tricipiti: ['triceps'],
  avambracci: ['forearms'],
  trapezio: ['traps'],
  addominali: ['abs'],
  addome: ['abs'],
  core: ['abs'],
  quadricipiti: ['quads'],
  femorali: ['hamstrings'],
  glutei: ['glutes'],
  polpacci: ['calves'],
  gambe: ['quads', 'hamstrings', 'glutes', 'calves'],
};

export function regionsFor(name: string): RegionId[] | null {
  return MUSCLE_REGIONS[normalizeMuscle(name)] || null;
}

// Stesse soglie della vecchia RecoveryList (e del coaching NextUp):
// ≥100 recuperato, ≥80 quasi, ≥50 in recupero, <50 affaticato.
export type RecoveryTone = 'ready' | 'ok' | 'mid' | 'low';

export function recoveryTone(pct: number): RecoveryTone {
  if (pct >= 100) return 'ready';
  if (pct >= 80) return 'ok';
  if (pct >= 50) return 'mid';
  return 'low';
}

export const TONE_COLORS: Record<RecoveryTone, string> = {
  ready: '',
  ok: 'var(--green)',
  mid: 'var(--yellow)',
  low: 'var(--red)',
};
