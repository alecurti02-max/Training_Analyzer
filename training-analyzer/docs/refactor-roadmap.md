# Refactor roadmap — Training Analyzer / Daemon

Piano completo: `/Users/alessandro/.claude/plans/io-credo-che-per-snazzy-chipmunk.md`.

## Obiettivo

Migrare frontend da Vanilla JS (un monolite `ui.js` da 3406 LOC) a **Vite + Preact + preact-iso + @preact/signals** con strategia **strangler fig**: convivenza vecchio/nuovo, una pagina migrata per volta, ogni step deployabile.

Backend: introdurre `makeCrudController` per eliminare boilerplate, splittare `contextBuilder.js`, estrarre prompt AI inline.

## Stack target

- **Frontend**: Preact + Vite + preact-iso + @preact/signals. CSS Modules + tokens globali. Vitest per test.
- **Backend**: Node + Express + Sequelize (invariato) + node:test + supertest per smoke.
- **Styling**: tokens.css globale + Component.module.css co-locato.

## Fasi

| # | Nome | Stima | Stato |
|---|---|---|---|
| 0 | Foundation (CLAUDE.md, baseline, smoke checklist) | 2h | ✅ done |
| 1 | Setup Vite + Preact + bridge legacy | 6h | ✅ done |
| 2 | Backend service layer + CRUD helper + split contextBuilder | 6h | ✅ done |
| 3 | Test backend smoke + scoring unit | 5h | ✅ done |
| 4 | Componenti core + store signals | 6h | ⚪ pending |
| 5 | Prima pagina migrata: Dashboard | 5h | ⚪ pending |
| 6 | Migrazione pagine semplici (Profile, History, Body, Recovery, Progress, Setup, Admin) | 10h | ⚪ pending |
| 7 | Migrazione Train (wizard + live) | 8h | ⚪ pending |
| 8 | Cleanup + CSS split + finalize | 5h | ⚪ pending |

**Totale stimato**: ~50h.

## Metriche di successo (vedi piano completo per dettaglio)

- LOC frontend file più grande: 3406 → ≤300
- Token Claude per orientarsi: ~30k → ~5k
- State globali `let`: 8+ → 0 (tutto via signals)
- Controller backend con boilerplate CRUD duplicato: 7 → 1
- Prompt AI inline: 1 → 0
- Test backend: 0 → ≥5
- Test scoring: 0 → ≥5

## Vincoli

1. **Niente big-bang**: ogni fase è atomic, deployabile, rollback-safe.
2. **Niente costi aggiuntivi**: stack 100% OSS, Render/Neon/Anthropic invariati.
3. **Render auto-migrate** in `server/src/index.js::runMigrations()` — NON rimuovere.
4. **Scoring user-visible**: snapshot fixture obbligatorio prima di toccare `scoring.js`.
5. **Backward compat draft localStorage** (`liveSession_<uid>`, `wizDraft_<uid>`).

## Pattern di lavoro

- **Una fase = una branch** (es. `refactor/fase-1-vite-setup`).
- **Smoke checklist** (`docs/smoke-tests.md`) eseguita prima di ogni merge.
- **CLAUDE.md aggiornato** alla fine di ogni fase con la nuova realtà.
- **Commit atomici** dentro la fase, ma merge solo a fase completa + smoke OK.
