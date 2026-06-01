// Characterization fixture for the SAVE-FLOW scoring entry point.
//
// Purpose: pin the exact `scoreWorkout()` output for a set of realistic workout
// payloads (the same shapes the Train wizard / live session build before POSTing).
// Phases P3 (state→signals) and P4 (Train→Preact) move the save/score CALL SITES
// without touching scoring.ts — these golden values fail if the arguments handed to
// scoreWorkout ever drift, which is exactly the regression the project's CLAUDE.md
// mandates guarding before touching save/score.
//
// Golden values are asserted explicitly (not via toMatchSnapshot) so the fixture is
// self-contained and reviewable in the diff. Only `scoreWorkout` is pinned: it is
// wall-clock-free (deterministic). `getAdvice` reads todayStr() and is therefore
// time-dependent, so it is only checked structurally here (golden advice values for
// fixed inputs live in scoring.test.ts).

import { test, expect } from 'vitest';
import {
  scoreWorkout,
  getAdvice,
  type CachedWorkout,
  type CachedGymWorkout,
  type CachedRunningWorkout,
  type CachedKartingWorkout,
} from '../scoring';

const SETTINGS = { gender: 'M' as const, bodyweight: 80, height: 180, maxhr: 190 };

// Fixed history with the cached fields the app keeps (_tonnage on gym, _pace on
// running) so volume/progression/distance/pace/improvement sub-scores engage
// deterministically. Dates are absolute and never compared to "today" by scoreWorkout.
const HISTORY: CachedWorkout[] = [
  {
    id: 'h1', type: 'gym', date: '2026-05-01', duration: 55, rpe: 7,
    exercises: [
      { name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 90 }] },
      { name: 'Panca', muscle: 'Petto', barbellWeight: 20, sets: [{ reps: 5, weight: 50 }] },
    ],
    _tonnage: 5 * 90 + 5 * (50 + 20), // 800
  } as CachedGymWorkout,
  {
    id: 'h2', type: 'gym', date: '2026-05-04', duration: 60, rpe: 7,
    exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 95 }] }],
    _tonnage: 5 * 95, // 475
  } as CachedGymWorkout,
  { id: 'h3', type: 'running', date: '2026-05-02', distance: 8, duration: 44, avghr: 148, rpe: 6, _pace: (44 * 60) / 8 } as CachedRunningWorkout,
  { id: 'h4', type: 'running', date: '2026-05-05', distance: 9, duration: 49, avghr: 150, rpe: 6, _pace: (49 * 60) / 9 } as CachedRunningWorkout,
  { id: 'h5', type: 'karting', date: '2026-05-03', track: 'Vairano', bestLap: 51, avgLap: 53, rpe: 7 } as CachedKartingWorkout,
];

// Representative targets: every gym calcTonnage branch + every sport dispatch path.
// `expected` captured from the current scoring.ts (verified deterministic).
const TARGETS: { label: string; w: CachedWorkout; expected: Record<string, number> }[] = [
  {
    label: 'gym — progression vs history (bilateral + barbell)',
    w: {
      id: 't1', type: 'gym', date: '2026-05-10', duration: 60, rpe: 8,
      exercises: [
        { name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }] },
        { name: 'Panca', muscle: 'Petto', barbellWeight: 20, sets: [{ reps: 5, weight: 60 }] },
      ],
    } as CachedGymWorkout,
    expected: { volume: 10, intensity: 8, variety: 4, progression: 10, duration: 8, overall: 8.4 },
  },
  {
    label: 'gym — mixed sets (per_side + unilateral + bodyweight + drops)',
    w: {
      id: 't2', type: 'gym', date: '2026-05-11', duration: 75, rpe: 7,
      exercises: [
        { name: 'Lat machine', muscle: 'Schiena', weightMode: 'per_side', sets: [{ reps: 8, weight: 30, drops: [{ reps: 5, weight: 20 }] }] },
        { name: 'Curl Manubri', muscle: 'Bicipiti', isUnilateral: true, sets: [{ reps: 10, weightLeft: 15, weightRight: 14 }] },
        { name: 'Dips', muscle: 'Petto', sets: [{ reps: 10, weight: 0, bodyweight: true }] },
      ],
    } as CachedGymWorkout,
    expected: { volume: 10, intensity: 7, variety: 6, progression: 6, duration: 8, overall: 7.5 },
  },
  {
    label: 'gym — minimal, no history match (progression fallback, short duration)',
    w: {
      id: 't3', type: 'gym', date: '2026-05-12', duration: 25, rpe: 6,
      exercises: [{ name: 'Plank', muscle: 'Core', sets: [{ reps: 1, weight: 0 }] }],
    } as CachedGymWorkout,
    expected: { volume: 1, intensity: 6, variety: 3, progression: 6, duration: 4, overall: 4.1 },
  },
  {
    label: 'running — with HR, longer than history',
    w: { id: 't4', type: 'running', date: '2026-05-10', distance: 10, duration: 50, avghr: 150, rpe: 7 } as CachedRunningWorkout,
    expected: { distance: 8, pace: 8, hrEfficiency: 7, effort: 7, overall: 7.6 },
  },
  {
    label: 'running — short and fast, high HR',
    w: { id: 't5', type: 'running', date: '2026-05-11', distance: 3, duration: 15, avghr: 165, rpe: 8 } as CachedRunningWorkout,
    expected: { distance: 3, pace: 8, hrEfficiency: 6, effort: 8, overall: 6.3 },
  },
  {
    label: 'karting — new best vs history',
    w: { id: 't6', type: 'karting', date: '2026-05-10', track: 'Vairano', bestLap: 50, avgLap: 52, rpe: 7 } as CachedKartingWorkout,
    expected: { consistency: 10, improvement: 9, effort: 7, overall: 8.9 },
  },
  {
    label: 'generic — yoga (low effort, mid duration)',
    w: { id: 't7', type: 'yoga', date: '2026-05-10', duration: 45, rpe: 4 },
    expected: { effort: 4, duration: 7, overall: 5.2 },
  },
  {
    label: 'generic — cycling (high effort, long duration)',
    w: { id: 't8', type: 'cycling', date: '2026-05-10', duration: 120, rpe: 8 },
    expected: { effort: 8, duration: 5, overall: 6.8 },
  },
];

for (const { label, w, expected } of TARGETS) {
  test(`scoreWorkout golden — ${label}`, () => {
    // Clone so the _tonnage/_pace side-effects don't leak between runs.
    const scored = scoreWorkout(structuredClone(w), HISTORY, SETTINGS);
    expect(scored).toEqual(expected);
    // Advice is time-dependent (todayStr); only assert it stays rules-shaped.
    const advice = getAdvice(structuredClone(w), HISTORY, SETTINGS);
    expect(advice.source).toBe('rules');
    expect(typeof advice.summary).toBe('string');
    expect(Array.isArray(advice.suggestions)).toBe(true);
  });
}
