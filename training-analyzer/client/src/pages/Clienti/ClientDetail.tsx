import { useEffect, useState } from 'preact/hooks';
import { Card, BentoGrid, StatTile } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { loadClientStats, removeRelationship } from '@/store/coach';
import type { CoachClientRow } from '@/store/coach';
import { ClientWorkouts } from './ClientWorkouts';
import { ClientPlanning } from './ClientPlanning';

// Dettaglio cliente per il PT: panoramica (stats), storico allenamenti
// (read-only) e programmazione sul calendario del cliente. Tab in stato locale
// (pagina interamente Preact, niente delega data-tab-group di ui.js).

const TABS = [
  { key: 'overview', label: 'Panoramica' },
  { key: 'workouts', label: 'Allenamenti' },
  { key: 'planning', label: 'Programmazione' },
] as const;

interface ClientStats {
  totalWorkouts: number;
  avgScore: number | null;
  weekWorkouts: number;
  weekKm: number;
  weekTonnage: number;
}

function Overview({ clientId }: { clientId: string }) {
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadClientStats(clientId).then(setStats).catch(() => setError(true));
  }, [clientId]);

  if (error) return <Card><p style="color:var(--text2)">Impossibile caricare le statistiche.</p></Card>;
  if (!stats) return <Card><p style="color:var(--text2)">Caricamento…</p></Card>;

  return (
    <BentoGrid cols="triple">
      <StatTile label="Allenamenti totali" value={stats.totalWorkouts} />
      <StatTile label="Score medio" value={stats.avgScore ?? 0} decimals={1} />
      <StatTile label="Sessioni · 7g" value={stats.weekWorkouts} />
      <StatTile label="Km corsa · 7g" value={stats.weekKm} decimals={1} suffix="km" />
      <StatTile label="Tonnellaggio · 7g" value={Math.round(stats.weekTonnage)} suffix="kg" />
    </BentoGrid>
  );
}

export function ClientDetail({ row, onBack }: { row: CoachClientRow; onBack: () => void }) {
  const [tab, setTab] = useState<typeof TABS[number]['key']>('overview');
  const [busy, setBusy] = useState(false);
  const u = row.user;

  async function endRelationship() {
    if (!window.confirm(`Terminare il rapporto con ${u.displayName || u.email}? Non vedrai più i suoi dati.`)) return;
    setBusy(true);
    try {
      await removeRelationship(row.relationship.id);
      toast('Rapporto terminato');
      onBack();
    } catch (e) {
      toast('Errore', 'error');
      setBusy(false);
    }
  }

  return (
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" type="button" onClick={onBack}>← Clienti</button>
        {u.photoURL && <img src={u.photoURL} alt="" style="width:34px;height:34px;border-radius:50%" />}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">{u.displayName || u.email}</div>
          <div style="font-size:.75rem;color:var(--text2)">{u.email}</div>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={endRelationship}>
          Termina rapporto
        </button>
      </div>

      <div class="lay-tabbar" style="margin-bottom:14px">
        {TABS.map((t) => (
          <button
            key={t.key}
            class={`bm-tab${tab === t.key ? ' active' : ''}`}
            type="button"
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview clientId={u.uid} />}
      {tab === 'workouts' && <ClientWorkouts clientId={u.uid} />}
      {tab === 'planning' && <ClientPlanning clientId={u.uid} />}
    </div>
  );
}
