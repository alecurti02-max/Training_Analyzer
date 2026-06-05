import { signal } from '@preact/signals';

// Stub Fase 7a. Lo stato del wizard log (step/tipo/esercizi) verrà migrato in
// Fase 7c MANTENENDO il formato draft localStorage `wizDraft_<uid>` (forward/
// backward-compat). Placeholder per fissare la struttura degli store.
export const wizardActive = signal<boolean>(false);
