import { describe, it, expect } from 'vitest';
import { weekOf, progressionFor, roundToPlate, applyProgression } from '../progression';

describe('weekOf', () => {
  it('clampa ai bordi e avanza ogni 7 giorni', () => {
    expect(weekOf('2026-06-01', '2026-05-20', 4)).toBe(1);
    expect(weekOf('2026-06-01', '2026-06-01', 4)).toBe(1);
    expect(weekOf('2026-06-01', '2026-06-07', 4)).toBe(1);
    expect(weekOf('2026-06-01', '2026-06-08', 4)).toBe(2);
    expect(weekOf('2026-06-01', '2026-12-01', 4)).toBe(4);
  });
});

describe('progressionFor', () => {
  const prog = [{ week: 2, loadPct: 105 }, { week: 4, loadPct: 60, deload: true }];
  it('settimana assente → 100%, no deload', () => {
    expect(progressionFor(prog, 1)).toEqual({ loadPct: 100, deload: false, note: null });
  });
  it('legge loadPct e deload', () => {
    expect(progressionFor(prog, 2).loadPct).toBe(105);
    expect(progressionFor(prog, 4).deload).toBe(true);
  });
});

describe('roundToPlate', () => {
  it('arrotonda a 2.5 e non scende sotto lo step', () => {
    expect(roundToPlate(61.2)).toBe(60); // 24.48 → 24 piattelli
    expect(roundToPlate(61.3)).toBe(62.5); // 24.52 → 25 piattelli
    expect(roundToPlate(63.7)).toBe(62.5);
    expect(roundToPlate(1)).toBe(2.5);
    expect(roundToPlate(0)).toBe(0);
  });
});

describe('applyProgression', () => {
  const exercises = [
    {
      name: 'Panca', muscle: 'Petto', param: 'reps',
      sets: [
        { reps: 8, weight: 60 },
        { reps: 8, weight: '', drops: [{ reps: 5, weight: 40 }] },
      ],
    },
    { name: 'Plank', muscle: 'Core', param: 'duration', sets: [{ duration: 60, weight: 20 }] },
    { name: 'Trazioni', muscle: 'Schiena', param: 'reps', sets: [{ reps: 6, weight: 0 }] },
  ];

  it('105% → pesi scalati e arrotondati a 2.5', () => {
    const out = applyProgression(exercises, 105);
    expect(out[0].sets![0].weight).toBe(62.5); // 63 → 62.5
    expect((out[0].sets![1].drops as any)[0].weight).toBe(42.5); // 42 → 42.5
  });

  it('non tocca param ≠ reps né set a corpo libero', () => {
    const out = applyProgression(exercises, 150);
    expect(out[1].sets![0].weight).toBe(20); // duration: invariato
    expect(out[2].sets![0].weight).toBe(0); // bodyweight: invariato
    expect(out[0].sets![1].weight).toBe(''); // peso vuoto: invariato
  });

  it('100% → copia identica ma NON la stessa reference', () => {
    const out = applyProgression(exercises, 100);
    expect(out[0].sets![0].weight).toBe(60);
    expect(out[0]).not.toBe(exercises[0]);
    expect(out[0].sets![0]).not.toBe(exercises[0].sets![0]);
  });

  it('deload 60% → carichi ridotti', () => {
    const out = applyProgression(exercises, 60);
    expect(out[0].sets![0].weight).toBe(35); // 36 → 35
  });
});
