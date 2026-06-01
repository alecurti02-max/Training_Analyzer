// Pure set/exercise model for the Train feature (wizard + live session).
//
// Framework-agnostic: no DOM, no Preact, no module-global state. Every function
// takes plain data and returns NEW plain data (immutable — required so Preact
// signals notify on change; the legacy code mutated in place). Extracted verbatim
// from the behaviour in js/ui.js (addWizExercise/liveAddExercise, wizAddSet,
// wizUpdateWeightOption, liveCompleteSet, etc.) so wizard and live share ONE
// implementation instead of two near-identical copies.
//
// `live` flag = include the live-only `done` field on sets. Wizard sets omit it.

// ---- empty / copied sets ----

export function makeEmptySet(ex, { live = false } = {}) {
  const isReps = (ex.param || 'reps') === 'reps';
  const base = ex.isUnilateral
    ? (isReps
        ? { reps: '', weightLeft: '', weightRight: '', rpe: null, bodyweight: false }
        : { repsLeft: '', repsRight: '', rpe: null, bodyweight: false })
    : { reps: '', weight: '', rpe: null, bodyweight: false };
  if (live) base.done = false;
  return base;
}

// Copy a set from a previous performance, normalising bilateral↔unilateral.
export function copySetFromLast(s, ex, { live = false } = {}) {
  const isReps = (ex.param || 'reps') === 'reps';
  let out;
  if (ex.isUnilateral) {
    out = isReps
      ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight }
      : { repsLeft: s.repsLeft != null ? s.repsLeft : (s.reps || ''), repsRight: s.repsRight != null ? s.repsRight : (s.reps || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight };
  } else {
    out = { reps: s.reps != null ? s.reps : (s.repsLeft || ''), weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight };
    // Drops only survive on bilateral sets (wizard copies them; live drops them — matches legacy).
    if (!live && Array.isArray(s.drops) && s.drops.length) {
      out.drops = s.drops.map((d) => ({ reps: d.reps, weight: d.weight }));
    }
  }
  if (live) out.done = false;
  return out;
}

// Initial sets for a freshly added exercise: copy last performance, else one empty set.
export function initialSets(ex, lastPerf, opts = {}) {
  if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length) {
    return lastPerf.sets.map((s) => copySetFromLast(s, ex, opts));
  }
  return [makeEmptySet(ex, opts)];
}

// ---- add / remove (return a NEW sets array) ----

export function addSet(sets, ex, opts = {}) {
  const last = sets[sets.length - 1] || {};
  const isReps = (ex.param || 'reps') === 'reps';
  let ns;
  if (ex.isUnilateral) {
    ns = isReps
      ? { reps: last.reps || '', weightLeft: last.weightLeft || '', weightRight: last.weightRight || '', rpe: last.rpe || null, bodyweight: !!last.bodyweight }
      : { repsLeft: last.repsLeft || '', repsRight: last.repsRight || '', rpe: last.rpe || null, bodyweight: !!last.bodyweight };
  } else {
    ns = { reps: last.reps || '', weight: last.weight || '', rpe: last.rpe || null, bodyweight: !!last.bodyweight };
  }
  if (opts.live) ns.done = false;
  return [...sets, ns];
}

// Remove a set; if it was the last one, replace with a single empty set (matches legacy).
export function removeSet(sets, sIdx, ex, opts = {}) {
  const next = sets.filter((_, i) => i !== sIdx);
  return next.length ? next : [makeEmptySet(ex, opts)];
}

// ---- field updates (return a NEW set) ----

const NUM_FIELDS = {
  reps: (v) => parseInt(v, 10) || '',
  repsLeft: (v) => parseFloat(v) || '',
  repsRight: (v) => parseFloat(v) || '',
  weight: (v) => parseFloat(v) || '',
  weightLeft: (v) => parseFloat(v) || '',
  weightRight: (v) => parseFloat(v) || '',
};

export function updateSetField(set, field, value) {
  const out = { ...set };
  if (field in NUM_FIELDS) out[field] = NUM_FIELDS[field](value);
  else if (field === 'rpe') out.rpe = parseInt(value, 10) || null;
  else if (field === 'bodyweight') out.bodyweight = !!value;
  return out;
}

// ---- drop sets (bilateral only) ----

export function addDrop(set) {
  if (!set) return set;
  const drops = Array.isArray(set.drops) ? set.drops.slice() : [];
  const last = drops[drops.length - 1] || { reps: set.reps, weight: set.weight };
  drops.push({ reps: last.reps || '', weight: last.weight || '' });
  return { ...set, drops };
}

export function removeDrop(set, dIdx) {
  if (!set || !Array.isArray(set.drops)) return set;
  const drops = set.drops.filter((_, i) => i !== dIdx);
  const out = { ...set };
  if (drops.length) out.drops = drops;
  else delete out.drops;
  return out;
}

export function updateDropField(set, dIdx, field, value) {
  if (!set || !Array.isArray(set.drops) || !set.drops[dIdx]) return set;
  const drops = set.drops.map((d, i) => {
    if (i !== dIdx) return d;
    if (field === 'reps') return { ...d, reps: parseInt(value, 10) || '' };
    if (field === 'weight') return { ...d, weight: parseFloat(value) || '' };
    return d;
  });
  return { ...set, drops };
}

// ---- weight-mode override (per-exercise) ----

// Apply a weight-option change to an exercise; converting unilateral remaps every set.
// Returns a NEW exercise object.
export function applyWeightOption(ex, field, value, opts = {}) {
  const out = { ...ex };
  if (field === 'weightMode') {
    out.weightMode = value;
  } else if (field === 'barbellSel') {
    if (value === '') out.barbellWeight = null;
    else if (value === 'custom') out.barbellWeight = ex.barbellWeight || 0;
    else out.barbellWeight = parseFloat(value) || null;
  } else if (field === 'barbellCustom') {
    const c = parseFloat(value);
    out.barbellWeight = Number.isFinite(c) && c > 0 ? c : null;
  } else if (field === 'isUnilateral') {
    out.isUnilateral = !!value;
    out.sets = ex.sets.map((s) => {
      const ns = out.isUnilateral
        ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight }
        : { reps: s.reps, weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight };
      if (opts.live) ns.done = !!s.done;
      return ns;
    });
  }
  return out;
}

// ---- live: complete a set ----

// Mark set done; if no undone set remains, append a fresh one seeded from this set
// (live auto-advance). Returns a NEW sets array. `appended` says whether one was added.
export function completeSet(sets, sIdx, ex) {
  const target = sets[sIdx];
  if (!target || target.done) return { sets, appended: false };
  const next = sets.map((s, i) => (i === sIdx ? { ...s, done: true } : s));
  const hasUndone = next.some((s) => !s.done);
  if (hasUndone) return { sets: next, appended: false };
  const isReps = (ex.param || 'reps') === 'reps';
  const seed = next[sIdx];
  const ns = ex.isUnilateral
    ? (isReps
        ? { reps: seed.reps || '', weightLeft: seed.weightLeft || '', weightRight: seed.weightRight || '', rpe: null, done: false }
        : { repsLeft: seed.repsLeft || '', repsRight: seed.repsRight || '', rpe: null, done: false })
    : { reps: seed.reps || '', weight: seed.weight || '', rpe: null, done: false };
  return { sets: [...next, ns], appended: true };
}
