// Logica pura del Calendario Allenamenti (griglie mensili, ultimi 3 mesi).
// Tutte le date sono stringhe YYYY-MM-DD in ora LOCALE: mai toISOString(),
// che a cavallo di mezzanotte sposta il giorno (bug latente della vecchia heatmap).

export const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
export const DAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function localDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface MonthGrid {
  year: number;
  month: number; // 0-based
  label: string; // "Giugno 2026"
  weeks: (string | null)[][]; // settimane lunedì-first, null = padding
}

export function monthGrid(year: number, month: number): MonthGrid {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=domenica → lunedì-first: 0=lunedì
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(localDateStr(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, label: `${MONTH_LABELS[month]} ${year}`, weeks };
}

// Mese corrente + i (n-1) precedenti, dal più vecchio al più recente.
// today è una stringa YYYY-MM-DD: niente parsing via Date (sarebbe UTC).
export function lastNMonths(today: string, n = 3): { year: number; month: number }[] {
  const [y, m] = today.split('-').map(Number);
  const out: { year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const idx = m - 1 - i;
    out.push({ year: y + Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 });
  }
  return out;
}

export interface DayInfo {
  count: number;
  types: string[];
  best: number | null; // max scores.overall del giorno
}

export function indexWorkouts(
  workouts: { date: string; type: string; scores?: { overall?: number } }[]
): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const w of workouts) {
    const info = map.get(w.date) || { count: 0, types: [], best: null };
    info.count++;
    if (!info.types.includes(w.type)) info.types.push(w.type);
    const s = w.scores?.overall;
    if (typeof s === 'number' && (info.best === null || s > info.best)) info.best = s;
    map.set(w.date, info);
  }
  return map;
}

// Livello di intensità 0–4 con la stessa scala della vecchia heatmap.
export function intensityLevel(best: number | null): 0 | 1 | 2 | 3 | 4 {
  if (best === null) return 1; // giorno allenato ma senza score
  if (best < 5) return 1;
  if (best < 7) return 2;
  if (best < 8.5) return 3;
  return 4;
}
