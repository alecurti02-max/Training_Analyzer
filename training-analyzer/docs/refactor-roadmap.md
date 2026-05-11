# Refactor roadmap — Training Analyzer / Daemon

Piano completo: `/Users/alessandro/.claude/plans/io-credo-che-per-snazzy-chipmunk.md`.

## Stato finale (2026-05-11)

**8 fasi su 9 completate**, Fase 7 (Train) intenzionalmente deferred.
12 commit sul branch `claude/happy-bohr-aad106`, ~6800 LOC modificate/nuove.

| # | Nome | Stima | Stato |
|---|---|---|---|
| 0 | Foundation (CLAUDE.md, baseline, smoke checklist) | 2h | ✅ |
| 1 | Setup Vite + Preact + bridge legacy | 6h | ✅ |
| 2 | Backend service layer + CRUD helper + split contextBuilder | 6h | ✅ |
| 3 | Test backend smoke + scoring unit | 5h | ✅ |
| 4 | Componenti core + store signals + Toast/Modal | 6h | ✅ |
| 5 | Migrazione Dashboard | 5h | ✅ |
| 6a | Migrazione History + WorkoutItem condiviso | 2h | ✅ |
| 6b | Migrazione Profile (fitness + athletic) | 3h | ✅ |
| 6c | Migrazione Setup (Sports/Muscles) + Body BMI | 2h | ✅ |
| 7 | Migrazione Train (wizard + live) | 8h | ⏸️ DEFERRED |
| 8a | CSS split (tokens.css) + TOC | 1h | ✅ |
| 8b | Dead code removal + CLAUDE.md final | 1h | ✅ |

## Perché Fase 7 è deferred

Il Train (wizard log + live session) è ~1100 LOC dentro ui.js, con:
- Macchina a stati con draft localStorage (`wizDraft_<uid>`, `liveSession_<uid>`)
- Timer real-time pausabile
- Editing set/drop/weight options con validazione
- 20+ accessi a state globale (`workoutsCache`, `currentUser`, `exercisesCache`, ecc.)

Migrarlo a Preact pulito richiede prima introdurre uno store centralizzato in
`src/store/` per quei `let` globali, altrimenti i moduli estratti devono importare
via window.__state (anti-pattern).

**Il rischio è alto** (regressioni su flusso allenamento live = utenti perdono dati)
**il valore è basso ora** (Train funziona perfettamente, non sono previste nuove
feature lì). Quando si tocchera' il Train per una nuova feature, conviene fare
la migrazione contestualmente (creando lo store e migrando il pezzo modificato).

Documentate le line ranges in `CLAUDE.md` per orientarsi senza leggere tutto:
- Wizard: ui.js:285-944
- Live session: ui.js:945-1640

## Metriche di successo — Pre vs Post

| Metrica | Pre-refactor | Post-refactor | Target piano |
|---|---|---|---|
| LOC ui.js | 3406 | 3249 | ≤300 (mancato: Train deferred) |
| LOC contextBuilder.js | 290 | 38 (orchestratore) + 4 file specializzati | ≤100 ✅ |
| LOC profileController.js | 216 | 17 | ≤60 ✅ |
| CRUD boilerplate duplicato | 7 controller | 1 helper + 4 controller 20-25 LOC | 1 ✅ |
| Prompt AI inline | 1 (60 righe) | 0 | 0 ✅ |
| LOC style.css | 1613 | 1379 + tokens.css 269 + TOC | ≤200 (parziale) |
| Test backend | 0 | 38 (14 smoke + 24 unit) | ≥5 ✅ |
| Test frontend | 0 | 12 (vitest) | ≥5 ✅ |
| CLAUDE.md | assente | 220 righe con mappa completa | ≤120 (sforato per ricchezza info) |
| Pagine migrate a Preact | 0 | 5 (Dashboard, History, Profile, Setup, Body BMI) | 8 (mancato: Train) |
| Componenti riusabili Preact | 0 | 3 (Toast, Modal, WorkoutItem) | ≥9 (parziale) |
| Bundle JS prod | n/a (no build) | 259KB (77KB gz) | n/a |
| Token Claude per orientarsi | ~30k (apre ui.js) | ~5k (CLAUDE.md + 1 pagina Preact) | ~5k ✅ |

## Architettura risultante

### Backend (~3700 LOC src + 800 LOC test)

Layer chiari:
- `controllers/` — solo HTTP, ≤80 LOC ciascuno
- `services/ai/` — orchestrazione AI splittata in 8 file specializzati
- `services/prompts/` — un file per system prompt
- `utils/crud.js` — fabricator di CRUD handlers per pattern date-upsert
- `tests/` — 38 test passano in ~750ms con SQLite in-memory

### Frontend (~4900 LOC totali)

Strangler fig in corso:
- **Preact (src/)** — 794 LOC: 5 pagine + 3 componenti + lib + store. ESM + Vite + signals.
- **Legacy vanilla (js/)** — 8189 LOC totali (di cui ui.js 3249): orchestra wizard log + live session + bulk init. Pagine già migrate fanno solo delegate a Preact.
- **CSS** — tokens.css 269 LOC + style.css 1379 LOC (con TOC navigabile).

### Build & deploy

- Vite genera `client/dist/` con bundle JS unico (Preact + legacy ESM tutto incluso).
- Server serve `client/dist/` se esiste, altrimenti fallback su `client/` raw.
- Render: aggiungere `cd client && npm ci && npm run build` allo start del server.

## Tech debt rimanente

Documentato nelle memorie + qui:

1. **Train migration a Preact**: Fase 7 deferred. Da fare con la prossima modifica feature al wizard.
2. **State store centralizzato**: `let` globali in ui.js (workoutsCache + 7 altre). Da spostare in `src/store/*` quando si tocca Train.
3. **Body composition double-source**: `Settings.bodyweight` + `BodyMeasurement.weight`. Sync manuale. Migration di dati pending (memoria `project_tech_debt`).
4. **Rebrand "Daemon"**: deferred fino a prototipo usabile (memoria `project_product_name`).
5. **CSS split granulare**: solo tokens estratto. Per ulteriore split servirebbe migrare a CSS Modules (con i componenti Preact relativi).
6. **legacy renderFitnessAssessment dead code**: già rimosso in Fase 8b.

## Vincoli

1. **Render auto-migrate** in `server/src/index.js::runMigrations()` — NON rimuovere.
2. **Build Render**: serve aggiungere `npm run build` lato client allo start.
3. **Scoring user-visible**: snapshot fixture obbligatorio prima di toccare `scoring.js`.
4. **Backward compat draft localStorage** (`liveSession_<uid>`, `wizDraft_<uid>`).
5. **Niente big-bang**: ogni futura modifica resta atomic, deployabile, rollback-safe.
