import { Card } from '@/components/layout';
import { currentUser } from '@/store/user.js';
import { formatDate } from '@/lib/utils';

// Tab "Mio profilo": info utente (dal signal currentUser) + condivisione + azioni.
// I bottoni restano data-action (copyAppLink/copyUID/exportProfilePdf/signOut/
// deleteAccount) gestiti dalla delega globale di ui.js — azioni globali, non
// rendering di pagina, quindi non serve portarle qui.
export function MeTab() {
  const u = currentUser.value || {};
  const link = typeof window !== 'undefined' ? window.location.href : '';
  return (
    <>
      <Card>
        <div class="profile-card">
          <img class="profile-avatar-lg" src={u.photoURL || ''} alt="" />
          <div class="profile-info">
            <h3>{u.displayName || 'Utente'}</h3>
            <p>{u.email || ''}</p>
            {u.createdAt && <p>Registrato dal {formatDate(u.createdAt)}</p>}
          </div>
        </div>
      </Card>
      <Card>
        <div class="card-title">Condividi il tuo profilo</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:8px">Gli amici possono trovarti cercando il tuo nome oppure con il tuo UID.</p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <input type="text" value={link} readOnly style="flex:1;font-size:.82rem" />
          <button class="copy-link-btn" data-action="copyAppLink">Copia Link</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" value={u.uid || ''} readOnly style="flex:1;font-size:.78rem;font-family:monospace;color:var(--text2)" />
          <button class="copy-link-btn" data-action="copyUID">Copia UID</button>
        </div>
      </Card>
      <div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-secondary" data-action="exportProfilePdf">Esporta PDF</button>
        <button class="btn btn-secondary" data-page="setup">Setup</button>
        <button class="btn btn-secondary" data-action="signOut">Esci dall'Account</button>
        <button class="btn btn-danger" data-action="deleteAccount">Elimina account</button>
      </div>
    </>
  );
}
