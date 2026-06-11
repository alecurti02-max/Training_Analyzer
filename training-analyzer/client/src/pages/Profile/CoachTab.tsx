import { useEffect, useState } from 'preact/hooks';
import { Card } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { coachRelationships, loadMyCoach, acceptCoach, declineCoach, endCoach } from '@/store/myCoach';
import type { MyCoachRow } from '@/store/myCoach';

// Tab "Coach" del Profilo (lato CLIENTE): inviti pending da accettare/rifiutare
// e coach attivi con possibilità di terminare il rapporto. Accettando, il coach
// vede allenamenti e statistiche e può pianificare sessioni sul calendario.

function CoachAvatar({ coach }: { coach: MyCoachRow['coach'] }) {
  if (coach?.photoURL) return <img src={coach.photoURL} alt="" style="width:34px;height:34px;border-radius:50%" />;
  return (
    <div style="width:34px;height:34px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-weight:700">
      {(coach?.displayName || '?')[0].toUpperCase()}
    </div>
  );
}

function PendingInvite({ row }: { row: MyCoachRow }) {
  const [busy, setBusy] = useState(false);
  const act = (fn: (id: string) => Promise<void>, msg: string) => async () => {
    setBusy(true);
    try { await fn(row.relationship.id); toast(msg, 'success'); }
    catch (e) { toast('Errore', 'error'); setBusy(false); }
  };
  return (
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <CoachAvatar coach={row.coach} />
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem">{row.coach?.displayName || 'Personal Trainer'}</div>
        <div style="font-size:.75rem;color:var(--text2)">
          Vuole seguirti come coach: vedrà i tuoi allenamenti e potrà programmarti le sessioni.
        </div>
      </div>
      <button class="btn btn-primary btn-sm" type="button" disabled={busy} onClick={act(acceptCoach, 'Coach collegato')}>Accetta</button>
      <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={act(declineCoach, 'Invito rifiutato')}>Rifiuta</button>
    </div>
  );
}

function ActiveCoach({ row }: { row: MyCoachRow }) {
  const [busy, setBusy] = useState(false);
  async function end() {
    if (!window.confirm('Terminare il rapporto con questo coach? Non vedrà più i tuoi dati.')) return;
    setBusy(true);
    try { await endCoach(row.relationship.id); toast('Rapporto terminato'); }
    catch (e) { toast('Errore', 'error'); setBusy(false); }
  }
  return (
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <CoachAvatar coach={row.coach} />
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem">{row.coach?.displayName || 'Personal Trainer'}</div>
        <div style="font-size:.75rem;color:var(--text2)">Ti segue: vede i tuoi allenamenti e programma le tue sessioni.</div>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={end}>Termina</button>
    </div>
  );
}

export function CoachTab() {
  useEffect(() => { loadMyCoach(true); }, []);
  const rows = coachRelationships.value;
  const pending = rows.filter((r) => r.relationship.status === 'pending');
  const active = rows.filter((r) => r.relationship.status === 'active');

  return (
    <div>
      {pending.length > 0 && (
        <Card>
          <div class="card-title">Inviti ricevuti</div>
          {pending.map((r) => <PendingInvite key={r.relationship.id} row={r} />)}
        </Card>
      )}
      <Card>
        <div class="card-title">Il tuo coach</div>
        {active.length === 0 ? (
          <p style="font-size:.82rem;color:var(--text2)">
            Nessun coach collegato. Se il tuo Personal Trainer usa quest'app, chiedigli di
            invitarti con la tua email: l'invito comparirà qui.
          </p>
        ) : active.map((r) => <ActiveCoach key={r.relationship.id} row={r} />)}
      </Card>
    </div>
  );
}
