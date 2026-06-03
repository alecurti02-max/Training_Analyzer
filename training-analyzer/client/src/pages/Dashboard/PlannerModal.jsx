// Modale "Programma sessione" — crea/modifica un PlannedWorkout.
// Riusa le classi modal/form/btn di css/style.css.
import { useState } from 'preact/hooks';
import { SPORT_TEMPLATES, getDefaultMusclesForSport } from '../../../js/sports.js';
import { toast } from '@/lib/toast.js';
import { savePlan, deletePlan } from '@/store/plans.js';

const SPORTS = ['gym', 'running', 'cycling', 'swimming', 'walking', 'karting', 'yoga', 'other'];

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function PlannerModal({ muscleGroups = [], plan = null, onClose }) {
  const [date, setDate] = useState((plan && plan.date) || tomorrow());
  const [type, setType] = useState((plan && plan.type) || 'gym');
  const [muscles, setMuscles] = useState((plan && plan.muscleGroups) || []);
  const [note, setNote] = useState((plan && plan.note) || '');
  const [busy, setBusy] = useState(false);

  const options = muscleGroups && muscleGroups.length
    ? muscleGroups
    : ['Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Core'];
  const toggle = (m) => setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  async function save() {
    if (!date) { toast('Scegli una data', 'error'); return; }
    setBusy(true);
    try {
      await savePlan({ date, type, muscleGroups: muscles, note });
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
      <div class="modal" style={{ maxWidth: '460px' }}>
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
      </div>
    </div>
  );
}
