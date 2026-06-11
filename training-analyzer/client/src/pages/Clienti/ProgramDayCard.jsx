// Editor di una singola giornata della scheda (usato da ProgramBuilder).
// Riusa gli stessi mattoni del PlannerModal: ExerciseCard (serie/ripetizioni/
// peso) + ExerciseSheet (picker dalla libreria del coach) + initialSets.
import { useState } from 'preact/hooks';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { initialSets } from '../Train/logic/setModel.js';
import { ExerciseCard } from '../Train/components/GymSetEditor.jsx';
import { ExerciseSheet } from '../Train/components/ExerciseSheet.jsx';

const SPORTS = ['gym', 'running', 'cycling', 'swimming', 'walking', 'karting', 'yoga', 'other'];

export function ProgramDayCard({ day, exercises = [], muscleGroups = [], onChange, onRemove }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState({});

  const exList = Array.isArray(day.exercises) ? day.exercises : [];
  const set = (patch) => onChange({ ...day, ...patch });

  function addExercise(name, muscle) {
    setSheetOpen(false);
    const lib = (exercises || []).find((e) => e.name === name) || {};
    const ex = {
      name, muscle,
      secondaryMuscles: Array.isArray(lib.secondaryMuscles) ? lib.secondaryMuscles.slice() : [],
      weightMode: lib.weightMode || 'total', barbellWeight: lib.barbellWeight || null,
      isUnilateral: !!lib.isUnilateral, param: lib.param || 'reps',
    };
    ex.sets = initialSets(ex, null);
    set({ exercises: [...exList, ex] });
  }
  const updateEx = (i, next) => set({ exercises: exList.map((e, idx) => (idx === i ? next : e)) });
  const removeEx = (i) => set({ exercises: exList.filter((_, idx) => idx !== i) });

  const groups = muscleGroups.length ? muscleGroups : ['Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Core'];
  const toggleMuscle = (m) => {
    const cur = day.muscleGroups || [];
    set({ muscleGroups: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] });
  };

  return (
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:800;font-size:1.05rem;min-width:28px">{day.key}</span>
        <input type="text" value={day.label || ''} placeholder="Nome giornata (es. Push)"
          style="flex:1" onInput={(e) => set({ label: e.target.value })} />
        <select value={day.type || 'gym'} onChange={(e) => set({ type: e.target.value })}>
          {SPORTS.map((s) => <option value={s} key={s}>{(SPORT_TEMPLATES[s] && SPORT_TEMPLATES[s].name) || s}</option>)}
        </select>
        <button type="button" class="btn btn-secondary btn-sm" onClick={onRemove}>Rimuovi</button>
      </div>

      {(day.type || 'gym') === 'gym' ? (
        <div>
          {exList.map((ex, i) => (
            <div key={i} style="margin-bottom:8px">
              <ExerciseCard ex={ex} exIdx={i} live={false}
                optsOpen={!!optsOpen[i]} onToggleOpts={() => setOptsOpen((p) => ({ ...p, [i]: !p[i] }))}
                onChange={(next) => updateEx(i, next)} onRemove={() => removeEx(i)}
                onCopyLast={() => {}} />
              <button type="button" class="btn-link-sm" onClick={() => removeEx(i)}
                style="display:block;margin-top:2px;color:var(--text2)">Rimuovi esercizio</button>
            </div>
          ))}
          <button type="button" class="btn btn-secondary" style="width:100%" onClick={() => setSheetOpen(true)}>+ Aggiungi esercizio</button>
        </div>
      ) : (
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          {groups.map((m) => (
            <button type="button" key={m} onClick={() => toggleMuscle(m)}
              style={{
                cursor: 'pointer', fontSize: '.72rem', fontWeight: 600, padding: '5px 11px', borderRadius: '999px',
                border: '1px solid var(--border-strong)',
                background: (day.muscleGroups || []).includes(m) ? 'var(--accent)' : 'var(--bg2)',
                color: (day.muscleGroups || []).includes(m) ? 'var(--cc-on-teal, #fff)' : 'var(--text2)',
              }}>{m}</button>
          ))}
        </div>
      )}

      <div style="margin-top:8px">
        <input type="text" value={day.note || ''} placeholder="Note della giornata (opzionale)"
          style="width:100%" onInput={(e) => set({ note: e.target.value })} />
      </div>

      <ExerciseSheet open={sheetOpen} exercises={exercises} onPick={addExercise} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
