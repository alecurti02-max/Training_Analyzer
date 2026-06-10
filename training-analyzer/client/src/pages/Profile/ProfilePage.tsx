import { render } from 'preact';
import { PageShell, Card } from '@/components/layout';

// Profilo — route .tsx (WRAP). Scheletro con i 2 tab (Mio profilo/Amici) e gli
// id che ui.js::renderProfile e friends.js usano. Il listener diretto
// friend-search viene riagganciato da ui.js::wireDirectInputListeners dopo il
// mount. Pulsanti via delega data-action. Look 1:1.
export function ProfilePage() {
  return (
    <PageShell eyebrow="07 · PROFILO" title="Profilo">
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="bm-tab active" data-tab-group="profile" data-tab="me">Mio profilo</button>
        <button class="bm-tab" data-tab-group="profile" data-tab="friends">Amici</button>
      </div>

      <div data-tab-content="me">
        <Card>
          <div class="profile-card">
            <img class="profile-avatar-lg" id="profile-avatar" src="" alt="" />
            <div class="profile-info">
              <h3 id="profile-name" />
              <p id="profile-email" />
              <p id="profile-since" />
            </div>
          </div>
        </Card>
        <Card>
          <div class="card-title">Condividi il tuo profilo</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:8px">Gli amici possono trovarti cercando il tuo nome oppure con il tuo UID.</p>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
            <input type="text" id="profile-link" readOnly style="flex:1;font-size:.82rem" />
            <button class="copy-link-btn" data-action="copyAppLink">Copia Link</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="profile-uid" readOnly style="flex:1;font-size:.78rem;font-family:monospace;color:var(--text2)" />
            <button class="copy-link-btn" data-action="copyUID">Copia UID</button>
          </div>
        </Card>
        <div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-secondary" data-action="exportProfilePdf">Esporta PDF</button>
          <button class="btn btn-secondary" data-action="signOut">Esci dall'Account</button>
          <button class="btn btn-danger" data-action="deleteAccount">Elimina account</button>
        </div>
      </div>

      <div data-tab-content="friends" style="display:none">
        <Card>
          <div class="card-title">Cerca Persone</div>
          <div class="search-box">
            <input type="text" id="friend-search" placeholder="Cerca per nome..." />
            <div class="search-results" id="friend-search-results" />
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
            <p style="font-size:.78rem;color:var(--text2);margin-bottom:8px">Oppure aggiungi direttamente con l'UID (lo trovi nel profilo dell'amico):</p>
            <div style="display:flex;gap:8px">
              <input type="text" id="friend-uid-input" placeholder="Incolla UID amico..." style="flex:1;font-size:.85rem" />
              <button class="btn btn-primary btn-sm" data-action="addFriendByUID">Aggiungi</button>
            </div>
            <div id="uid-add-result" style="margin-top:8px" />
          </div>
        </Card>
        <Card>
          <div class="card-title">Persone che segui</div>
          <div id="following-list" />
        </Card>
        <Card>
          <div class="card-title">Confronto</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Seleziona le persone che segui per confrontare le statistiche.</p>
          <div id="compare-checkboxes" style="margin-bottom:12px" />
          <button class="btn btn-primary btn-sm" data-action="compareSelected">Confronta Selezionati</button>
          <div id="friend-compare-result" class="compare-section" />
        </Card>
      </div>
    </PageShell>
  );
}

export function mountProfilePage({ host }: { host: HTMLElement }) {
  if (host) render(<ProfilePage />, host);
}

export function unmountProfilePage(host?: HTMLElement) {
  const el = host || document.getElementById('profile-host');
  if (el) render(null, el);
}
