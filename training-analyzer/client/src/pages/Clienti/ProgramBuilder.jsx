// Builder della scheda (CRM F2): meta (titolo/obiettivo/settimane) + giornate
// A/B/C… (ProgramDayCard) + progressioni per-settimana (loadPct/deload).
import { useState } from 'preact/hooks';
import { toast } from '@/lib/toast.js';
import { saveProgram } from '@/store/coach';
import { muscleGroups } from '@/store/settings';
import { exercises } from '@/store/exercises';
import { ProgramDayCard } from './ProgramDayCard.jsx';

function nextKey(days) {
  const used = new Set(days.map((d) => d.key));
  for (let i = 0; i < 26; i += 1) {
    const k = String.fromCharCode(65 + i);
    if (!used.has(k)) return k;
  }
  return `D${days.length + 1}`;
}

export function ProgramBuilder({ program = null, onBack }) {
  const [title, setTitle] = useState(program?.title || '');
  const [goal, setGoal] = useState(program?.goal || '');
  const [notes, setNotes] = useState(program?.notes || '');
  const [weeks, setWeeks] = useState(program?.weeks || 4);
  const [status, setStatus] = useState(program?.status || 'draft');
  const [days, setDays] = useState(() => (Array.isArray(program?.days) ? program.days.map((d) => ({ ...d })) : []));
  const [progressions, setProgressions] = useState(() => (Array.isArray(program?.progressions) ? program.progressions.map((p) => ({ ...p })) : []));
  const [busy, setBusy] = useState(false);

  const addDay = () => setDays((p) => [...p, { key: nextKey(p), label: '', type: 'gym', muscleGroups: [], exercises: [], note: '' }]);
  const updateDay = (i, next) => setDays((p) => p.map((d, idx) => (idx === i ? next : d)));
  const removeDay = (i) => setDays((p) => p.filter((_, idx) => idx !== i));

  // progressions: una riga per settimana che differisce dal default (100%, no deload)
  function progFor(week) {
    return progressions.find((p) => p.week === week) || { week, loadPct: 100, deload: false };
  }
  function setProg(week, patch) {
    setProgressions((prev) => {
      const cur = prev.find((p) => p.week === week);
      const next = { ...(cur || { week, loadPct: 100, deload: false }), ...patch };
      const rest = prev.filter((p) => p.week !== week);
      // riga al default → si rimuove (settimana assente ⇒ 100%)
      if (Number(next.loadPct) === 100 && !next.deload) return rest;
      return [...rest, next];
    });
  }

  async function save() {
    if (!title.trim()) { toast('Dai un titolo alla scheda', 'error'); return; }
    if (!days.length) { toast('Aggiungi almeno una giornata', 'error'); return; }
    setBusy(true);
    try {
      await saveProgram({
        id: program?.id,
        title, goal, notes, status,
        weeks: Number(weeks) || 4,
        days,
        progressions,
      });
      toast('Scheda salvata', 'success');
      onBack();
    } catch (e) { toast('Errore nel salvataggio', 'error'); setBusy(false); }
  }

  const weekNumbers = Array.from({ length: Math.max(1, Math.min(52, Number(weeks) || 1)) }, (_, i) => i + 1);

  return (
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" type="button" onClick={onBack}>← Schede</button>
        <div style="font-weight:700;flex:1">{program?.id ? 'Modifica scheda' : 'Nuova scheda'}</div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">Bozza</option>
          <option value="active">Attiva</option>
          <option value="archived">Archiviata</option>
        </select>
        <button class="btn btn-primary" type="button" disabled={busy} onClick={save}>Salva</button>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="login-form-group">
          <label>Titolo</label>
          <input type="text" value={title} placeholder="es. Ipertrofia 4 settimane" onInput={(e) => setTitle(e.target.value)} />
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div class="login-form-group" style="flex:2;min-width:180px">
            <label>Obiettivo</label>
            <input type="text" value={goal} placeholder="es. Massa, Forza, Ricomposizione" onInput={(e) => setGoal(e.target.value)} />
          </div>
          <div class="login-form-group" style="flex:1;min-width:100px">
            <label>Settimane</label>
            <input type="number" min="1" max="52" value={weeks} onInput={(e) => setWeeks(e.target.value)} />
          </div>
        </div>
        <div class="login-form-group">
          <label>Note</label>
          <input type="text" value={notes} placeholder="Indicazioni generali per il cliente" onInput={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div style="font-weight:700;margin:14px 0 8px">Giornate</div>
      {days.map((d, i) => (
        <ProgramDayCard key={i} day={d} exercises={exercises.value} muscleGroups={muscleGroups.value}
          onChange={(next) => updateDay(i, next)} onRemove={() => removeDay(i)} />
      ))}
      <button class="btn btn-secondary" type="button" style="width:100%" onClick={addDay}>+ Aggiungi giornata</button>

      <div style="font-weight:700;margin:18px 0 8px">Progressioni settimanali</div>
      <div class="card">
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:10px">
          Percentuale di carico applicata ai pesi della scheda quando il cliente avvia una giornata.
          100% = come scritto in scheda. Spunta "scarico" per le settimane di deload.
        </p>
        {weekNumbers.map((w) => {
          const p = progFor(w);
          return (
            <div key={w} style="display:flex;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid var(--border)">
              <span style="min-width:90px;font-size:.82rem">Settimana {w}</span>
              <input type="number" min="10" max="200" step="5" value={p.loadPct}
                style="width:80px" onInput={(e) => setProg(w, { loadPct: Number(e.target.value) || 100 })} />
              <span style="font-size:.8rem;color:var(--text2)">%</span>
              <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;color:var(--text2);cursor:pointer">
                <input type="checkbox" checked={!!p.deload} onChange={(e) => setProg(w, { deload: e.target.checked })} />
                scarico
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
