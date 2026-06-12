// Matematica pura degli assignment (nessun accesso al DB) — duplicata
// consapevolmente lato client in client/src/lib/progression.ts: tenere in sync.

// Settimana corrente di una scheda: 1-based, clampata in [1, weeks].
// `today` e `startDate` sono stringhe DATEONLY (YYYY-MM-DD).
function weekOf(startDate, today, weeks) {
  const ms = Date.parse(today) - Date.parse(startDate);
  const w = Math.floor(ms / (7 * 86400000)) + 1;
  return Math.max(1, Math.min(w, Math.max(1, weeks || 1)));
}

// Sessioni attese a settimana: i giorni mappati su weekday se il coach li ha
// fissati, altrimenti tutte le giornate della scheda.
function expectedPerWeek(program, assignment) {
  const mapped = assignment?.weekdayMap ? Object.keys(assignment.weekdayMap).length : 0;
  if (mapped > 0) return mapped;
  return Array.isArray(program?.days) ? program.days.length : 0;
}

// Progressione applicabile a una settimana (default 100%, no deload).
function progressionFor(progressions, week) {
  const p = (progressions || []).find((x) => x && x.week === week);
  return { loadPct: p?.loadPct ?? 100, deload: !!p?.deload, note: p?.note || null };
}

module.exports = { weekOf, expectedPerWeek, progressionFor };
