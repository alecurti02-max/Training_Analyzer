# Training Analyzer — Daemon

PWA full-stack per tracciare allenamenti multi-sport (gym, running, karting, altri),
analizzare progressi con AI, condividere con amici. Deploy Render + Neon Postgres.

> **Stato refactor**: 8 fasi su 9 completate (Fase 7 Train migration deferred).
> Vedi `docs/refactor-roadmap.md` per dettaglio. Strangler fig: il vecchio
> `client/js/ui.js` convive con i nuovi componenti Preact; le pagine migrate
> usano Preact, il wizard log + live session restano vanilla per ora.

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
│   │   ├── scoring.js          905 LOC — business logic (calculateStreak,
│   │   │                       getRecoveryStatus, getFitnessAssessment, scoreWorkout)
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
│       │   ├── api.js          137 LOC — fetch wrapper modernizzato (signals)
│       │   ├── utils.js        57 LOC — uid, todayStr, formatDate, paceToSeconds, ...
│       │   └── __tests__/utils.test.js   12 vitest unit
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
    │   ├── models/             10 Sequelize models
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

- **Legacy (ui.js)**: `let workoutsCache, settingsCache, exercisesCache, weightsCache,`
  `currentUser, muscleGroups, activeSports, followingCache` (linee 19-46).
  Modificato direttamente da funzioni in ui.js. Passato come props a Preact via
  `globalThis.Preact.<page>.mount({...})`.
- **Preact**: `src/store/user.js` ha `currentUser` signal. Altri store arriveranno
  quando il legacy state verrà smantellato (Fase 7 / 8 successiva).

### Bridge Preact ↔ Legacy

- `globalThis.Preact.dashboard.mount({workouts, settings, muscleGroups})`
- `globalThis.Preact.history.mount({workouts, filter, selectMode, selectedIds})`
- `globalThis.Preact.profile.mountFitness({...}) / .mountAthletic({...})`
- `globalThis.Preact.setup.mountSports({activeSports}) / .mountMuscleGroups({muscleGroups})`
- `globalThis.Preact.body.mountBmiBanner({weights, settings})`

Ogni `render<Page>` in ui.js chiama il rispettivo `Preact.<page>.mount()`. Click
handling (workout-item, hist-filter, ecc.) continua via global delegation in ui.js.

### Pagine NON ancora migrate a Preact

- **Train (wizard log + live session)** — linee ui.js 285-944 (wizard) +
  945-1640 (live). State complesso + draft localStorage + timer real-time.
  Migrazione deferred a quando si tocca per una nuova feature.
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
- Usato da: weight, sleep, nutrition, body-measurement (4 controller, ~20 LOC ciascuno).

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
  `scoring.js`, fai snapshot fixture di 20 workout reali e confronta output.
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
- Non aggiungere TypeScript senza discussione (deferred).
- Non eliminare js/ui.js finche' Train non e' migrato.
- Non toccare le migration Sequelize esistenti — sempre add forward.
