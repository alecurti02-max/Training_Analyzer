// Re-export of the TypeScript HTTP client (migrated to src/lib/api.ts).
// Mirrors the js/scoring.js shim pattern: legacy callers in client/js/* keep their
// `import ... from './api.js'` unchanged, while the actual implementation lives in
// ONE place (src/lib/api.ts).
//
// Crucially this guarantees a SINGLE token store: the access-token signal exists
// only in src/lib/api.ts, so auth.js's setTokens() and every api.* call share one
// source of truth — no split-token-store, no silent unauthenticated requests.
//
// New code should import directly from '@/lib/api'. This shim can be deleted once
// the last legacy js/ module (ui.js) is migrated to Preact.
export * from '../src/lib/api.ts';
