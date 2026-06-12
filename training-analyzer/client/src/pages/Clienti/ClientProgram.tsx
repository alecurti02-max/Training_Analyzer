import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { loadAdherence, updateAssignment, loadProgram, saveClientPlan } from '@/store/coach';
import { applyProgression, progressionFor, weekOf } from '@/lib/progression';
import { AssignModal } from './AssignModal';

interface Adherence {
  assignment: {
    id: string; programId: string; programTitle: string; weeks: number;
    currentWeek: number; startDate: string; weekdayMap: Record<string, number> | null; status: string;
  } | null;
  perWeek: Array<{ week: number; expected: number; done: number }>;
  totals: { expected: number; done: number; pct: number | null };
  lastWorkoutDate: string | null;
  daysInactive: number | null;
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Pin di un giorno-scheda su una data: carichi già aggiustati alla settimana
// della DATA scelta (il server ricalcola comunque la week al salvataggio).
function PinDay({ clientId, adherence, onPinned }: { clientId: string; adherence: Adherence; onPinned: () => void }) {
  const [dayKey, setDayKey] = useState('');
  const [date, setDate] = useState(tomorrow());
  const [days, setDays] = useState<Array<{ key: string; label?: string; type?: string; muscleGroups?: string[]; note?: string | null; exercises?: unknown[] }>>([]);
  const [progressions, setProgressions] = useState<Array<{ week: number; loadPct?: number; deload?: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const a = adherence.assignment!;

  useEffect(() => {
    loadProgram(a.programId)
      .then((p) => { setDays(p.days || []); setProgressions(p.progressions || []); })
      .catch(() => setDays([]));
  }, [a.programId]);

  async function pin() {
    const day = days.find((d) => d.key === dayKey);
    if (!day) { toast('Scegli una giornata', 'error'); return; }
    setBusy(true);
    try {
      const week = weekOf(a.startDate, date, a.weeks);
      const prog = progressionFor(progressions, week);
      await saveClientPlan(clientId, {
        date,
        type: day.type || 'gym',
        muscleGroups: day.muscleGroups || [],
        note: day.note || null,
        exercises: applyProgression((day.exercises || []) as never[], prog.loadPct),
        assignmentId: a.id,
        dayKey: day.key,
      });
      toast('Giornata fissata sul calendario del cliente', 'success');
      onPinned();
    } catch (e) { toast('Errore', 'error'); }
    setBusy(false);
  }

  if (!days.length) return null;
  return (
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
      <span style="font-size:.82rem;color:var(--text2)">Fissa una giornata:</span>
      <select value={dayKey} onChange={(e) => setDayKey((e.target as HTMLSelectElement).value)}>
        <option value="">—</option>
        {days.map((d) => <option value={d.key} key={d.key}>{d.key}{d.label ? ` · ${d.label}` : ''}</option>)}
      </select>
      <input type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
      <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={pin}>Fissa</button>
    </div>
  );
}

// Tab "Scheda" del dettaglio cliente: assegnazione attiva + aderenza.
export function ClientProgram({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Adherence | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function reload() {
    setData(null);
    loadAdherence(clientId).then(setData).catch(() => setData(null));
  }
  useEffect(reload, [clientId]);

  async function close(status: 'completed' | 'cancelled') {
    if (!data?.assignment) return;
    const verb = status === 'completed' ? 'completata' : 'annullata';
    if (!window.confirm(`Segnare la scheda come ${verb}?`)) return;
    setBusy(true);
    try { await updateAssignment(data.assignment.id, { status }); toast(`Scheda ${verb}`); reload(); }
    catch (e) { toast('Errore', 'error'); }
    setBusy(false);
  }

  if (data == null) return <Card><p style="color:var(--text2)">Caricamento…</p></Card>;

  if (!data.assignment) {
    return (
      <div>
        <EmptyState title="Nessuna scheda attiva" hint="Assegna una scheda dalla tua libreria: il cliente la vedrà nel suo profilo, pronta da avviare." />
        <div style="display:flex;justify-content:center">
          <button class="btn btn-primary" type="button" onClick={() => setAssignOpen(true)}>Assegna scheda</button>
        </div>
        {assignOpen && <AssignModal clientId={clientId} onClose={() => setAssignOpen(false)} onAssigned={reload} />}
      </div>
    );
  }

  const a = data.assignment;
  return (
    <div>
      <Card style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700">{a.programTitle}</div>
            <div style="font-size:.78rem;color:var(--text2)">
              Settimana {a.currentWeek} di {a.weeks} · iniziata il {new Date(a.startDate).toLocaleDateString('it-IT')}
              {a.weekdayMap && Object.keys(a.weekdayMap).length > 0 &&
                ` · giorni: ${Object.entries(a.weekdayMap).map(([k, v]) => `${k}→${['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][v as number]}`).join(', ')}`}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => close('completed')}>Completa</button>
          <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => close('cancelled')}>Annulla scheda</button>
        </div>
        <PinDay clientId={clientId} adherence={data} onPinned={() => {}} />
      </Card>

      <Card>
        <div class="card-title">Aderenza</div>
        <div style="font-size:.85rem;margin-bottom:8px">
          {data.totals.done}/{data.totals.expected} sessioni
          {data.totals.pct != null && <span style="font-weight:700;color:var(--accent)"> · {data.totals.pct}%</span>}
          {data.lastWorkoutDate && (
            <span style="color:var(--text2)"> · ultimo allenamento {new Date(data.lastWorkoutDate).toLocaleDateString('it-IT')}</span>
          )}
        </div>
        {data.perWeek.map((w) => (
          <div key={w.week} style="display:flex;align-items:center;gap:10px;padding:3px 0">
            <span style="min-width:90px;font-size:.78rem;color:var(--text2)">Settimana {w.week}</span>
            <div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
              <div style={`height:100%;width:${w.expected ? Math.min(100, Math.round((w.done / w.expected) * 100)) : 0}%;background:var(--accent)`} />
            </div>
            <span style="font-size:.78rem;min-width:36px;text-align:right">{w.done}/{w.expected}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
