// Modale "Programma sessione" — crea/modifica un PlannedWorkout COMPLETO.
// Per la palestra costruisce esercizi + serie/ripetizioni riusando il builder del
// wizard (ExerciseCard + ExerciseSheet + setModel). Gli esercizi pianificati sono
// poi modificabili nel pannello LIVE (la card "INIZIA ORA" pre-compila la live).
import { useState } from 'preact/hooks';
import { SPORT_TEMPLATES, getDefaultMusclesForSport } from '../../../js/sports.js';
import { toast } from '@/lib/toast.js';
import { savePlan, deletePlan } from '@/store/plans.js';
import { lastPerformance } from '@/store/train.js';
import { initialSets } from '../Train/logic/setModel.js';
import { ExerciseCard } from '../Train/components/GymSetEditor.jsx';
import { ExerciseSheet } from '../Train/components/ExerciseSheet.jsx';

const SPORTS = ['gym', 'running', 'cycling', 'swimming', 'walking', 'karting', 'yoga', 'other'];
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

export function PlannerModal({ muscleGroups = [], plan = null, exercises = [], workouts = [], onClose }) {
  const [date, setDate] = useState((plan && plan.date) || tomorrow());
  const [type, setType] = useState((plan && plan.type) || 'gym');
  const [muscles, setMuscles] = useState((plan && plan.muscleGroups) || []);
  const [note, setNote] = useState((plan && plan.note) || '');
  const [exList, setExList] = useState(() => ((plan && Array.isArray(plan.exercises)) ? plan.exercises : []).map((e) => ({
    name: e.name, muscle: e.muscle,
    secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles.slice() : [],
    weightMode: e.weightMode || 'total', barbellWeight: e.barbellWeight || null,
    isUnilateral: !!e.isUnilateral, param: e.param || 'reps',
    sets: Array.isArray(e.sets) && e.sets.length ? e.sets.map((s) => ({ ...s })) : initialSets(e, null),
    lastPerf: null,
  })));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState({});
  const [busy, setBusy] = useState(false);

  const options = muscleGroups && muscleGroups.length ? muscleGroups
    : ['Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Core'];
  const toggle = (m) => setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  function addExercise(name, muscle) {
    setSheetOpen(false);
    const lib = (exercises || []).find((e) => e.name === name) || {};
    const ex = {
      name, muscle,
      secondaryMuscles: Array.isArray(lib.secondaryMuscles) ? lib.secondaryMuscles.slice() : [],
      weightMode: lib.weightMode || 'total', barbellWeight: lib.barbellWeight || null,
      isUnilateral: !!lib.isUnilateral, param: lib.param || 'reps',
      lastPerf: lastPerformance(workouts, name),
    };
    ex.sets = initialSets(ex, ex.lastPerf);
    setExList((p) => [...p, ex]);
  }
  const updateEx = (i, next) => setExList((p) => p.map((e, idx) => (idx === i ? next : e)));
  const removeEx = (i) => setExList((p) => p.filter((_, idx) => idx !== i));

  async function save() {
    if (!date) { toast('Scegli una data', 'error'); return; }
    setBusy(true);
    const payloadEx = type === 'gym' ? exList.map(({ lastPerf, ...e }) => e) : [];
    const mg = type === 'gym'
      ? [...new Set(exList.map((e) => e.muscle).filter(Boolean))]
      : muscles;
    try {
      await savePlan({ date, type, muscleGroups: mg, note, exercises: payloadEx });
      toast('Sessione programmata', 'success');
      onClose();
    } catch (e) { toast('Errore nel salvataggio', 'error'); setBusy(false); }
  }
  async function remove() {
    if (!plan || !plan.id) return;
    setBusy(true);
    try { await deletePlan(plan.id); toast('Programmazione rimossa'); onClose(); }
    catch (e) { toast('Errore', 'error'); setBusy(false); }
  }

  return (
    <div class="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style={{ maxWidth: '560px' }}>
        <div class="modal-header">Programma sessione</div>

        <div class="login-form-group">
          <label>Data</label>
          <input type="date" value={date} onInput={(e) => setDate(e.target.value)} />
        </div>

        <div class="login-form-group">
          <label>Sport</label>
          <select value={type} onChange={(e) => {
            const t = e.target.value;
            setType(t);
            if (t !== 'gym' && !muscles.length) setMuscles(getDefaultMusclesForSport(t) || []);
          }}>
            {SPORTS.map((s) => <option value={s} key={s}>{(SPORT_TEMPLATES[s] && SPORT_TEMPLATES[s].name) || s}</option>)}
          </select>
        </div>

        {type === 'gym' ? (
          <div class="login-form-group">
            <label>Esercizi · serie · ripetizioni</label>
            {exList.length === 0 && (
              <p style={{ color: 'var(--text2)', fontSize: '.85rem', margin: '2px 0 8px' }}>
                Nessun esercizio. Aggiungi esercizi con serie/ripetizioni/peso — li potrai modificare durante il live.
              </p>
            )}
            {exList.map((ex, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <ExerciseCard ex={ex} exIdx={i} live={false}
                  optsOpen={!!optsOpen[i]} onToggleOpts={() => setOptsOpen((p) => ({ ...p, [i]: !p[i] }))}
                  onChange={(next) => updateEx(i, next)} onRemove={() => removeEx(i)}
                  onCopyLast={() => updateEx(i, { ...ex, sets: initialSets(ex, ex.lastPerf) })} />
                <button type="button" class="btn-link-sm" onClick={() => removeEx(i)}
                  style={{ display: 'block', marginTop: '2px', color: 'var(--text2)' }}>Rimuovi esercizio</button>
              </div>
            ))}
            <button type="button" class="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSheetOpen(true)}>+ Aggiungi esercizio</button>
          </div>
        ) : (
          <div class="login-form-group">
            <label>Gruppi muscolari</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {options.map((m) => (
                <button type="button" key={m} onClick={() => toggle(m)}
                  style={{
                    cursor: 'pointer', fontSize: '.72rem', fontWeight: 600, padding: '5px 11px', borderRadius: '999px',
                    border: '1px solid var(--border-strong)',
                    background: muscles.includes(m) ? 'var(--accent)' : 'var(--bg2)',
                    color: muscles.includes(m) ? 'var(--cc-on-teal, #fff)' : 'var(--text2)',
                  }}>{m}</button>
              ))}
            </div>
          </div>
        )}

        <div class="login-form-group">
          <label>Note</label>
          <input type="text" value={note} placeholder="es. Push day · 5×5" onInput={(e) => setNote(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          {plan && plan.id && (
            <button class="btn btn-secondary" type="button" disabled={busy} onClick={remove} style={{ marginRight: 'auto' }}>Elimina</button>
          )}
          <button class="btn btn-secondary" type="button" onClick={onClose}>Annulla</button>
          <button class="btn btn-primary" type="button" disabled={busy} onClick={save}>Salva</button>
        </div>

        <ExerciseSheet open={sheetOpen} exercises={exercises} onPick={addExercise} onClose={() => setSheetOpen(false)} />
      </div>
    </div>
  );
}
