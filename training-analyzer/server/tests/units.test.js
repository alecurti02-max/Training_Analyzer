// Unit tests on pure functions extracted in Fase 2.
// No DB, no env required beyond what setup.js provides for module-load safety.

require('./setup');

const test = require('node:test');
const assert = require('node:assert/strict');

const { safeNum, safeNumber } = require('../src/utils/safeNum');
const { tryParseJson } = require('../src/services/ai/jsonExtract');
const { downsampleSeries, summariseHrSeries } = require('../src/services/ai/hrSummary');
const { summariseSplits } = require('../src/services/ai/splitsSummary');
const { slimWorkout, slimHistoryEntry } = require('../src/services/ai/slimmers');
const { pickFieldsFromSpec } = require('../src/utils/crud');
const { parseWorkoutFile } = require('../src/services/workoutImporter');

// ── safeNum / safeNumber ──
test('safeNum returns null for invalid', () => {
  assert.equal(safeNum(null), null);
  assert.equal(safeNum(undefined), null);
  assert.equal(safeNum(NaN), null);
  assert.equal(safeNum('abc'), null);
});
test('safeNum rounds to decimals', () => {
  assert.equal(safeNum(1.2345, 2), 1.23);
  assert.equal(safeNum(1.2345, 0), 1);
});
test('safeNumber rounds with toFixed', () => {
  assert.equal(safeNumber(1.2345, 2), 1.23);
  assert.equal(safeNumber(null), null);
});

// ── tryParseJson ──
test('tryParseJson handles clean JSON', () => {
  assert.deepEqual(tryParseJson('{"a":1}'), { a: 1 });
});
test('tryParseJson strips ```json fences', () => {
  assert.deepEqual(tryParseJson('```json\n{"a":1}\n```'), { a: 1 });
});
test('tryParseJson recovers from preamble', () => {
  assert.deepEqual(tryParseJson('Ecco la risposta: {"a":1} grazie'), { a: 1 });
});
test('tryParseJson returns null when no JSON', () => {
  assert.equal(tryParseJson('hello world'), null);
  assert.equal(tryParseJson(''), null);
  assert.equal(tryParseJson(null), null);
});

// ── downsampleSeries ──
test('downsampleSeries returns input when shorter than buckets', () => {
  const series = [{ t: 0, hr: 100 }, { t: 1, hr: 110 }];
  assert.deepEqual(downsampleSeries(series, 12), series);
});
test('downsampleSeries reduces to N buckets', () => {
  const series = Array.from({ length: 60 }, (_, i) => ({ t: i, hr: 100 + i }));
  const out = downsampleSeries(series, 6);
  assert.equal(out.length, 6);
  assert.ok(out[0].hr < out[5].hr, 'monotonic series should yield monotonic buckets');
});

// ── summariseHrSeries ──
test('summariseHrSeries detects upward drift', () => {
  const series = Array.from({ length: 20 }, (_, i) => ({ t: i, hr: 130 + i }));
  const out = summariseHrSeries(series);
  assert.ok(out.driftPct > 0, 'rising HR should yield positive drift');
  assert.equal(out.samples, 20);
});
test('summariseHrSeries returns null for too few samples', () => {
  assert.equal(summariseHrSeries([{ t: 0, hr: 100 }, { t: 1, hr: 110 }]), null);
});

// ── summariseSplits ──
test('summariseSplits flags negative split (last third faster)', () => {
  const splits = Array.from({ length: 9 }, (_, i) => ({ pace: 360 - i * 5 })); // 360 → 320, faster over time
  const out = summariseSplits(splits);
  assert.equal(out.pacingShift, 'negative_split');
});
test('summariseSplits flags positive split (last third slower)', () => {
  const splits = Array.from({ length: 9 }, (_, i) => ({ pace: 320 + i * 5 }));
  const out = summariseSplits(splits);
  assert.equal(out.pacingShift, 'positive_split');
});
test('summariseSplits returns null for empty', () => {
  assert.equal(summariseSplits([]), null);
  assert.equal(summariseSplits(null), null);
});

// ── slimWorkout ──
test('slimWorkout running compacts the payload', () => {
  const w = {
    type: 'running',
    data: {
      distance: 10.5, duration: 50, avghr: 155, maxhr: 175, rpe: 7,
      splits: [{ pace: 300 }, { pace: 295 }],
      hrSeries: [],
      notes: 'sentirsi bene',
    },
  };
  const slim = slimWorkout(w);
  assert.equal(slim.type, 'running');
  assert.equal(slim.distanceKm, 10.5);
  assert.equal(slim.durationMin, 50);
  assert.equal(slim.avgHr, 155);
});
test('slimWorkout gym extracts muscles + sets', () => {
  const w = {
    type: 'gym',
    data: {
      duration: 60, rpe: 7,
      exercises: [
        { name: 'Panca', muscle: 'Petto', secondaryMuscles: ['Tricipiti'],
          sets: [{ reps: 8, weight: 60, rpe: 7 }] },
      ],
    },
  };
  const slim = slimWorkout(w);
  assert.equal(slim.type, 'gym');
  assert.deepEqual([...slim.musclesHit].sort(), ['Petto', 'Tricipiti']);
  assert.equal(slim.exercises.length, 1);
});

// ── slimHistoryEntry tonnage ──
test('slimHistoryEntry computes gym tonnage correctly', () => {
  const w = {
    type: 'gym',
    date: '2026-05-01',
    score: 8,
    data: {
      duration: 60, rpe: 8,
      exercises: [{
        name: 'Squat', muscle: 'Gambe',
        weightMode: 'total', isUnilateral: false, barbellWeight: 20,
        sets: [
          { reps: 5, weight: 80 }, // 5 * (80 + 20) = 500
          { reps: 5, weight: 80 }, // 500
        ],
      }],
    },
  };
  const slim = slimHistoryEntry(w, 0);
  assert.equal(slim.tonnageKg, 1000);
});
test('slimHistoryEntry handles unilateral per_side', () => {
  const w = {
    type: 'gym',
    date: '2026-05-01',
    score: 8,
    data: {
      exercises: [{
        name: 'Curl', muscle: 'Bicipiti',
        weightMode: 'per_side', isUnilateral: true, barbellWeight: 0,
        sets: [
          { reps: 10, weightLeft: 12, weightRight: 12 },
        ],
      }],
    },
  };
  const slim = slimHistoryEntry(w, 0);
  // unilateral + per_side: (wL+wR)*2 = (12+12)*2 = 48 ; reps*48 = 480
  assert.equal(slim.tonnageKg, 480);
});

// ── pickFieldsFromSpec ──
test('pickFieldsFromSpec rejects out-of-range numbers', () => {
  const spec = { numbers: [{ name: 'quality', min: 1, max: 10, integer: true }] };
  assert.deepEqual(pickFieldsFromSpec({ quality: 11 }, spec), {});
  assert.deepEqual(pickFieldsFromSpec({ quality: 0 }, spec), {});
  assert.deepEqual(pickFieldsFromSpec({ quality: 5 }, spec), { quality: 5 });
  assert.deepEqual(pickFieldsFromSpec({ quality: 5.7 }, spec), { quality: 6 }); // integer rounds
});
test('pickFieldsFromSpec nullifies empty strings/nulls', () => {
  const spec = { strings: [{ name: 'notes', maxLength: 100 }] };
  assert.deepEqual(pickFieldsFromSpec({ notes: '' }, spec), { notes: null });
  assert.deepEqual(pickFieldsFromSpec({ notes: null }, spec), { notes: null });
  assert.deepEqual(pickFieldsFromSpec({ notes: 'ciao' }, spec), { notes: 'ciao' });
});
test('pickFieldsFromSpec truncates strings to maxLength', () => {
  const spec = { strings: [{ name: 'notes', maxLength: 5 }] };
  assert.deepEqual(pickFieldsFromSpec({ notes: 'hello world' }, spec), { notes: 'hello' });
});

// ── parseWorkoutFile ──
test('parseWorkoutFile parses JSON workout', () => {
  const file = {
    originalname: 'export.json',
    buffer: Buffer.from(JSON.stringify({
      type: 'gym',
      date: '2026-01-15',
      scores: { overall: 7 },
      exercises: [],
    })),
  };
  const { records, ext } = parseWorkoutFile(file, 'user-uid');
  assert.equal(ext, 'json');
  assert.equal(records.length, 1);
  assert.equal(records[0].userId, 'user-uid');
  assert.equal(records[0].score, 7);
});
test('parseWorkoutFile parses CSV grouped by date', () => {
  const csv = [
    'date,exercise,sets,reps,weight,rpe',
    '2026-01-15,Squat,3,5,80,7',
    '2026-01-15,Bench,3,8,60,8',
    '2026-01-16,Deadlift,1,5,100,9',
  ].join('\n');
  const file = { originalname: 'log.csv', buffer: Buffer.from(csv) };
  const { records } = parseWorkoutFile(file, 'user-uid');
  assert.equal(records.length, 2);
  const day1 = records.find((r) => r.date === '2026-01-15');
  assert.equal(day1.data.exercises.length, 2);
  assert.equal(day1.data.rpe, 8); // max of rpe values
});
test('parseWorkoutFile throws on unsupported format', () => {
  const file = { originalname: 'foo.xlsx', buffer: Buffer.from('') };
  assert.throws(() => parseWorkoutFile(file, 'u'), /Unsupported file format/);
});
