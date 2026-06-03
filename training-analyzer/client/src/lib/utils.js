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

// Bucketizza i workout nelle ultime `n` settimane (ISO, lun→dom), dalla più
// vecchia alla più recente. Per le sparkline della Dashboard. Ritorna
// [{ sessions, score, km, tonnage }, ...] di lunghezza n.
export function weeklyBuckets(workouts, n = 7) {
  const today = new Date(todayStr());
  const buckets = [];
  const byWeek = new Map();
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - i * 7);
    const ws = getWeekStart(ref.toISOString().slice(0, 10));
    const b = { ws, sessions: 0, scoreSum: 0, scoreCount: 0, km: 0, tonnage: 0 };
    buckets.push(b);
    byWeek.set(ws, b);
  }
  for (const w of workouts || []) {
    const b = byWeek.get(getWeekStart(w.date));
    if (!b) continue;
    b.sessions++;
    if (w.scores && w.scores.overall != null) { b.scoreSum += w.scores.overall; b.scoreCount++; }
    if (w.type === 'running') b.km += w.distance || 0;
    if (w.type === 'gym') b.tonnage += (w._tonnage || 0) / 1000;
  }
  return buckets.map((b) => ({
    sessions: b.sessions,
    score: b.scoreCount ? b.scoreSum / b.scoreCount : 0,
    km: Math.round(b.km * 10) / 10,
    tonnage: Math.round(b.tonnage * 10) / 10,
  }));
}
