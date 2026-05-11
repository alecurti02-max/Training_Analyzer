// Shared utility helpers, ported from legacy ui.js:49-70.
// Pure functions only — no DOM access, no state. Used across pages and tests.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Convert "5:30" (mm:ss) or 5.5 (minutes per km) to total seconds.
export function paceToSeconds(p) {
  if (!p) return 0;
  const parts = String(p).split(':');
  return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : parseFloat(p) * 60;
}

export function secondsToPace(s) {
  if (!s || s <= 0) return '--';
  let m = Math.floor(s / 60);
  let sec = Math.round(s % 60);
  if (sec === 60) { m += 1; sec = 0; }
  return m + ':' + String(sec).padStart(2, '0');
}

export function daysBetween(d1, d2) {
  return Math.abs(Math.floor((new Date(d1) - new Date(d2)) / 86400000));
}

// ISO Monday-as-start week. Returns the start date as YYYY-MM-DD string.
export function getWeekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dt.setDate(diff)).toISOString().slice(0, 10);
}

// Color tier for a workout score (0-10). Matches the legacy palette.
export function scoreColor(s) {
  if (s >= 10) return 'var(--fuchsia-bright)';
  if (s >= 9) return 'var(--fuchsia)';
  if (s >= 8) return 'var(--green)';
  if (s >= 7) return 'var(--light-green)';
  if (s >= 6) return 'var(--yellow)';
  if (s >= 4) return 'var(--orange)';
  return 'var(--red)';
}

// Concatenate class names, skipping falsy values. Useful for Preact `class`.
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
