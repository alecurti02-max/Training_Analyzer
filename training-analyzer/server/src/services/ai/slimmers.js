const { safeNum } = require('../../utils/safeNum');
const { downsampleSeries, summariseHrSeries } = require('./hrSummary');
const { summariseSplits } = require('./splitsSummary');

const SPLITS_LIMIT = 30;

function slimRunningWorkout(d) {
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
    splitsSummary: summariseSplits(d.splits),
    splitsHead: Array.isArray(d.splits) ? d.splits.slice(0, SPLITS_LIMIT) : null,
    hrSeriesDownsampled: downsampleSeries(d.hrSeries),
    hrSeriesSummary: summariseHrSeries(d.hrSeries),
    scores: d.scores || null,
  };
}

function slimGymWorkout(d) {
  const exercises = Array.isArray(d.exercises) ? d.exercises : [];
  const slimExercises = exercises.map((ex) => ({
    name: ex.name,
    muscle: ex.muscle || null,
    secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
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
  }));
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

// Compact history entry used to give Claude context on past workouts.
// For gym, computes tonnage on the fly (bodyweight added when set is bodyweight-flagged).
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

module.exports = {
  slimRunningWorkout,
  slimGymWorkout,
  slimKartingWorkout,
  slimGenericWorkout,
  slimWorkout,
  slimHistoryEntry,
  buildUserProfile,
};
