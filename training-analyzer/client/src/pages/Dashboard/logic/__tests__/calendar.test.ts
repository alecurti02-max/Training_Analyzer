import { describe, it, expect } from 'vitest';
import {
  localDateStr, monthGrid, lastNMonths, indexWorkouts, intensityLevel,
} from '../calendar';

describe('localDateStr', () => {
  it('usa la data locale, non UTC', () => {
    // 23:30 locale: toISOString() sposterebbe al giorno dopo in TZ negative
    // o resterebbe — localDateStr deve restituire SEMPRE il giorno locale.
    const d = new Date(2026, 5, 12, 23, 30);
    expect(localDateStr(d)).toBe('2026-06-12');
  });
  it('padda mese e giorno a 2 cifre', () => {
    expect(localDateStr(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('monthGrid', () => {
  it('febbraio 2026 inizia di domenica → 6 null di padding lunedì-first', () => {
    const g = monthGrid(2026, 1);
    expect(g.weeks[0]).toEqual([null, null, null, null, null, null, '2026-02-01']);
    expect(g.label).toBe('Febbraio 2026');
  });
  it('febbraio 2024 è bisestile (29 giorni)', () => {
    const g = monthGrid(2024, 1);
    const days = g.weeks.flat().filter(Boolean);
    expect(days.length).toBe(29);
    expect(days[28]).toBe('2024-02-29');
  });
  it('giugno 2026: 1° di lunedì, nessun padding iniziale, ultima settimana paddata', () => {
    const g = monthGrid(2026, 5);
    expect(g.weeks[0][0]).toBe('2026-06-01');
    const last = g.weeks[g.weeks.length - 1];
    expect(last.length).toBe(7);
    expect(last[1]).toBe('2026-06-30');
    expect(last[2]).toBeNull();
  });
});

describe('lastNMonths', () => {
  it('mese corrente per ultimo', () => {
    expect(lastNMonths('2026-06-12', 3)).toEqual([
      { year: 2026, month: 3 }, { year: 2026, month: 4 }, { year: 2026, month: 5 },
    ]);
  });
  it('attraversa il cambio anno (gennaio → nov/dic precedenti)', () => {
    expect(lastNMonths('2026-01-05', 3)).toEqual([
      { year: 2025, month: 10 }, { year: 2025, month: 11 }, { year: 2026, month: 0 },
    ]);
  });
});

describe('indexWorkouts', () => {
  it('conta, deduplica i tipi e tiene il max score per giorno', () => {
    const map = indexWorkouts([
      { date: '2026-06-10', type: 'gym', scores: { overall: 6.2 } },
      { date: '2026-06-10', type: 'gym', scores: { overall: 7.8 } },
      { date: '2026-06-10', type: 'running' },
      { date: '2026-06-11', type: 'running', scores: { overall: 5 } },
    ]);
    expect(map.get('2026-06-10')).toEqual({ count: 3, types: ['gym', 'running'], best: 7.8 });
    expect(map.get('2026-06-11')!.best).toBe(5);
    expect(map.has('2026-06-12')).toBe(false);
  });
});

describe('intensityLevel', () => {
  it('replica la scala della vecchia heatmap', () => {
    expect(intensityLevel(null)).toBe(1);
    expect(intensityLevel(4.9)).toBe(1);
    expect(intensityLevel(5)).toBe(2);
    expect(intensityLevel(6.9)).toBe(2);
    expect(intensityLevel(7)).toBe(3);
    expect(intensityLevel(8.4)).toBe(3);
    expect(intensityLevel(8.5)).toBe(4);
    expect(intensityLevel(10)).toBe(4);
  });
});
