// Bottom-sheet exercise picker — shared by wizard "add exercise" and live "+".
// Markup/classes mirror the legacy #exercise-sheet in index.html exactly
// (.bottom-sheet, .bottom-sheet-overlay, .bottom-sheet-handle,
// .bottom-sheet-search, .bs-exercise-item, .bs-ex-name/.bs-ex-muscle) so the
// existing CSS + slide-in animation apply unchanged.

import { useState } from 'preact/hooks';

export function ExerciseSheet({ open, exercises, onPick, onClose }) {
  const [q, setQ] = useState('');
  if (!open) return null;
  const query = q.toLowerCase();
  const lib = exercises || [];
  const filtered = query
    ? lib.filter((e) => e.name.toLowerCase().includes(query) || (e.muscle || '').toLowerCase().includes(query))
    : lib;
  return (
    <>
      <div class="bottom-sheet-overlay show" onClick={onClose} />
      <div class="bottom-sheet show">
        <div class="bottom-sheet-handle" />
        <input
          type="text" class="bottom-sheet-search" placeholder="Cerca esercizio..."
          value={q} onInput={(e) => setQ(e.target.value)} autoFocus
        />
        <div class="exercise-sheet-list">
          {filtered.map((e) => (
            <div
              key={e.name} class="bs-exercise-item"
              onClick={() => { onPick(e.name, e.muscle); setQ(''); }}
            >
              <span class="bs-ex-name">{e.name}</span>
              <span class="bs-ex-muscle">{e.muscle}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
