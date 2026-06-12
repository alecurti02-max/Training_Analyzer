import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { muscleGroups } from '@/store/settings';
import { exercises } from '@/store/exercises';
import { loadClientPlans, saveClientPlan, deleteClientPlan, loadClientWorkouts } from '@/store/coach';
import { PlannerModal } from '../Dashboard/PlannerModal.jsx';

// Programmazione del PT sul calendario del cliente. Riusa PlannerModal (stesso
// builder esercizi/serie del planner personale) con onSave/onDelete che puntano
// a /api/coach/*. La libreria esercizi è quella del COACH; "copia ultima
// performance" usa gli allenamenti del CLIENTE (flattenati come si aspetta
// lastPerformance). Il cliente vede i planned in NextUp e li lancia con
// INIZIA ORA senza alcuna modifica lato suo.

interface PlanRow {
  id: string;
  date: string;
  type: string;
  muscleGroups?: string[];
  exercises?: unknown[];
  note?: string | null;
  createdByCoachId?: string | null;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function ClientPlanning({ clientId }: { clientId: string }) {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [clientWorkouts, setClientWorkouts] = useState<unknown[]>([]);
  // null = chiuso · {} = nuovo · row = modifica
  const [planner, setPlanner] = useState<PlanRow | Record<string, never> | null>(null);

  async function reload() {
    try { setPlans(await loadClientPlans(clientId)); }
    catch (e) { setPlans([]); }
  }

  useEffect(() => {
    setPlans(null);
    reload();
    // Flatten: lastPerformance() si aspetta exercises a top-level (shape legacy).
    loadClientWorkouts(clientId, 50)
      .then((res: { workouts?: Array<{ data?: object }> }) =>
        setClientWorkouts((res?.workouts || []).map((w) => ({ ...w, ...(w.data || {}) }))))
      .catch(() => setClientWorkouts([]));
  }, [clientId]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (plans || []).filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" type="button" onClick={() => setPlanner({})}>+ Pianifica sessione</button>
      </div>

      {plans == null && <Card><p style="color:var(--text2)">Caricamento…</p></Card>}
      {plans != null && upcoming.length === 0 && (
        <EmptyState
          title="Nessuna sessione programmata"
          hint="Le sessioni che pianifichi qui appaiono al cliente in Dashboard, pronte da avviare."
        />
      )}

      {upcoming.map((p) => {
        const mine = !!p.createdByCoachId;
        return (
          <Card key={p.id} style="margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.9rem">
                  {fmtDate(p.date)} · {(SPORT_TEMPLATES as Record<string, { name?: string }>)[p.type]?.name || p.type}
                </div>
                <div style="font-size:.75rem;color:var(--text2)">
                  {(p.muscleGroups || []).join(', ') || '—'}
                  {Array.isArray(p.exercises) && p.exercises.length > 0 && ` · ${p.exercises.length} esercizi`}
                  {p.note && ` · ${p.note}`}
                  {!mine && ' · pianificato dal cliente'}
                </div>
              </div>
              {mine && (
                <button class="btn btn-secondary btn-sm" type="button" onClick={() => setPlanner(p)}>Modifica</button>
              )}
            </div>
          </Card>
        );
      })}

      {planner !== null && (
        <PlannerModal
          plan={(planner as PlanRow).id ? planner : null}
          muscleGroups={muscleGroups.value}
          exercises={exercises.value}
          workouts={clientWorkouts}
          onClose={() => { setPlanner(null); reload(); }}
          onSave={(plan: unknown) => saveClientPlan(clientId, plan)}
          onDelete={(planId: string) => deleteClientPlan(clientId, planId)}
        />
      )}
    </div>
  );
}
