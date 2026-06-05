import { signal } from '@preact/signals';

// Stub Fase 7a. Lo stato della live session (timer/rest/draft) verrà migrato in
// Fase 7c MANTENENDO i formati `liveSession_<uid>` e `ta_live_rest_default`.
export const liveActive = signal<boolean>(false);
