import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del client HTTP: gli store di recovery fanno POST/DELETE e poi aggiornano
// il signal. Verifichiamo la logica upsert-per-data + sort + remove sul signal.
const post = vi.fn();
const del = vi.fn(() => Promise.resolve());
vi.mock('@/lib/api', () => ({ api: { get: () => Promise.resolve([]), post: (...a: any[]) => post(...a), del: (...a: any[]) => del(...a) } }));

import { nutrition, saveNutrition, deleteNutrition } from '../nutrition';
import { sleep, saveSleep, deleteSleep } from '../sleep';

beforeEach(() => { nutrition.value = []; sleep.value = []; post.mockReset(); del.mockClear(); });

describe('nutrition store', () => {
  it('saveNutrition: inserisce, fa upsert per data, mantiene l\'ordine crescente', async () => {
    post.mockResolvedValueOnce({ id: 'a', date: '2026-06-10', calories: 2000 });
    await saveNutrition({ date: '2026-06-10', calories: 2000 });
    post.mockResolvedValueOnce({ id: 'b', date: '2026-06-01', calories: 1800 });
    await saveNutrition({ date: '2026-06-01', calories: 1800 });
    expect(nutrition.value.map((r) => r.date)).toEqual(['2026-06-01', '2026-06-10']);
    // upsert: stessa data → sostituisce, niente duplicati
    post.mockResolvedValueOnce({ id: 'a2', date: '2026-06-10', calories: 2200 });
    await saveNutrition({ date: '2026-06-10', calories: 2200 });
    expect(nutrition.value).toHaveLength(2);
    expect(nutrition.value.find((r) => r.date === '2026-06-10')!.calories).toBe(2200);
  });

  it('deleteNutrition: rimuove per id dal signal', async () => {
    nutrition.value = [{ id: 'x', date: '2026-06-10' }, { id: 'y', date: '2026-06-11' }];
    await deleteNutrition('x');
    expect(nutrition.value.map((r) => r.id)).toEqual(['y']);
    expect(del).toHaveBeenCalledWith('/api/nutrition/x');
  });
});

describe('sleep store', () => {
  it('saveSleep: upsert per data + sort; deleteSleep rimuove per id', async () => {
    post.mockResolvedValueOnce({ id: 's1', date: '2026-06-11', durationHours: 7 });
    await saveSleep({ date: '2026-06-11', durationHours: 7 });
    post.mockResolvedValueOnce({ id: 's0', date: '2026-06-09', durationHours: 8 });
    await saveSleep({ date: '2026-06-09', durationHours: 8 });
    expect(sleep.value.map((r) => r.date)).toEqual(['2026-06-09', '2026-06-11']);
    await deleteSleep('s1');
    expect(sleep.value.map((r) => r.id)).toEqual(['s0']);
    expect(del).toHaveBeenCalledWith('/api/sleep/s1');
  });
});
