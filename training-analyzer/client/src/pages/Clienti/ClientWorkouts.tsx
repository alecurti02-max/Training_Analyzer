import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { loadClientWorkouts } from '@/store/coach';

// Storico allenamenti del cliente, READ-ONLY per il PT. Lista compatta con
// dettaglio espandibile inline (gli allenamenti del cliente non sono nelle
// cache legacy, quindi niente showWorkoutDetail/WorkoutItem di ui.js).

interface CoachWorkout {
  id: string;
  type: string;
  date: string;
  score: number | null;
  data?: {
    exercises?: Array<{ name?: string; muscle?: string; sets?: Array<Record<string, unknown>> }>;
    distance?: number;
    duration?: number;
    notes?: string;
    note?: string;
  };
}

function sportLabel(type: string): string {
  return (SPORT_TEMPLATES as Record<string, { name?: string }>)[type]?.name || type;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function setSummary(s: Record<string, unknown>): string {
  const reps = s.reps != null ? `${s.reps}` : null;
  const w = s.weight != null ? `${s.weight}kg`
    : s.weightLeft != null || s.weightRight != null ? `${s.weightLeft ?? '–'}/${s.weightRight ?? '–'}kg` : null;
  if (reps && w) return `${reps}×${w}`;
  if (reps) return `${reps} rip`;
  if (s.duration != null) return `${s.duration}s`;
  return '—';
}

function WorkoutRow({ w }: { w: CoachWorkout }) {
  const [open, setOpen] = useState(false);
  const d = w.data || {};
  const exercises = Array.isArray(d.exercises) ? d.exercises : [];
  const note = d.notes || d.note;

  return (
    <Card style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onClick={() => setOpen(!open)}>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.9rem">{sportLabel(w.type)}</div>
          <div style="font-size:.75rem;color:var(--text2)">{fmtDate(w.date)}</div>
        </div>
        {w.score != null && <span style="font-weight:700;color:var(--accent)">{Number(w.score).toFixed(1)}</span>}
        {exercises.length > 0 && <span style="font-size:.75rem;color:var(--text2)">{exercises.length} es.</span>}
        {d.distance != null && <span style="font-size:.75rem;color:var(--text2)">{d.distance} km</span>}
        <span style="color:var(--text2)">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          {exercises.map((ex, i) => (
            <div key={i} style="margin-bottom:6px">
              <div style="font-size:.85rem;font-weight:600">
                {ex.name} <span style="color:var(--text2);font-weight:400">· {ex.muscle}</span>
              </div>
              {Array.isArray(ex.sets) && ex.sets.length > 0 && (
                <div style="font-size:.78rem;color:var(--text2)">
                  {ex.sets.map((s) => setSummary(s)).join(' · ')}
                </div>
              )}
            </div>
          ))}
          {exercises.length === 0 && <p style="font-size:.8rem;color:var(--text2)">Nessun dettaglio esercizi.</p>}
          {note && <p style="font-size:.8rem;color:var(--text2);margin-top:6px">Note: {note}</p>}
        </div>
      )}
    </Card>
  );
}

export function ClientWorkouts({ clientId }: { clientId: string }) {
  const [workouts, setWorkouts] = useState<CoachWorkout[] | null>(null);

  useEffect(() => {
    setWorkouts(null);
    loadClientWorkouts(clientId)
      .then((res: { workouts?: CoachWorkout[] }) => setWorkouts(res?.workouts || []))
      .catch(() => setWorkouts([]));
  }, [clientId]);

  if (workouts == null) return <Card><p style="color:var(--text2)">Caricamento…</p></Card>;
  if (!workouts.length) return <EmptyState title="Nessun allenamento registrato" />;

  return <div>{workouts.map((w) => <WorkoutRow key={w.id} w={w} />)}</div>;
}
