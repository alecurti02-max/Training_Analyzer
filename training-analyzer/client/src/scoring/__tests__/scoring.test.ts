// Behavioral regression tests for scoring.ts.
// These check shape + a few golden values; not exhaustive, but catch any
// accidental change to the math/branching during refactors.

import { test, expect } from 'vitest';
import {
  calcTonnage,
  scoreWorkout,
  scoreGenericWorkout,
  scoreGymWorkout,
  scoreRunWorkout,
  scoreKartWorkout,
  getAdvice,
  getRecoveryStatus,
  calculateStreak,
  bodyCompositionSubScore,
  type CachedWorkout,
  type CachedGymWorkout,
  type CachedRunningWorkout,
  type CachedKartingWorkout,
} from '../scoring';

// ===== calcTonnage =====
test('calcTonnage: basic bilateral total', () => {
  const ex = [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 10, weight: 100 }] }];
  expect(calcTonnage(ex)).toBe(1000);
});

test('calcTonnage: per_side doubles weight', () => {
  const ex = [{ name: 'Lat machine', muscle: 'Schiena', weightMode: 'per_side' as const, sets: [{ reps: 8, weight: 30 }] }];
  expect(calcTonnage(ex)).toBe(8 * 30 * 2);
});

test('calcTonnage: barbellWeight added once per rep', () => {
  const ex = [{ name: 'Panca', muscle: 'Petto', barbellWeight: 20, sets: [{ reps: 5, weight: 60 }] }];
  expect(calcTonnage(ex)).toBe(5 * (60 + 20));
});

test('calcTonnage: bodyweight set adds userBodyweight', () => {
  const ex = [{ name: 'Dips', muscle: 'Petto', sets: [{ reps: 10, weight: 20, bodyweight: true }] }];
  expect(calcTonnage(ex, 80)).toBe(10 * (20 + 80));
});

test('calcTonnage: unilateral sums both sides', () => {
  const ex = [{ name: 'Curl Manubri', muscle: 'Bicipiti', isUnilateral: true, sets: [{ reps: 10, weightLeft: 15, weightRight: 15 }] }];
  expect(calcTonnage(ex)).toBe(10 * (15 + 15));
});

test('calcTonnage: drop sets accumulate', () => {
  const ex = [{
    name: 'Lat', muscle: 'Schiena',
    sets: [{ reps: 8, weight: 50, drops: [{ reps: 5, weight: 30 }, { reps: 5, weight: 20 }] }],
  }];
  expect(calcTonnage(ex)).toBe(8 * 50 + 5 * 30 + 5 * 20);
});

test('calcTonnage: empty/null returns 0', () => {
  expect(calcTonnage([])).toBe(0);
  expect(calcTonnage(null)).toBe(0);
  expect(calcTonnage(undefined)).toBe(0);
});

// ===== scoreGenericWorkout =====
test('scoreGenericWorkout: typical walking session', () => {
  const w: CachedWorkout = { id: '1', type: 'walking', date: '2026-05-01', duration: 30, rpe: 6 };
  const s = scoreGenericWorkout(w);
  expect(s.effort).toBe(6);
  expect(s.duration).toBe(7); // 30 is in [20,90]
  // overall = 6*.6 + 7*.4 = 3.6 + 2.8 = 6.4
  expect(s.overall).toBeCloseTo(6.4, 1);
});

test('scoreGenericWorkout: very short session penalized on duration', () => {
  const w: CachedWorkout = { id: '1', type: 'yoga', date: '2026-05-01', duration: 5, rpe: 4 };
  const s = scoreGenericWorkout(w);
  expect(s.duration).toBe(3); // <10 falls to else branch
});

// ===== scoreGymWorkout =====
test('scoreGymWorkout: returns full shape', () => {
  const w: CachedGymWorkout = {
    id: '1', type: 'gym', date: '2026-05-01', duration: 60, rpe: 7,
    exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 10, weight: 100 }] }],
  };
  const s = scoreGymWorkout(w, []);
  expect(s).toHaveProperty('volume');
  expect(s).toHaveProperty('intensity');
  expect(s).toHaveProperty('variety');
  expect(s).toHaveProperty('progression');
  expect(s).toHaveProperty('duration');
  expect(s).toHaveProperty('overall');
  expect(s.intensity).toBe(7);
  expect(s.duration).toBe(8); // 60 in [40,90]
  // _tonnage is cached on the workout
  expect(w._tonnage).toBe(1000);
});

// ===== scoreRunWorkout =====
test('scoreRunWorkout: returns full shape and caches _pace', () => {
  const w: CachedRunningWorkout = {
    id: '1', type: 'running', date: '2026-05-01',
    distance: 10, duration: 50, avghr: 150, rpe: 7,
  };
  const s = scoreRunWorkout(w, [], { maxhr: 190 });
  expect(s).toHaveProperty('distance');
  expect(s).toHaveProperty('pace');
  expect(s).toHaveProperty('hrEfficiency');
  expect(s).toHaveProperty('effort');
  expect(s).toHaveProperty('overall');
  expect(w._pace).toBe((50 * 60) / 10); // 300 s/km
  expect(s.effort).toBe(7);
});

// ===== scoreKartWorkout =====
test('scoreKartWorkout: consistency uses bestLap/avgLap', () => {
  const w: CachedKartingWorkout = {
    id: '1', type: 'karting', date: '2026-05-01',
    track: 'Vairano', bestLap: 50, avgLap: 52, rpe: 7,
  };
  const s = scoreKartWorkout(w, []);
  // bestLap/avgLap = 50/52 ≈ 0.962 → *10 ≈ 9.6 → round 10 → min(10) → 10
  expect(s.consistency).toBe(10);
  expect(s.effort).toBe(7);
  expect(s.improvement).toBe(6); // no history
});

// ===== scoreWorkout dispatcher =====
test('scoreWorkout dispatches by type', () => {
  const gym: CachedGymWorkout = {
    id: '1', type: 'gym', date: '2026-05-01', duration: 60, rpe: 7,
    exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 80 }] }],
  };
  expect(scoreWorkout(gym, []).overall).toBeGreaterThan(0);

  const run: CachedRunningWorkout = { id: '2', type: 'running', date: '2026-05-01', distance: 5, duration: 25, rpe: 6 };
  expect(scoreWorkout(run, []).overall).toBeGreaterThan(0);

  const generic: CachedWorkout = { id: '3', type: 'yoga', date: '2026-05-01', duration: 45, rpe: 4 };
  expect(scoreWorkout(generic, []).overall).toBeGreaterThan(0);
});

// ===== getAdvice =====
test('getAdvice: returns rules-shaped analysis for each sport', () => {
  const run: CachedRunningWorkout = { id: '1', type: 'running', date: '2026-05-01', distance: 8, duration: 40, avghr: 150, rpe: 6 };
  const a = getAdvice(run, [], { maxhr: 190 });
  expect(a.source).toBe('rules');
  expect(typeof a.summary).toBe('string');
  expect(Array.isArray(a.highlights)).toBe(true);
  expect(Array.isArray(a.suggestions)).toBe(true);
  expect(a.suggestions.length).toBeGreaterThan(0); // fallback always adds one
  expect(a.comparison_to_history).toHaveProperty('trend');

  const gym: CachedGymWorkout = {
    id: '2', type: 'gym', date: '2026-05-01', duration: 60, rpe: 7,
    exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 100 }] }],
  };
  expect(getAdvice(gym, []).source).toBe('rules');

  const kart: CachedKartingWorkout = { id: '3', type: 'karting', date: '2026-05-01', track: 'Vairano', bestLap: 50, avgLap: 51, rpe: 7 };
  expect(getAdvice(kart, []).source).toBe('rules');

  const generic: CachedWorkout = { id: '4', type: 'yoga', date: '2026-05-01', duration: 45, rpe: 4 };
  expect(getAdvice(generic, []).source).toBe('rules');
});

// ===== calculateStreak =====
test('calculateStreak: empty cache returns zero', () => {
  expect(calculateStreak([])).toEqual({ current: 0, record: 0 });
});

test('calculateStreak: 3 consecutive days records 3', () => {
  // Use dates ending today so 'current' counts them
  const today = new Date().toISOString().slice(0, 10);
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  const d2 = new Date(); d2.setDate(d2.getDate() - 2);
  const cache: CachedWorkout[] = [
    { id: '1', type: 'gym', date: today, exercises: [] },
    { id: '2', type: 'gym', date: d1.toISOString().slice(0, 10), exercises: [] },
    { id: '3', type: 'gym', date: d2.toISOString().slice(0, 10), exercises: [] },
  ];
  const s = calculateStreak(cache);
  expect(s.current).toBe(3);
  expect(s.record).toBe(3);
});

test('calculateStreak: gap breaks current but keeps record', () => {
  const cache: CachedWorkout[] = [
    { id: '1', type: 'gym', date: '2026-01-01', exercises: [] },
    { id: '2', type: 'gym', date: '2026-01-02', exercises: [] },
    { id: '3', type: 'gym', date: '2026-01-05', exercises: [] }, // gap of 2
  ];
  const s = calculateStreak(cache);
  expect(s.current).toBe(0); // last date is not today
  expect(s.record).toBe(2);
});

// ===== getRecoveryStatus =====
test('getRecoveryStatus: returns expected shape', () => {
  const today = new Date().toISOString().slice(0, 10);
  const cache: CachedWorkout[] = [
    {
      id: '1', type: 'gym', date: today, rpe: 7,
      exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 100 }] }],
    },
  ];
  const r = getRecoveryStatus(cache, ['Petto', 'Quadricipiti', 'Schiena', 'Full Body']);
  expect(r).toHaveProperty('muscleRecovery');
  expect(r).toHaveProperty('generalFatigue');
  expect(r).toHaveProperty('suggestedRestDays');
  expect(r).toHaveProperty('workoutsLast7');
  // Full Body filtered out
  expect(r.muscleRecovery).not.toHaveProperty('Full Body');
  // Quadricipiti was just worked (daysAgo 0), so pct = 0
  expect(r.muscleRecovery['Quadricipiti']?.pct).toBe(0);
  // Petto never worked → 99 days, 100%
  expect(r.muscleRecovery['Petto']?.daysAgo).toBe(99);
  expect(r.muscleRecovery['Petto']?.pct).toBe(100);
  expect(r.workoutsLast7).toBe(1);
});

// ===== bodyCompositionSubScore =====
test('bodyCompositionSubScore: gender-missing returns null score', () => {
  const r = bodyCompositionSubScore({ bodyweight: 80, height: 180 });
  expect(r.score).toBeNull();
  expect(r.reason).toBe('gender-missing');
});

test('bodyCompositionSubScore: BMI fallback when no waist', () => {
  // M, 75 kg, 175 cm → BMI ≈ 24.49 → normal range score 9
  const r = bodyCompositionSubScore({ gender: 'M', bodyweight: 75, height: 175 });
  expect(r.score).not.toBeNull();
  expect(r.components.some(c => c.key === 'bmi')).toBe(true);
});

test('bodyCompositionSubScore: WHTR preferred over BMI when waist known', () => {
  const r = bodyCompositionSubScore({ gender: 'M', bodyweight: 75, height: 175, circWaist: 80 });
  expect(r.components.some(c => c.key === 'whtr')).toBe(true);
  expect(r.components.some(c => c.key === 'bmi')).toBe(false);
});
