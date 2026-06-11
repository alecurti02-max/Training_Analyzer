import { render } from 'preact';
import { signal } from '@preact/signals';
import { PageShell, EmptyState } from '@/components/layout';
import { coachClients, coachClientsState } from '@/store/coach';
import type { Program } from '@/store/coach';
import { ClientRoster } from './ClientRoster';
import { ClientDetail } from './ClientDetail';
import { ProgramList } from './ProgramList';
import { ProgramBuilder } from './ProgramBuilder.jsx';

// Area Personal Trainer — pagina top-level "Clienti", visibile in nav solo ai
// trainer (gating in ui.js sul trainerProfile di /api/users/me/profile). Chi la
// apre via URL senza ruolo vede l'empty-state (le API rispondono comunque 403).
// Sub-navigazione (roster→dettaglio, schede→builder) via signals, niente route.

const selectedClientId = signal<string | null>(null);
const section = signal<'clienti' | 'schede'>('clienti');
// null = lista schede · {} = nuova · Program = modifica
const editingProgram = signal<Program | Record<string, never> | null>(null);

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

  let body;
  if (section.value === 'schede') {
    body = editingProgram.value !== null ? (
      <ProgramBuilder
        program={(editingProgram.value as Program).id ? editingProgram.value : null}
        onBack={() => { editingProgram.value = null; }}
      />
    ) : (
      <ProgramList onEdit={(p: Program | null) => { editingProgram.value = p || {}; }} />
    );
  } else {
    body = sel ? (
      <ClientDetail row={sel} onBack={() => { selectedClientId.value = null; }} />
    ) : (
      <ClientRoster onSelect={(uid: string) => { selectedClientId.value = uid; }} />
    );
  }

  return (
    <PageShell eyebrow="08 · CLIENTI" title="Clienti">
      <div class="lay-tabbar" style="margin-bottom:14px">
        <button class={`bm-tab${section.value === 'clienti' ? ' active' : ''}`} type="button"
          onClick={() => { section.value = 'clienti'; }}>Clienti</button>
        <button class={`bm-tab${section.value === 'schede' ? ' active' : ''}`} type="button"
          onClick={() => { section.value = 'schede'; }}>Schede</button>
      </div>
      {body}
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
  editingProgram.value = null;
}
