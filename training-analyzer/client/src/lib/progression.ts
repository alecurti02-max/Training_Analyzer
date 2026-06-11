// Matematica pura delle schede (CRM F2) — speculare a
// server/src/services/assignmentMath.js: tenere in sync.

export interface Progression {
  week: number;
  loadPct?: number;
  deload?: boolean;
  note?: string | null;
}

// Settimana corrente: 1-based, clampata in [1, weeks]. Date DATEONLY (YYYY-MM-DD).
export function weekOf(startDate: string, today: string, weeks: number): number {
  const ms = Date.parse(today) - Date.parse(startDate);
  const w = Math.floor(ms / (7 * 86400000)) + 1;
  return Math.max(1, Math.min(w, Math.max(1, weeks || 1)));
}

// Progressione applicabile a una settimana (default 100%, no deload).
export function progressionFor(progressions: Progression[] | null | undefined, week: number) {
  const p = (progressions || []).find((x) => x && x.week === week);
  return { loadPct: p?.loadPct ?? 100, deload: !!p?.deload, note: p?.note || null };
}

// Arrotonda al piattello (default 2.5 kg), mai sotto lo step.
export function roundToPlate(weight: number, step = 2.5): number {
  if (!Number.isFinite(weight) || weight <= 0) return weight;
  return Math.max(step, Math.round(weight / step) * step);
}

interface SetLike {
  weight?: number | string | null;
  weightLeft?: number | string | null;
  weightRight?: number | string | null;
  drops?: SetLike[];
  [k: string]: unknown;
}

interface ExerciseLike {
  param?: string;
  sets?: SetLike[];
  [k: string]: unknown;
}

function adjustSet(s: SetLike, factor: number): SetLike {
  const out: SetLike = { ...s };
  for (const k of ['weight', 'weightLeft', 'weightRight'] as const) {
    const raw = out[k];
    const v = Number(raw);
    if (raw != null && raw !== '' && Number.isFinite(v) && v > 0) {
      out[k] = roundToPlate(v * factor);
    }
  }
  if (Array.isArray(out.drops)) out.drops = out.drops.map((d) => adjustSet(d, factor));
  return out;
}

// Applica la progressione settimanale ai carichi: moltiplica weight/weightLeft/
// weightRight (e i drop set) e arrotonda al piattello. Esercizi non a carico
// (param ≠ reps) e set a corpo libero (peso assente/0) restano invariati.
// Ritorna sempre copie nuove (mai mutare il template della scheda).
export function applyProgression(exercises: ExerciseLike[], loadPct: number): ExerciseLike[] {
  const factor = (Number(loadPct) || 100) / 100;
  return (exercises || []).map((e) => {
    const copy: ExerciseLike = { ...e, sets: (e.sets || []).map((s) => ({ ...s })) };
    if (factor === 1) return copy;
    if (e.param && e.param !== 'reps') return copy;
    copy.sets = (e.sets || []).map((s) => adjustSet(s, factor));
    return copy;
  });
}
