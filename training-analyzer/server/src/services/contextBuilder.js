const { Op } = require('sequelize');
const { Workout, Settings, User } = require('../models');

const HISTORY_LIMIT = 10;
const HR_SERIES_BUCKETS = 12;
const SPLITS_LIMIT = 30;

function safeNum(n, decimals = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = parseFloat(n);
  if (!Number.isFinite(f)) return null;
  return Math.round(f * 10 ** decimals) / 10 ** decimals;
}

function downsampleSeries(series, buckets) {
  if (!Array.isArray(series) || series.length <= buckets) return series || [];
  const step = series.length / buckets;
  const out = [];
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = series.slice(start, end);
    if (!slice.length) continue;
    const hrAvg = slice.reduce((s, p) => s + (p.hr || 0), 0) / slice.length;
    out.push({ t: slice[Math.floor(slice.length / 2)].t, hr: Math.round(hrAvg) });
  }
  return out;
}

function summariseHrSeries(series) {
  if (!Array.isArray(series) || series.length < 4) return null;
  const hrs = series.map((p) => p.hr || 0).filter((v) => v > 0);
  if (hrs.length < 4) return null;
  const half = Math.floor(hrs.length / 2);
  const avg1 = hrs.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const avg2 = hrs.slice(half).reduce((a, b) => a + b, 0) / (hrs.length - half);
  const driftPct = avg1 > 0 ? Math.round(((avg2 - avg1) / avg1) * 1000) / 10 : 0;
  return {
    samples: hrs.length,
    firstHalfAvg: Math.round(avg1),
    secondHalfAvg: Math.round(avg2),
    driftPct,
  };
}

function summariseSplits(splits) {
  if (!Array.isArray(splits) || !splits.length) return null;
  const paces = splits.map((s) => s.pace).filter((v) => v > 0);
  if (paces.length < 2) return { count: splits.length };
  const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((a, b) => a + (b - avg) ** 2, 0) / paces.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? Math.round((stdDev / avg) * 1000) / 10 : 0;
  const firstThird = paces.slice(0, Math.ceil(paces.length / 3));
  const lastThird = paces.slice(-Math.ceil(paces.length / 3));
  const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
  const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
  return {
    count: splits.length,
    avgPaceSec: Math.round(avg),
    stdDevSec: Math.round(stdDev),
    cvPct: cv,
    firstThirdAvgSec: Math.round(firstAvg),
    lastThirdAvgSec: Math.round(lastAvg),
    pacingShift: lastAvg < firstAvg ? 'negative_split' : lastAvg > firstAvg ? 'positive_split' : 'even',
  };
}

function slimRunningWorkout(d) {
  const splitsSummary = summariseSplits(d.splits);
  const hrSummary = summariseHrSeries(d.hrSeries);
  return {
    type: 'running',
    distanceKm: safeNum(d.distance),
    durationMin: safeNum(d.duration, 0),
    avgPaceSec: safeNum(d._pace, 0) || (d.duration && d.distance ? Math.round((d.duration * 60) / d.distance) : null),
    avgHr: d.avghr || null,
    maxHr: d.maxhr || null,
    minHr: d.minhr || null,
    elevationGainM: d.elevation || null,
    rpe: d.rpe || null,
    cadence: d.cadence || null,
    notes: d.notes ? String(d.notes).slice(0, 200) : null,
    splitsSummary,
    splitsHead: Array.isArray(d.splits) ? d.splits.slice(0, SPLITS_LIMIT) : null,
    hrSeriesDownsampled: downsampleSeries(d.hrSeries, HR_SERIES_BUCKETS),
    hrSeriesSummary: hrSummary,
    scores: d.scores || null,
  };
}

function slimGymWorkout(d) {
  const exercises = Array.isArray(d.exercises) ? d.exercises : [];
  const slimExercises = exercises.map((ex) => {
    const sec = Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [];
    return {
      name: ex.name,
      muscle: ex.muscle || null,
      secondaryMuscles: sec,
      isUnilateral: !!ex.isUnilateral,
      weightMode: ex.weightMode || 'total',
      barbellWeight: ex.barbellWeight || 0,
      sets: (ex.sets || []).map((s) => {
        const out = {
          reps: s.reps || 0,
          weight: s.weight || 0,
          weightLeft: s.weightLeft || null,
          weightRight: s.weightRight || null,
          rpe: s.rpe || null,
        };
        if (s.bodyweight) out.bodyweight = true;
        if (Array.isArray(s.drops) && s.drops.length) {
          out.drops = s.drops.map((dr) => ({ reps: dr.reps || 0, weight: dr.weight || 0 }));
        }
        return out;
      }),
    };
  });
  const muscleSet = new Set();
  exercises.forEach((e) => {
    if (e.muscle) muscleSet.add(e.muscle);
    (e.secondaryMuscles || []).forEach((m) => { if (m) muscleSet.add(m); });
  });
  return {
    type: 'gym',
    durationMin: safeNum(d.duration, 0),
    rpe: d.rpe || null,
    notes: d.notes ? String(d.notes).slice(0, 200) : null,
    musclesHit: [...muscleSet],
    exercises: slimExercises,
    scores: d.scores || null,
  };
}

function slimKartingWorkout(d) {
  return {
    type: 'karting',
    track: d.track || null,
    durationMin: safeNum(d.duration, 0),
    bestLapSec: safeNum(d.bestLap, 3),
    avgLapSec: safeNum(d.avgLap, 3),
    laps: d.laps || null,
    rpe: d.rpe || null,
    notes: d.notes ? String(d.notes).slice(0, 200) : null,
    scores: d.scores || null,
  };
}

function slimGenericWorkout(d, type) {
  return {
    type,
    durationMin: safeNum(d.duration, 0),
    distanceKm: safeNum(d.distance) || null,
    avgHr: d.avghr || null,
    rpe: d.rpe || null,
    muscles: Array.isArray(d.muscles) ? d.muscles : null,
    notes: d.notes ? String(d.notes).slice(0, 200) : null,
    scores: d.scores || null,
  };
}

function slimWorkout(workout) {
  const d = workout.data || {};
  if (workout.type === 'running') return slimRunningWorkout(d);
  if (workout.type === 'gym') return slimGymWorkout(d);
  if (workout.type === 'karting') return slimKartingWorkout(d);
  return slimGenericWorkout(d, workout.type);
}

function slimHistoryEntry(workout, userBodyweight = 0) {
  const d = workout.data || {};
  const base = { date: workout.date, type: workout.type, score: workout.score };
  if (workout.type === 'running') {
    return {
      ...base,
      distanceKm: safeNum(d.distance),
      durationMin: safeNum(d.duration, 0),
      avgPaceSec: d._pace ? Math.round(d._pace) : (d.duration && d.distance ? Math.round((d.duration * 60) / d.distance) : null),
      avgHr: d.avghr || null,
      rpe: d.rpe || null,
    };
  }
  if (workout.type === 'gym') {
    const exs = Array.isArray(d.exercises) ? d.exercises : [];
    let tonnage = 0;
    exs.forEach((ex) => {
      const bw = ex.barbellWeight || 0;
      const wm = ex.weightMode || 'total';
      (ex.sets || []).forEach((s) => {
        const bodyAdd = s.bodyweight ? (userBodyweight || 0) : 0;
        if (ex.isUnilateral) {
          const wL = (s.weightLeft || 0) + bw + bodyAdd;
          const wR = (s.weightRight || 0) + bw + bodyAdd;
          tonnage += (s.reps || 0) * (wm === 'per_side' ? (wL + wR) * 2 : wL + wR);
        } else {
          let w = (s.weight || 0) + bodyAdd;
          if (wm === 'per_side') w *= 2;
          w += bw;
          tonnage += (s.reps || 0) * w;
          (s.drops || []).forEach((dr) => {
            let dw = (dr.weight || 0) + bodyAdd;
            if (wm === 'per_side') dw *= 2;
            dw += bw;
            tonnage += (dr.reps || 0) * dw;
          });
        }
      });
    });
    const muscleSet = new Set();
    exs.forEach((e) => {
      if (e.muscle) muscleSet.add(e.muscle);
      (e.secondaryMuscles || []).forEach((m) => { if (m) muscleSet.add(m); });
    });
    return {
      ...base,
      durationMin: safeNum(d.duration, 0),
      rpe: d.rpe || null,
      tonnageKg: Math.round(tonnage),
      muscles: [...muscleSet],
      exerciseCount: exs.length,
    };
  }
  if (workout.type === 'karting') {
    return {
      ...base,
      track: d.track || null,
      bestLapSec: safeNum(d.bestLap, 3),
      avgLapSec: safeNum(d.avgLap, 3),
      durationMin: safeNum(d.duration, 0),
      rpe: d.rpe || null,
    };
  }
  return {
    ...base,
    durationMin: safeNum(d.duration, 0),
    distanceKm: safeNum(d.distance) || null,
    avgHr: d.avghr || null,
    rpe: d.rpe || null,
  };
}

function buildUserProfile(user, settings) {
  if (!settings) return { age: null, gender: null, note: 'profilo non configurato' };
  return {
    age: settings.age || null,
    gender: settings.gender || null,
    heightCm: settings.height || null,
    weightKg: settings.bodyweight || null,
    maxHr: settings.maxhr || null,
    restHr: settings.resthr || null,
    vo2max: settings.vo2max || null,
    weeklyGoalSessions: settings.weekgoal || null,
    weeklyKmGoal: settings.kmgoal || null,
    activeSports: Array.isArray(settings.activeSports) ? settings.activeSports : null,
    plan: user?.plan || null,
  };
}

async function buildAnalysisContext({ userId, workoutId }) {
  const workout = await Workout.findOne({ where: { id: workoutId, userId } });
  if (!workout) {
    const err = new Error('Workout not found');
    err.status = 404;
    err.code = 'workout_not_found';
    throw err;
  }
  const [user, settings, history] = await Promise.all([
    User.findByPk(userId, { attributes: ['uid', 'plan'] }),
    Settings.findOne({ where: { userId } }),
    Workout.findAll({
      where: {
        userId,
        type: workout.type,
        id: { [Op.ne]: workout.id },
      },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: HISTORY_LIMIT,
    }),
  ]);

  const userBW = settings?.bodyweight || 0;
  return {
    workout,
    profile: buildUserProfile(user, settings),
    current: slimWorkout(workout),
    history: history.map((w) => slimHistoryEntry(w, userBW)),
  };
}

module.exports = { buildAnalysisContext, slimWorkout, slimHistoryEntry };
