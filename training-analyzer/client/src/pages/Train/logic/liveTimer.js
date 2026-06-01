// Pure timer / draft maths for the live session.
//
// Timestamp-based (NOT a tick counter) so backgrounding the tab and resuming
// stays accurate. Extracted verbatim from js/ui.js liveGetElapsed (938-942),
// pause/resume (1076-1094), and the offline-gap adjustment in liveResumeDraft
// (979-992). `now` is injected (Date.now()) so these stay pure and testable —
// the scoring/ modules can't call Date.now() in this environment anyway.

// Elapsed whole seconds for a session object.
export function getElapsed(session, now) {
  if (!session) return 0;
  const t = session.paused ? session.pausedAt : now;
  return Math.floor((t - session.startTime - (session.totalPaused || 0)) / 1000);
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Toggle pause. Returns a NEW session with updated paused/pausedAt/totalPaused.
export function togglePause(session, now) {
  if (!session) return session;
  if (session.paused) {
    return {
      ...session,
      totalPaused: (session.totalPaused || 0) + (now - session.pausedAt),
      paused: false,
      pausedAt: null,
    };
  }
  return { ...session, paused: true, pausedAt: now };
}

// New session object at start. `now` = Date.now().
export function startSession(type, date, now) {
  return {
    type,
    date,
    startTime: now,
    exercises: [],
    paused: false,
    pausedAt: null,
    totalPaused: 0,
    sportFields: {},
    _lastSavedAt: now,
  };
}

// Adjust a loaded draft for the offline gap since it was last saved (so a tab
// closed mid-session resumes with correct elapsed). Mirrors ui.js:983-989.
// Returns a NEW session.
export function adjustResumedDraft(draft, now) {
  if (!draft) return draft;
  if (!draft.paused && draft._lastSavedAt) {
    return { ...draft, totalPaused: (draft.totalPaused || 0) + (now - draft._lastSavedAt) };
  }
  return { ...draft };
}

// ---- rest timer ----

export const REST_PRESETS = [30, 60, 90, 120, 180];
export const REST_CIRCUMFERENCE = 339.292; // SVG ring, must match css/markup

export function clampRestDefault(seconds) {
  const v = parseInt(seconds, 10);
  return Number.isFinite(v) && v >= 15 && v <= 600 ? v : 90;
}

export function clampRestPreset(seconds) {
  return Math.max(15, Math.min(600, parseInt(seconds, 10) || 90));
}

// stroke-dashoffset for the rest ring given remaining/total.
export function restDashoffset(remaining, total) {
  const fraction = total > 0 ? remaining / total : 0;
  return REST_CIRCUMFERENCE * (1 - fraction);
}

export function restClock(remaining) {
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
