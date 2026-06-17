# Training Analyzer — Daemon

PWA full-stack per tracciare allenamenti multi-sport (gym, running, karting, altri),
analizzare progressi con AI, condividere con amici. Deploy Render + Neon Postgres.

> **Stato refactor**: tutte le pagine principali su Preact. Il **Train (wizard +
> live)** è ora in `src/pages/Train/` ed è **il default per tutti**; il codice
> legacy in `ui.js` (wizard + live) resta come fallback dark-launched, attivabile
> col kill-switch `localStorage.ta_train_preact='0'`. Strangler fig: il vecchio
> `client/js/ui.js` convive ancora coi componenti Preact e fa da orchestratore.
> Cancellare il blocco Train legacy da ui.js è il prossimo passo, dopo che il
> nuovo ha girato in prod senza regressioni.

## Stack

- **Frontend**: Preact 10 + Vite 5 + @preact/signals. Build → `client/dist/`.
- **Legacy frontend**: Vanilla JS ESM in `client/js/` (ui.js orchestra + moduli satelliti).
- **Backend**: Node 20 + Express + Sequelize + PostgreSQL (Neon). Anthropic SDK per AI.
- **Auth**: JWT (access + refresh) + Google OAuth (solo prod).
- **Test**: `node --test` + supertest per backend, vitest per frontend.

## Mappa progetto

```
training-analyzer/
├── CLAUDE.md                   Questo file
├── docs/
│   ├── refactor-roadmap.md     Stato + metriche del refactor
│   ├── refactor-baseline.txt   LOC snapshot pre-refactor
│   └── smoke-tests.md          Checklist manuale (15 sezioni)
├── client/
│   ├── index.html              Markup + <div id="app"> per Preact + script ui.js legacy
│   ├── vite.config.js          Alias @/ → src/, proxy /api → backend
│   ├── vitest.config.js        Test runner per src/
│   ├── package.json
│   ├── css/
│   │   ├── tokens.css          269 LOC — fonts, palette, vars, keyframes
│   │   └── style.css           1380 LOC — components + pages, con TOC iniziale
│   ├── js/                     LEGACY: vanilla ESM, da ridurre nel tempo
│   │   ├── ui.js               3250 LOC — orchestra, wizard log (285-944),
│   │   │                       live session (945-1640), bulk wiring
│   │   ├── api.js              159 LOC — fetch wrapper (versione legacy)
│   │   ├── auth.js             155 LOC — login/logout legacy
│   │   ├── scoring.js          shim 4 righe → re-export di src/scoring/scoring.ts
│   │   ├── sports.js           112 LOC — SPORT_TEMPLATES, FIELD_DEFS, DEFAULT_MUSCLES
│   │   ├── charts.js           486 LOC — Chart.js wrappers (heatmap, weekly, radar, ...)
│   │   ├── pdfExport.js        670 LOC — Export PDF profilo
│   │   ├── import.js           628 LOC — Parser GPX/CSV/Apple Health/FIT
│   │   ├── bodyMeasurements.js 478 LOC — Pagina misure
│   │   ├── bodyAvatar.js       439 LOC — Canvas avatar
│   │   ├── recovery.js         289 LOC — Pagina recupero
│   │   ├── admin.js            239 LOC — Pagina admin
│   │   └── friends.js          210 LOC — Social (search, follow, compare)
│   └── src/                    NUOVO: Preact app, strangler fig destination
│       ├── main.jsx            Bootstrap + bridge globalThis.Preact.<page>
│       ├── App.jsx             Passthrough (?preact=1 mostra banner)
│       ├── lib/
│       │   ├── api.ts          169 LOC — fetch wrapper modernizzato (signals, TS)
│       │   ├── utils.js        57 LOC — uid, todayStr, formatDate, paceToSeconds, ...
│       │   └── __tests__/utils.test.js   12 vitest unit
│       ├── scoring/            business logic TS (migrata da js/scoring.js)
│       │   ├── scoring.ts      1065 LOC — scoreWorkout, getAdvice, getRecoveryStatus,
│       │   │                   calculateStreak, getFitnessAssessment, bodyComposition
│       │   └── __tests__/      scoring.test.ts (21) + scoring.characterization (snapshot)
│       ├── types/              workout/exercise/user/ai/api — discriminated unions (TS)
│       ├── store/
│       │   └── user.js         38 LOC — signal currentUser + login/logout
│       ├── components/         Riusabili: Toast, Modal, WorkoutItem
│       └── pages/              Una cartella per pagina migrata
│           ├── Dashboard/      Stats + Streak + Recovery + Recent
│           ├── History/        Filtri + lista workout
│           ├── Profile/        FitnessAssessment + AthleticDetail
│           ├── Setup/          SportsManager + MuscleGroupsManager
│           └── Body/           BMI banner
└── server/
    ├── src/
    │   ├── index.js, app.js
    │   ├── config/             env, database (dialect auto: postgres prod / sqlite test),
    │   │                       passport
    │   ├── models/             16 Sequelize models (10 base + 6 CRM PT)
    │   ├── controllers/        Sottili. CRUD via utils/crud.js (4 risorse).
    │   ├── routes/             11 thin routers
    │   ├── middleware/         authenticate, authorize, errorHandler, ...
    │   ├── services/
    │   │   ├── ai/             8 file: anthropicClient, workoutAnalyzer,
    │   │   │                   coachSummary, contextBuilder, slimmers,
    │   │   │                   hrSummary, splitsSummary, jsonExtract
    │   │   ├── prompts/        System prompt Anthropic (workoutAnalyzerSystem,
    │   │   │                   profileCoachSystem) — uno per file
    │   │   └── workoutImporter.js  Parser JSON/CSV per import
    │   └── utils/
    │       ├── crud.js         makeDateUpsertController + pickFieldsFromSpec
    │       ├── safeNum.js
    │       └── jwt.js
    ├── tests/
    │   ├── setup.js            Env per test (sqlite in-memory)
    │   ├── smoke.test.js       14 integration test
    │   └── units.test.js       24 unit test su pure functions
    ├── migrations/             Sequelize CLI
    └── seeders/                Demo user
```

## Dove sta cosa

### State

- **Fonte di verità: signal store in `src/store/`** (M1/P3, giu 2026): workouts,
  settings (+activeSports/muscleGroups), exercises, weights, following, user.
  OGNI mutazione passa dai setter/azioni degli store (`setWorkouts`, `addWorkout`,
  `removeWorkouts`, `updateWorkout`, `setSettings`, `setExercises`, `setWeights`,
  `setFollowing`, `setActiveSports`, `setMuscleGroups`, `setUser`).
- **ui.js**: le vecchie `let` (workoutsCache, settingsCache, …) sono REPLICHE DI
  LETTURA sincronizzate via `effect()` in testa al file. Il codice legacy le legge
  come prima, ma NON vanno mai riassegnate né mutate in place (push/splice/sort/
  index-set), o i lettori Preact non si aggiornano. `syncFromLegacy`/dataSync è
  stato rimosso.

### Bridge Preact ↔ Legacy

- `globalThis.Preact.dashboard.mount({workouts, settings, muscleGroups})`
- `globalThis.Preact.history.mount({workouts, filter, selectMode, selectedIds})`
- `globalThis.Preact.profile.mountFitness({...}) / .mountAthletic({...})`
- `globalThis.Preact.setup.mountSports({activeSports}) / .mountMuscleGroups({muscleGroups})`
- `globalThis.Preact.body.mountBmiBanner({weights, settings})`

Ogni `render<Page>` in ui.js chiama il rispettivo `Preact.<page>.mount()`. Click
handling (workout-item, hist-filter, ecc.) continua via global delegation in ui.js.

### Pagine NON ancora migrate a Preact

- **Train (wizard log + live session)** — MIGRATO a Preact in `src/pages/Train/`
  (default-on; kill-switch `ta_train_preact='0'`). Logica pura verificata in
  `src/pages/Train/logic/` (setModel, buildWorkout, liveTimer) + test. Il codice
  legacy in `ui.js` (~285-944 wizard, ~945-1640 live) è ancora presente come
  fallback — da rimuovere quando il nuovo è confermato stabile in prod.
- **Exercise Library** (Setup tab) — linee ~2580-2770. CRUD esercizi con filtri.
- **Friends** wrapper in ui.js — delega a js/friends.js già modulare.
- **Progress, Body (oltre BMI), Recovery, Admin** — delegano già a moduli esterni
  modulari (charts.js, bodyMeasurements.js, recovery.js, admin.js).

### AI

- **Workout analysis**: `server/src/services/ai/workoutAnalyzer.js` +
  `contextBuilder.js` + `services/prompts/workoutAnalyzerSystem.js`. Output JSON strict.
- **Profile coach summary**: `services/ai/coachSummary.js` +
  `services/prompts/profileCoachSystem.js`. POST /api/profile/health.

### CRUD pattern (backend)

- `server/src/utils/crud.js::makeDateUpsertController({Model, pickFields, entityName})`
  genera list/create/update/destroy con `findOrCreate({userId, date})` upsert.
  Opzioni avanzate (CRM): `ownerId(req)` resolver, `stampFields(req)` (solo in
  create — mai riassegna la proprietà su upsert), `mutationWhere(req)`.
- Usato da: weight, sleep, nutrition, body-measurement (4 controller, ~20 LOC
  ciascuno) + planned-workout (anche in variante coach).

### CRM Personal Trainer (F1–F4, giu 2026)

- **Ruolo trainer** = riga in `trainer_profiles` (NON `User.role`); attivazione:
  env `TRAINER_EMAILS` (boot, come `ADMIN_EMAIL`), pagina `/register-pt`
  (self-serve, flag `asTrainer` su register), o admin. Middleware `requireTrainer`.
- **Relazione** `coach_clients` con consenso (invito email → accept), UNIQUE
  (coachId, clientId), re-invito riusa la riga. `loadCoachClient` carica la
  relazione ATTIVA su /api/coach/clients/:clientId/*; `requireSharing(key)` gata
  i dati sensibili sull'opt-in del cliente (`sharing` JSONB, solo lui lo cambia).
- **Schede**: `programs` (giorni A/B/C JSONB + progressioni per-settimana) +
  `program_assignments` (startDate, weekdayMap; currentWeek SEMPRE calcolata —
  `services/assignmentMath.js`, speculare a `client/src/lib/progression.ts`:
  tenerli in sync). Esecuzione on-demand: launchDay → live coi carichi al
  loadPct → salvataggio con lift anti-forgery di `data._assignment` in colonne
  `workouts.assignment*` (week ricalcolata server-side). Aderenza in
  `services/adherenceService.js`.
- **CRM**: `coach_client_profiles` (anagrafica + note timeline — MAI esposte su
  route client-facing, test dedicato in `tests/crm.test.js`) e `client_packages`
  (+1 seduta manuale, alert scadenze computati nel roster).
- **Client**: pagina `Clienti` (`src/pages/Clienti/`, Preact-only, nav gated su
  `user.trainerProfile`), tab Coach in `ProfilePage` (`CoachTab.tsx`), store
  `store/coach.ts` (lato PT) e `store/myCoach.ts` (lato cliente).
- **Monetizzazione futura**: `router.use('/api/coach', requirePremium)` — non
  applicato in v1.

## Convenzioni

- **Nessun file > 300 LOC** target per Preact code. Legacy ui.js fa eccezione
  documentata (Train deferred).
- **State**: niente `let` globali in src/. Solo signals in `src/store/`.
  Per ora ui.js usa ancora `let` perché Train + caches sono legacy.
- **CSS**: token globali in `css/tokens.css`. Resto in `style.css` con TOC.
  Quando un componente cresce, valutare CSS Modules per quello specifico.
- **Prompt AI**: SEMPRE in `server/src/services/prompts/`, mai inline.
- **Migration Sequelize**: ogni cambio model → file in `server/migrations/`.
  Render esegue `runMigrations()` in `server/src/index.js` allo start.

## Comandi

```bash
# Backend dev
cd server && npm run dev          # nodemon, http://localhost:3000
# Se la 3000 e' occupata: imposta PORT=3001 nel .env

# Frontend dev (Vite con HMR)
cd client && npm run dev          # http://localhost:5173, proxy /api a :3000
# Se backend e' su altra porta: VITE_API_PORT=3001 npm run dev

# Frontend build prod
cd client && npm run build        # → client/dist/ (servito da server in prod)

# Test backend
cd server && npm run test:smoke   # 14 integration test (sqlite in-memory), ~1s
cd server && npm run test:units   # 24 unit test su pure functions, ~50ms
cd server && npm test             # tutto

# Test frontend
cd client && npm test             # vitest (utils + futuri)

# Migrations
cd server && npm run migrate            # applica forward
cd server && npm run migrate:undo       # rollback ultima
cd server && npm run seed               # demo user

# Docker full stack
docker-compose up --build
```

## Vincoli noti — leggere prima di toccare

- **Render auto-migrate**: `server/src/index.js::runMigrations()` chiama Sequelize CLI
  all'avvio perche' Render bypassa `npm start`. NON rimuovere. Memorie
  `project_neon_migration`, `project_render_deploy_migrations`.
- **Build frontend per deploy Render**: aggiungere `cd client && npm ci && npm run build`
  prima dello start del server. Il server serve `client/dist/` se esiste, altrimenti
  fallback su `client/` raw (cosi' dev locale non rompe).
- **Body composition da 2 fonti** (BodyMeasurement + Settings.bodyweight). Sync via
  `syncSettingsFromMeasurement`. Memoria `project_tech_debt`.
- **Live session draft**: `localStorage.liveSession_<uid>`. Cambio formato richiede
  forward-compat.
- **Wizard draft**: `localStorage.wizDraft_<uid>`. Idem.
- **Scoring user-visible**: ogni workout in storico mostra `score`. Prima di toccare
  `src/scoring/scoring.ts` o i call-site di save/score, confronta l'output con
  `src/scoring/__tests__/scoring.characterization.test.ts` (snapshot degli score).
- **Domain `daemon.fit` NON registrato**, rebrand codebase deferred. Memoria
  `project_product_name`.

## Quando modifichi X, leggi prima Y

- **Wizard log**: `js/ui.js:285-944` + `js/sports.js`.
- **Live session**: `js/ui.js:945-1640` (timer, draft, rest preset).
- **Migrare una pagina legacy a Preact**: pattern in `src/pages/Dashboard/Dashboard.jsx`
  + `src/main.jsx` (bridge) + ui.js (delega). Mantenere il markup uguale per non
  rompere i CSS selector globali e la click delegation.
- **AI workout analysis**: `server/src/services/ai/contextBuilder.js` +
  `services/prompts/workoutAnalyzerSystem.js`. Output JSON strict.
- **Scoring**: snapshot fixture prima, confronto obbligatorio dopo.
- **Model Sequelize**: scrivi migration in `server/migrations/<timestamp>-<descr>.js`.
- **Endpoint CRUD nuovo (date-upsert)**: estendi `routes/<resource>.js` + crea
  `services/<resource>Service.js`, usa `utils/crud.js::makeDateUpsertController`.

## Cosa NON fare

- Non rimuovere `runMigrations()` da `server/src/index.js`.
- Non scrivere prompt AI fuori da `server/src/services/prompts/`.
- Non aggiungere `let` globali in `src/`. Usa signals in `store/`.
- TS è adottato in `src/` (scoring, api, types). Nuovo codice `src/` può essere TS;
  il legacy `js/` resta JS — niente migrazione TS di massa senza discussione.
- Non eliminare js/ui.js finche' Train non e' migrato.
- Non toccare le migration Sequelize esistenti — sempre add forward.
