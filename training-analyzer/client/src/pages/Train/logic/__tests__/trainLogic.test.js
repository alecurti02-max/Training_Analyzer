// Characterization tests for the Train logic modules (setModel / buildWorkout /
// liveTimer). These pin the behaviour extracted from the legacy js/ui.js wizard +
// live session, so the Preact migration (and any future edit) can't silently
// change the set model, the saved payload shape, the timer maths, or — most
// importantly — the resulting workout SCORE.
//
// The score-parity test reproduces a legacy gym save end-to-end and asserts the
// output equals the golden value in scoring.characterization.test.ts (8.4).

import { test, expect } from 'vitest';
import * as SM from '../setModel.js';
import * as BW from '../buildWorkout.js';
import * as LT from '../liveTimer.js';
import { scoreWorkout, getAdvice, calcTonnage } from '@/scoring';
import { FIELD_DEFS } from '../../../../../js/sports.js';

const bilatEx = { name: 'Squat', param: 'reps', isUnilateral: false, weightMode: 'total' };
const uniEx = { name: 'Curl', param: 'reps', isUnilateral: true };

// ───── setModel ─────
test('makeEmptySet: bilateral / unilateral / live adds done', () => {
  expect(SM.makeEmptySet(bilatEx)).toEqual({ reps: '', weight: '', rpe: null, bodyweight: false });
  expect(SM.makeEmptySet(uniEx)).toEqual({ reps: '', weightLeft: '', weightRight: '', rpe: null, bodyweight: false });
  expect(SM.makeEmptySet(bilatEx, { live: true })).toEqual({ reps: '', weight: '', rpe: null, bodyweight: false, done: false });
});

test('copySetFromLast: keeps drops bilateral, drops them for live, splits weight to unilateral', () => {
  const prev = { reps: 8, weight: 50, rpe: 7, bodyweight: false, drops: [{ reps: 5, weight: 30 }] };
  expect(SM.copySetFromLast(prev, bilatEx)).toEqual({ reps: 8, weight: 50, rpe: 7, bodyweight: false, drops: [{ reps: 5, weight: 30 }] });
  expect(SM.copySetFromLast(prev, bilatEx, { live: true })).toEqual({ reps: 8, weight: 50, rpe: 7, bodyweight: false, done: false });
  expect(SM.copySetFromLast({ reps: 10, weight: 20 }, uniEx)).toEqual({ reps: 10, weightLeft: 20, weightRight: 20, rpe: null, bodyweight: false });
});

test('addSet seeds from last and is immutable; removeSet last → one empty', () => {
  const sets = [{ reps: 5, weight: 100, rpe: 8, bodyweight: false }];
  expect(SM.addSet(sets, bilatEx)).toEqual([sets[0], { reps: 5, weight: 100, rpe: 8, bodyweight: false }]);
  expect(SM.addSet(sets, bilatEx)).not.toBe(sets);
  expect(SM.removeSet(sets, 0, bilatEx)).toEqual([{ reps: '', weight: '', rpe: null, bodyweight: false }]);
});

test('updateSetField coerces reps/weight/rpe', () => {
  expect(SM.updateSetField({ reps: '', weight: '' }, 'reps', '8')).toEqual({ reps: 8, weight: '' });
  expect(SM.updateSetField({ reps: 5 }, 'weight', '52.5')).toEqual({ reps: 5, weight: 52.5 });
  expect(SM.updateSetField({ reps: 5 }, 'rpe', '0')).toEqual({ reps: 5, rpe: null });
});

test('drops add/remove/update', () => {
  expect(SM.addDrop({ reps: 8, weight: 50 })).toEqual({ reps: 8, weight: 50, drops: [{ reps: 8, weight: 50 }] });
  expect(SM.removeDrop({ reps: 8, weight: 50, drops: [{ reps: 5, weight: 30 }] }, 0)).toEqual({ reps: 8, weight: 50 });
  expect(SM.updateDropField({ reps: 8, drops: [{ reps: 5, weight: 30 }] }, 0, 'weight', '25')).toEqual({ reps: 8, drops: [{ reps: 5, weight: 25 }] });
});

test('applyWeightOption: toggling unilateral remaps every set', () => {
  const ex = { name: 'P', param: 'reps', isUnilateral: false, weightMode: 'total', sets: [{ reps: 8, weight: 40, rpe: 7, bodyweight: false }] };
  expect(SM.applyWeightOption(ex, 'isUnilateral', true).sets).toEqual([{ reps: 8, weightLeft: 40, weightRight: 40, rpe: 7, bodyweight: false }]);
  expect(SM.applyWeightOption(ex, 'barbellSel', '20').barbellWeight).toBe(20);
  expect(SM.applyWeightOption(ex, 'barbellSel', '').barbellWeight).toBe(null);
});

test('completeSet: appends fresh set only when no undone set remains', () => {
  const r1 = SM.completeSet([{ reps: 8, weight: 50, done: false }], 0, bilatEx);
  expect(r1.appended).toBe(true);
  expect(r1.sets.map((s) => s.done)).toEqual([true, false]);
  const r2 = SM.completeSet([{ reps: 8, done: false }, { reps: 8, done: false }], 0, bilatEx);
  expect(r2.appended).toBe(false);
});

// ───── buildWorkout ─────
test('buildGymWorkout filters empty sets and shapes output', () => {
  const ex = [{ name: 'Squat', muscle: 'Quadricipiti', secondaryMuscles: [], weightMode: 'total', barbellWeight: null, isUnilateral: false, param: 'reps', sets: [{ reps: 5, weight: 100, rpe: 8, bodyweight: false }, { reps: 0, weight: 0 }] }];
  const built = BW.buildGymWorkout(ex, { id: 'x', date: '2026-05-10', duration: 60, rpe: 8, notes: 'hi' });
  expect(built.exercises[0].sets).toEqual([{ reps: 5, weight: 100, rpe: 8 }]);
});

test('buildGymWorkout onlyDone keeps only completed sets (live)', () => {
  const ex = [{ name: 'Panca', muscle: 'Petto', secondaryMuscles: [], weightMode: 'total', barbellWeight: 20, isUnilateral: false, param: 'reps', sets: [{ reps: 5, weight: 60, rpe: null, done: true }, { reps: 5, weight: 60, done: false }] }];
  const built = BW.buildGymWorkout(ex, { id: 'y', date: '2026-05-11', duration: 45, rpe: 7, notes: '' }, { onlyDone: true });
  expect(built.exercises[0].sets).toEqual([{ reps: 5, weight: 60, rpe: null }]);
});

test('countSkippedSets: conta solo le serie con dati e non "Fatto" (specchio del filtro onlyDone)', () => {
  const ex = [{
    name: 'Panca', param: 'reps', isUnilateral: false,
    sets: [
      { reps: 5, weight: 60, done: true },   // salvata → non conta
      { reps: 5, weight: 60, done: false },  // dati + non fatta → conta
      { reps: 0, weight: 0, done: false },   // vuota → non conta (come il filtro)
      { reps: '', weight: '', done: false }, // vuota (stringhe) → non conta
    ],
  }, {
    name: 'Curl', param: 'reps', isUnilateral: true,
    sets: [{ reps: 10, weightLeft: 12, weightRight: 12, done: false }], // conta
  }];
  expect(BW.countSkippedSets(ex)).toBe(2);
  expect(BW.countSkippedSets([])).toBe(0);
  expect(BW.countSkippedSets(null)).toBe(0);
});

test('buildSportWorkout running: pace → paceInput + numeric _pace, pace removed', () => {
  const w = BW.buildSportWorkout('running', { distance: '10', duration: '50', pace: '5:00', avghr: '150' }, { id: 'r', date: '2026-05-10', notes: '' }, FIELD_DEFS);
  expect(w.pace).toBeUndefined();
  expect(w.paceInput).toBe('5:00');
  expect(w._pace).toBe(300);
  expect(w.distance).toBe(10);
});

test('SCORE PARITY: a gym save reproduces the P0 fixture score (8.4)', () => {
  const HISTORY = [
    { id: 'h1', type: 'gym', date: '2026-05-01', duration: 55, rpe: 7, exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 90 }] }, { name: 'Panca', muscle: 'Petto', barbellWeight: 20, sets: [{ reps: 5, weight: 50 }] }], _tonnage: 800 },
    { id: 'h2', type: 'gym', date: '2026-05-04', duration: 60, rpe: 7, exercises: [{ name: 'Squat', muscle: 'Quadricipiti', sets: [{ reps: 5, weight: 95 }] }], _tonnage: 475 },
  ];
  const SETTINGS = { gender: 'M', bodyweight: 80, height: 180, maxhr: 190 };
  const ex = [
    { name: 'Squat', muscle: 'Quadricipiti', secondaryMuscles: [], weightMode: 'total', barbellWeight: null, isUnilateral: false, param: 'reps', sets: [{ reps: 5, weight: 100, rpe: null, bodyweight: false }, { reps: 5, weight: 100, rpe: null, bodyweight: false }] },
    { name: 'Panca', muscle: 'Petto', secondaryMuscles: [], weightMode: 'total', barbellWeight: 20, isUnilateral: false, param: 'reps', sets: [{ reps: 5, weight: 60, rpe: null, bodyweight: false }] },
  ];
  const built = BW.buildGymWorkout(ex, { id: 't1', date: '2026-05-10', duration: 60, rpe: 8, notes: '' });
  BW.attachScores(built, { workoutsCache: HISTORY, settings: SETTINGS, calcTonnage, scoreWorkout, getAdvice });
  expect(built.scores).toEqual({ volume: 10, intensity: 8, variety: 4, progression: 10, duration: 8, overall: 8.4 });
});

// ───── liveTimer ─────
test('getElapsed is timestamp-based and freezes when paused', () => {
  expect(LT.getElapsed({ startTime: 1000, totalPaused: 0, paused: false }, 61000)).toBe(60);
  expect(LT.getElapsed({ startTime: 1000, totalPaused: 5000, paused: false }, 66000)).toBe(60);
  expect(LT.getElapsed({ startTime: 1000, totalPaused: 0, paused: true, pausedAt: 31000 }, 99999)).toBe(30);
});

test('togglePause and offline-gap resume adjust totalPaused correctly', () => {
  const resumed = LT.togglePause({ startTime: 0, totalPaused: 0, paused: true, pausedAt: 10000 }, 15000);
  expect(resumed.paused).toBe(false);
  expect(resumed.totalPaused).toBe(5000);
  const adj = LT.adjustResumedDraft({ startTime: 0, totalPaused: 1000, paused: false, _lastSavedAt: 50000 }, 80000);
  expect(adj.totalPaused).toBe(31000); // +30s offline gap
  const adjPaused = LT.adjustResumedDraft({ startTime: 0, totalPaused: 1000, paused: true, pausedAt: 40000, _lastSavedAt: 50000 }, 80000);
  expect(adjPaused.totalPaused).toBe(1000); // paused → unchanged
});

test('rest ring maths', () => {
  expect(LT.formatTime(3661)).toBe('01:01:01');
  expect(LT.restDashoffset(45, 90)).toBeCloseTo(339.292 * 0.5, 3);
  expect(LT.clampRestPreset('5')).toBe(15);
  expect(LT.clampRestPreset('999')).toBe(600);
  expect(LT.restClock(90)).toBe('1:30');
});
