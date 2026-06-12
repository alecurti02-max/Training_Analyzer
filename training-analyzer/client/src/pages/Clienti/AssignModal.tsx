import { useEffect, useState } from 'preact/hooks';
import { toast } from '@/lib/toast.js';
import { coachPrograms, loadPrograms, assignProgram } from '@/store/coach';

const WEEKDAYS = [
  { v: 1, label: 'Lun' }, { v: 2, label: 'Mar' }, { v: 3, label: 'Mer' },
  { v: 4, label: 'Gio' }, { v: 5, label: 'Ven' }, { v: 6, label: 'Sab' }, { v: 7, label: 'Dom' },
];

function today(): string { return new Date().toISOString().slice(0, 10); }

// Assegna una scheda al cliente: scelta programma + data inizio + (opzionale)
// mappa giornata→giorno della settimana, usata solo per le sessioni attese.
export function AssignModal({ clientId, onClose, onAssigned }: {
  clientId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [programId, setProgramId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [weekdayMap, setWeekdayMap] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadPrograms(); }, []);
  const assignable = coachPrograms.value.filter((p) => p.status !== 'archived');
  const selected = assignable.find((p) => p.id === programId);

  async function submit() {
    if (!programId) { setError('Scegli una scheda'); return; }
    setBusy(true);
    setError('');
    try {
      await assignProgram(clientId, {
        programId,
        startDate,
        weekdayMap: Object.keys(weekdayMap).length ? weekdayMap : null,
        note: note || undefined,
      });
      toast('Scheda assegnata', 'success');
      onAssigned();
      onClose();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      setBusy(false);
      setError(err?.status === 409 ? (err.message || 'Il cliente ha già una scheda attiva') : 'Errore, riprova');
    }
  }

  return (
    <div class="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style={{ maxWidth: '480px' }}>
        <div class="modal-header">Assegna scheda</div>

        <div class="login-form-group">
          <label>Scheda</label>
          <select value={programId} onChange={(e) => { setProgramId((e.target as HTMLSelectElement).value); setWeekdayMap({}); }}>
            <option value="">— Scegli —</option>
            {assignable.map((p) => <option value={p.id} key={p.id}>{p.title} ({p.weeks} sett.)</option>)}
          </select>
        </div>

        <div class="login-form-group">
          <label>Data di inizio</label>
          <input type="date" value={startDate} onInput={(e) => setStartDate((e.target as HTMLInputElement).value)} />
        </div>

        {selected && (selected.days || []).length > 0 && (
          <div class="login-form-group">
            <label>Giorni della settimana (opzionale)</label>
            <p style="font-size:.75rem;color:var(--text2);margin-bottom:6px">
              Serve solo per calcolare le sessioni attese: il cliente può comunque allenarsi quando vuole.
            </p>
            {(selected.days || []).map((d) => (
              <div key={d.key} style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="min-width:110px;font-size:.82rem">{d.key}{d.label ? ` · ${d.label}` : ''}</span>
                <select
                  value={weekdayMap[d.key] || ''}
                  onChange={(e) => {
                    const v = Number((e.target as HTMLSelectElement).value);
                    setWeekdayMap((prev) => {
                      const next = { ...prev };
                      if (v) next[d.key] = v; else delete next[d.key];
                      return next;
                    });
                  }}>
                  <option value="">—</option>
                  {WEEKDAYS.map((w) => <option value={w.v} key={w.v}>{w.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <div class="login-form-group">
          <label>Nota per il cliente</label>
          <input type="text" value={note} placeholder="opzionale" onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
        </div>

        {error && <p style="font-size:.8rem;color:var(--redline,#e54);margin:4px 0 0">{error}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button class="btn btn-secondary" type="button" onClick={onClose}>Annulla</button>
          <button class="btn btn-primary" type="button" disabled={busy} onClick={submit}>Assegna</button>
        </div>
      </div>
    </div>
  );
}
