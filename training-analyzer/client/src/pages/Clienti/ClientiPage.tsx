import { render } from 'preact';
import { signal } from '@preact/signals';
import { PageShell, EmptyState } from '@/components/layout';
import { coachClients, coachClientsState } from '@/store/coach';
import { ClientRoster } from './ClientRoster';
import { ClientDetail } from './ClientDetail';

// Area Personal Trainer — pagina top-level "Clienti", visibile in nav solo ai
// trainer (gating in ui.js sul trainerProfile di /api/users/me/profile). Chi la
// apre via URL senza ruolo vede l'empty-state (le API rispondono comunque 403).
// Sub-navigazione roster→dettaglio via signal, niente route annidate.

const selectedClientId = signal<string | null>(null);

function ClientiApp() {
  if (coachClientsState.value === 'forbidden') {
    return (
      <PageShell eyebrow="08 · CLIENTI" title="Clienti">
        <EmptyState
          title="Area riservata ai Personal Trainer"
          hint="Il tuo account non ha il ruolo trainer. Contattaci se sei un PT e vuoi attivarlo."
        />
      </PageShell>
    );
  }

  const sel = selectedClientId.value
    ? coachClients.value.find((r) => r.user?.uid === selectedClientId.value)
    : null;

  return (
    <PageShell eyebrow="08 · CLIENTI" title="Clienti">
      {sel ? (
        <ClientDetail row={sel} onBack={() => { selectedClientId.value = null; }} />
      ) : (
        <ClientRoster onSelect={(uid: string) => { selectedClientId.value = uid; }} />
      )}
    </PageShell>
  );
}

export function mountClienti({ host }: { host: HTMLElement }) {
  if (host) render(<ClientiApp />, host);
}

export function unmountClienti(host?: HTMLElement) {
  const el = host || document.getElementById('clienti-host');
  if (el) render(null, el);
  selectedClientId.value = null;
}
