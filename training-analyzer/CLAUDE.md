# Training Analyzer — Daemon

PWA full-stack per tracciare allenamenti multi-sport (gym, running, karting, altri),
analizzare progressi con AI, condividere con amici. Deploy Render + Neon Postgres.

> **REFACTOR IN CORSO**: il frontend sta migrando da Vanilla JS a Preact+Vite (strangler fig).
> Vedi `docs/refactor-roadmap.md`. Questa CLAUDE.md riflette lo **stato attuale** del codice;
> aggiornare a ogni fase completata.
>
> **Fase corrente**: 1 done (Vite+Preact scaffold + bridge legacy). Pages ancora servite dal vecchio
> `client/js/ui.js`. La nuova app Preact monta in `<div id="app">` ed è inattiva fino a Fase 5.

## Stack

- **Frontend**: Vanilla JS via ESM (`<script type="module">`), no build, no framework.
  Chart.js + jsPDF + autotable da CDN. CSS vanilla con custom properties.
- **Backend**: Node + Express + Sequelize + PostgreSQL (Neon). Anthropic SDK per AI.
- **Auth**: JWT (access + refresh) + Google OAuth via passport.
- **Deploy**: Render (server custom start con `db:migrate` automatico). DB Neon.

## Mappa progetto

```
training-analyzer/
├── client/                       Frontend statico (servito da Render)
│   ├── index.html                Markup completo + tag <script type="module" src="js/ui.js">
│   ├── js/                       14 file ESM
│   │   ├── ui.js          3406  ⚠️ MONOLITE: 8 pagine, wizard, live, state globali
│   │   ├── scoring.js      905  Business logic (workout score, recovery, streak, fitness)
│   │   ├── pdfExport.js    670  Export PDF profilo
│   │   ├── import.js       628  Parser GPX/CSV/Apple Health/FIT
│   │   ├── charts.js       486  Chart.js wrappers
│   │   ├── bodyMeasurements.js  478  Pagina misure corporee
│   │   ├── bodyAvatar.js   439  Canvas avatar 3D
│   │   ├── recovery.js     289  Pagina recupero (sonno + alimentazione)
│   │   ├── admin.js        239  Pagina admin
│   │   ├── friends.js      210  Social (search, follow, compare)
│   │   ├── api.js          159  fetch wrapper + JWT auto-refresh
│   │   ├── auth.js         155  login/logout + Google OAuth callback
│   │   └── sports.js       112  SPORT_TEMPLATES + FIELD_DEFS + DEFAULT_MUSCLES
│   ├── css/style.css      1613  ⚠️ Monolite con design tokens, dark/light, components
│   ├── fonts/                    Poppins + BasementGrotesque self-hosted (~3MB)
│   ├── manifest.json             PWA manifest
│   └── mood-board/               Design exploration (NON usato in app)
└── server/
    ├── src/
    │   ├── index.js              Entry: runMigrations() + listen. VINCOLO Render.
    │   ├── app.js                Express bootstrap, route mounting
    │   ├── config/               env.js, database.js (Sequelize), passport.js
    │   ├── models/               10 Sequelize models (User, Workout, Exercise, ...)
    │   ├── controllers/          12 controller (workout, profile, auth, ...)
    │   ├── routes/               11 route file (thin wrappers)
    │   ├── services/             ai (anthropicClient, aiAnalyzer, contextBuilder)
    │   ├── middleware/           authenticate, authorize, errorHandler, requireAdmin, ...
    │   └── utils/jwt.js          Token gen + verify
    ├── migrations/               15 file Sequelize CLI
    ├── seeders/                  Demo user + workout campione
    └── scripts/migrateFromFirebase.js  Tool storico, non più usato in deploy
```

## Dove sta cosa (attuale)

- **State frontend**: `client/js/ui.js:19-46` — `let currentUser, workoutsCache, settingsCache, exercisesCache, weightsCache, followingCache, activeSports, muscleGroups`.
- **API client**: `client/js/api.js`.
- **Routing pagine**: `client/js/ui.js::showPage` + `PAGE_ALIAS` + `PAGE_DEFAULT_TAB` (ui.js:175-230).
- **Wizard log workout**: `client/js/ui.js::initLogWizard, wizSaveWorkout, renderWizSets` (ui.js:374-945).
- **Live session**: `client/js/ui.js::initLivePage, liveStartTimer, liveDraft*` (ui.js:945-1600 circa).
- **Scoring + recovery + fitness**: `client/js/scoring.js`.
- **AI workout analysis**: `server/src/services/aiAnalyzer.js` + `contextBuilder.js` + `prompts/workoutAnalyzerSystem.js`.
- **AI profile coach**: `server/src/controllers/profileController.js` (⚠️ system prompt inline alle righe 6-25, target estrazione in Fase 2).
- **PDF export**: `client/js/pdfExport.js`.
- **Import GPX/CSV/Apple Health/FIT**: `client/js/import.js`.

## Convenzioni

- **Frontend ESM con import relativi**. NO bundler attuale (cambierà in Fase 1).
- **Backend CommonJS** (Node 18+). Migrazione a ESM non in scope.
- **Migration Sequelize**: ogni cambio model → file in `server/migrations/<timestamp>-<descr>.js`.
  Render esegue `runMigrations()` allo start (`server/src/index.js`). **NON rimuovere quella chiamata**.
- **CSS**: tokens in `:root` di `client/css/style.css`. Dark mode via `[data-theme="dark"]`.
- **Niente classi globali nuove se possibile**: il refactor sposterà tutto in CSS Modules.

## Comandi

```bash
# Backend dev
cd server && npm run dev          # nodemon, http://localhost:3000

# Frontend dev (Fase 1+: Vite con HMR)
cd client && npm install          # solo la prima volta
cd client && npm run dev          # http://localhost:5173, proxies /api a :3000
cd client && npm run build        # build prod in client/dist/
cd client && npm run preview      # serve client/dist/ in locale

# Migrations
cd server && npm run migrate            # applica forward
cd server && npm run migrate:undo       # rollback ultima
cd server && npm run seed               # demo user + workout

# Docker full stack
docker-compose up --build               # postgres + server + client

# Test backend (Fase 3 in poi)
cd server && npm run test:smoke    # 14 test integrazione HTTP+DB (SQLite in-memory), ~1s
cd server && npm run test:units    # 24 unit test su pure functions (slimmers, hrSummary, ...), ~50ms
cd server && npm test              # tutti i test
```

## Vincoli noti — leggere prima di toccare

- **Render auto-migrate**: in `server/src/index.js::runMigrations()` viene chiamato Sequelize CLI all'avvio del server, perché Render bypassa `npm start`. Non rimuovere quella chiamata. Vedi memoria `project_neon_migration` e `project_render_deploy_migrations`.
- **Build frontend per deploy**: il server serve `client/dist/` se esiste, altrimenti `client/` (fallback dev). Su Render aggiungere al start command: `cd client && npm ci && npm run build && cd ../server && npm start` (oppure equivalente Render build hook). Senza build, il server cade automaticamente sul vecchio `client/` ESM-puro, app funziona uguale ma senza la nuova UI Preact.
- **Body composition da 2 fonti**: peso/body fat possono arrivare da `Settings.bodyweight` o `BodyMeasurement.weight`. Allineamento via `syncSettingsFromMeasurement` (oggi sparso, da centralizzare). Vedi memoria `project_tech_debt`.
- **Live session draft**: `localStorage.liveSession_<uid>`. Cambio formato richiede forward-compat.
- **Scoring user-visible**: ogni workout in storico mostra `score`. Prima di toccare `scoring.js`, **fai snapshot fixture** di 20 workout reali e confronta output prima/dopo.
- **Render Start Command custom**: Render NON usa `npm start`, vedi memoria `project_render_deploy_migrations` per modifiche al deploy.
- **Domain `daemon.fit` NON registrato**, rebrand codebase deferred. Vedi memoria `project_product_name`.

## Quando modifichi X, leggi prima Y

- **Wizard log**: leggi `client/js/ui.js:374-945` + `client/js/sports.js` (SPORT_TEMPLATES, FIELD_DEFS).
- **Live session**: leggi `client/js/ui.js:945-1600` (timer, draft, rest preset).
- **AI workout analysis**: leggi `server/src/services/contextBuilder.js` + `server/src/services/aiAnalyzer.js` + `server/src/services/prompts/workoutAnalyzerSystem.js`. Contratto JSON output strict.
- **Scoring**: snapshot fixture prima, confronto obbligatorio dopo.
- **Model**: scrivi migration in `server/migrations/<timestamp>-<descr>.js` (verifica timestamp non duplicato).
- **Aggiungi pagina** (post-refactor): crea `client/src/pages/<Nome>/index.jsx`, registra in router.
- **Endpoint CRUD nuovo**: estendi `routes/<resource>.js` + (post-Fase2) `services/<resource>Service.js`.

## Refactor in corso

Vedere `docs/refactor-roadmap.md` per la roadmap completa. Stato attuale: **Fase 0 — Foundation**.

Fasi (ordinate):
0. Foundation (CLAUDE.md, baseline, smoke checklist) — questa fase.
1. Setup Vite + Preact + bridge legacy.
2. Backend service layer + CRUD helper + split `contextBuilder.js`.
3. Test backend smoke + scoring unit.
4. Componenti core (Card, Modal, Tabs, ...) + store signals.
5. Prima pagina migrata: Dashboard.
6. Migrazione pagine semplici (Profile, History, Body, Recovery, Progress, Setup, Admin).
7. Migrazione Train (wizard + live).
8. Cleanup + CSS split + finalize.

## Cosa NON fare

- Non rimuovere `runMigrations()` da `server/src/index.js`.
- Non scrivere prompt AI fuori da `server/src/services/prompts/` (post-Fase2).
- Non toccare `scoring.js` senza snapshot fixture preventiva.
- Non aggiungere TypeScript senza discussione (deferred, valutabile post-Fase 8).
- Non centralizzare la doppia fonte body composition senza una migration di dati.
