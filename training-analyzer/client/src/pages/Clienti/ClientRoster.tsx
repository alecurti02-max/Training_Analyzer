import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { coachClients, coachClientsState, loadCoachClients, removeRelationship } from '@/store/coach';
import type { CoachClientRow } from '@/store/coach';
import { InviteModal } from './InviteModal';

function fmtDate(d: string | null | undefined): string {
  if (!d) return 'mai';
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function ActiveClientCard({ row, onSelect }: { row: CoachClientRow; onSelect: (uid: string) => void }) {
  const u = row.user || ({} as CoachClientRow['user']);
  const inactive = daysSince(row.lastWorkoutDate);
  const atRisk = inactive == null || inactive >= 7;
  return (
    <Card clickable onClick={() => onSelect(u.uid)}>
      <div style="display:flex;align-items:center;gap:12px">
        {u.photoURL
          ? <img src={u.photoURL} alt="" style="width:38px;height:38px;border-radius:50%" />
          : <div style="width:38px;height:38px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-weight:700">{(u.displayName || u.email || '?')[0].toUpperCase()}</div>}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">{u.displayName || u.email}</div>
          <div style="font-size:.78rem;color:var(--text2)">
            Ultimo allenamento: <span style={atRisk ? 'color:var(--redline,#e54)' : ''}>{fmtDate(row.lastWorkoutDate)}</span>
            {' · '}{row.workouts7d ?? 0} negli ultimi 7g · {row.workouts30d ?? 0} negli ultimi 30g
          </div>
          {row.activeAssignment && (
            <div style="font-size:.75rem;color:var(--text2)">
              Scheda: {row.activeAssignment.title} · sett. {row.activeAssignment.currentWeek}/{row.activeAssignment.weeks}
              {row.activeAssignment.adherencePct != null && (
                <span style={`font-weight:700;color:${row.activeAssignment.adherencePct >= 70 ? 'var(--accent)' : 'var(--redline,#e54)'}`}>
                  {' '}· aderenza {row.activeAssignment.adherencePct}%
                </span>
              )}
            </div>
          )}
        </div>
        <span style="color:var(--text2);font-size:.9rem">›</span>
      </div>
    </Card>
  );
}

function PendingInviteRow({ row }: { row: CoachClientRow }) {
  const [busy, setBusy] = useState(false);
  async function revoke() {
    setBusy(true);
    try { await removeRelationship(row.relationship.id); toast('Invito revocato'); }
    catch (e) { toast('Errore', 'error'); setBusy(false); }
  }
  return (
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:.88rem">{row.user?.displayName || row.user?.email}</div>
        <div style="font-size:.75rem;color:var(--text2)">Invitato il {fmtDate(row.relationship.invitedAt)} · in attesa di conferma</div>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={revoke}>Revoca</button>
    </div>
  );
}

export function ClientRoster({ onSelect }: { onSelect: (uid: string) => void }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  useEffect(() => { loadCoachClients(); }, []);

  const rows = coachClients.value;
  const pending = rows.filter((r) => r.relationship.status === 'pending');
  const active = rows.filter((r) => r.relationship.status === 'active');
  const state = coachClientsState.value;

  return (
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" type="button" onClick={() => setInviteOpen(true)}>+ Invita cliente</button>
      </div>

      {pending.length > 0 && (
        <Card>
          <div class="card-title">Inviti in attesa</div>
          {pending.map((r) => <PendingInviteRow key={r.relationship.id} row={r} />)}
        </Card>
      )}

      {state === 'loading' && <EmptyState title="Caricamento…" />}
      {state === 'ok' && active.length === 0 && (
        <EmptyState
          title="Nessun cliente collegato"
          hint="Invita un cliente con la sua email: quando accetta, vedrai qui i suoi allenamenti."
        />
      )}
      {active.map((r) => <ActiveClientCard key={r.relationship.id} row={r} onSelect={onSelect} />)}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
