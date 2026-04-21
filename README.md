# Training Analyzer

Web app per tracciare allenamenti multi-sport, analizzare progressi e confrontarsi con amici.

---

## Stato attuale del repository (aprile 2026)

In questo repo convivono **due versioni** dell'app. NON modificare i file della versione legacy nella root: sono ancora in produzione su GitHub Pages.

### Versione legacy (v3.1) — root del repo

I file nella root (`index.html`, `js/app.js`, `css/style.css`, `fonts/`, `manifest.json`, `logo_ta.png`) sono la **vecchia versione client-only con Firebase** come backend. Questa versione:

- E **ancora in produzione** su GitHub Pages e viene usata dagli utenti attuali
- **Non va toccata** finche gli utenti non avranno fatto l'export dei propri dati
- Verra ritirata dopo la migrazione completa a v3.2

### Versione attiva (v3.2) — `training-analyzer/`

Tutto lo sviluppo avviene dentro **[`training-analyzer/`](training-analyzer/)**. Questa e l'architettura full-stack che sostituira la versione legacy:

- **Client:** `training-analyzer/client/` — Vanilla JS (ES modules), Chart.js, PWA
- **Server:** `training-analyzer/server/` — Node.js 20, Express 4, PostgreSQL 16, Sequelize 6
- **Deploy:** Render (auto-deploy da `main`, root dir impostata su `training-analyzer`)
- **Live:** https://training-analyzer-oiu2.onrender.com

> Quando si lavora su bugfix o nuove feature, si modifica SOLO il codice dentro `training-analyzer/`. I file nella root sono congelati.

---

## Struttura del progetto

```
.
├── training-analyzer/               <-- VERSIONE ATTIVA (v3.2, full-stack)
│   ├── client/                      Frontend
│   │   ├── index.html               HTML (login, nav, pagine, modali)
│   │   ├── css/style.css            Stili (tema rosso, dark/light, responsive)
│   │   ├── manifest.json            PWA manifest
│   │   ├── logo_ta.png              Logo/icona app
│   │   ├── fonts/                   BasementGrotesque + Poppins
│   │   └── js/
│   │       ├── ui.js                Orchestratore: stato, render, wizard, PubMed
│   │       ├── api.js               Layer HTTP centralizzato + JWT auto-refresh
│   │       ├── auth.js              Login Google OAuth + email/password
│   │       ├── sports.js            SPORT_TEMPLATES, FIELD_DEFS, costanti
│   │       ├── scoring.js           Score workout, recovery, streak, fitness assessment
│   │       ├── charts.js            Chart.js, heatmap canvas, tutti i grafici
│   │       ├── import.js            GPX, CSV, Apple Health, FIT, JSON backup
│   │       └── friends.js           Ricerca utenti, follow, confronto stats
│   ├── server/                      Backend (Node.js + Express)
│   │   ├── src/
│   │   │   ├── index.js             Entry point (listen + DB sync + connect)
│   │   │   ├── app.js               Express: helmet, cors, rate-limit, routes
│   │   │   ├── config/
│   │   │   │   ├── database.js      Sequelize + PostgreSQL (SSL in prod)
│   │   │   │   ├── passport.js      Google OAuth2 + Local (OAuth opzionale)
│   │   │   │   └── env.js           Validazione env vars (Google OAuth opzionale)
│   │   │   ├── models/              User, Workout, Exercise, Settings, Weight, Follow
│   │   │   ├── routes/              auth, workouts, exercises, settings, weights, users
│   │   │   ├── controllers/         Logica business (un file per route)
│   │   │   ├── middleware/          authenticate (JWT), authorize, errorHandler
│   │   │   └── utils/jwt.js         Generazione/verifica JWT
│   │   ├── migrations/              6 migration Sequelize
│   │   ├── seeders/                 Demo user + workout campione
│   │   ├── scripts/
│   │   │   └── migrateFromFirebase.js  Migrazione dati da Firebase
│   │   ├── Dockerfile               Node 20 alpine multi-stage
│   │   └── package.json
│   ├── docker-compose.yml           PostgreSQL 16 + server
│   ├── .env.example                 Template variabili d'ambiente
│   └── .gitignore
│
├── index.html                       LEGACY v3.1 — NON TOCCARE (GitHub Pages)
├── css/style.css                    LEGACY
├── js/app.js                        LEGACY (tutto in un file singolo, ~115KB)
├── fonts/                           LEGACY
├── manifest.json                    LEGACY
├── logo_ta.png                      LEGACY
├── graphic_adj/                     LEGACY (screenshot di riferimento)
└── logica_valutazione_forma_fisica.md  LEGACY (doc sulla logica di scoring)
```

---

## Stack tecnologico (v3.2)

| Layer | Tecnologia |
|---|---|
| Frontend | Vanilla JS (ES modules), Chart.js 4.4.1, no framework, no build step |
| Backend | Node.js 20, Express 4 |
| Database | Neon PostgreSQL 16 (serverless, prod) · PostgreSQL 16 in Docker (dev) |
| ORM | Sequelize 6 |
| Auth | Passport.js (Google OAuth2 + Local), JWT (access 15min + refresh 7gg) |
| Security | helmet, cors, express-rate-limit, bcryptjs |
| Container | Docker, docker-compose |
| Hosting | Render (Web Service) + Neon (database) |

---

## Deploy

### Versione attiva (Render + Neon)

- **Web Service:** Render, root dir `training-analyzer`, Node runtime
- **Database:** Neon PostgreSQL (serverless, region AWS `eu-central-1` Frankfurt, stessa area di Render)
- **Build command:** `cd server && npm install`
- **Start command:** `cd server && node src/index.js`
- **Auto-deploy:** su ogni push a `main` (solo `training-analyzer/` viene usato da Render)
- Le tabelle vengono create automaticamente (`sequelize.sync()`)
- Google OAuth e opzionale: il server parte anche senza le credenziali Google

> Il `DATABASE_URL` di produzione punta a Neon e deve contenere `?sslmode=require`. Connessione, pool e timeout sono tarati per Neon in [`server/src/config/database.js`](training-analyzer/server/src/config/database.js) (cold-start tollerante, idle sotto la soglia di auto-suspend). La migrazione Render PostgreSQL → Neon è stata completata il 2026-04-21; la procedura usata è documentata in [`MIGRATION_RENDER_TO_NEON.md`](training-analyzer/MIGRATION_RENDER_TO_NEON.md) come riferimento storico.

### Versione legacy (GitHub Pages)

- Servita direttamente dalla root del repo (branch `main`)
- Backend: Firebase Realtime Database (configurato in `js/app.js`)
- Verra spenta dopo la migrazione degli utenti alla v3.2

---

## Quick Start (v3.2 locale)

### Con Docker

```bash
cd training-analyzer
cp .env.example .env
# Modifica .env con JWT secrets (Google OAuth opzionale)

docker-compose up --build
# Server su http://localhost:3000
# PostgreSQL su localhost:5432
```

### Senza Docker

```bash
# 1. Avvia PostgreSQL e crea database:
createdb training_analyzer

# 2. Configura ambiente:
cd training-analyzer
cp .env.example .env
# Modifica DATABASE_URL e JWT secrets

# 3. Installa e avvia:
cd server
npm install
npm run dev

# Server su http://localhost:3000
# Il client viene servito automaticamente da Express
```

---

## Variabili d'ambiente

| Variabile | Richiesta | Descrizione |
|---|---|---|
| `DATABASE_URL` | Si | Connection string PostgreSQL. In prod: Neon (`postgres://…neon.tech/…?sslmode=require`). In dev: Docker locale. |
| `JWT_SECRET` | Si | Segreto per access token (64 char random) |
| `JWT_REFRESH_SECRET` | Si | Segreto per refresh token (64 char random) |
| `NODE_ENV` | No | `production` o `development` (default). In prod abilita SSL + pool tarato per Neon. |
| `PORT` | No | Porta server (default `3000`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | Callback URL OAuth |
| `CLIENT_ORIGIN` | No | Origin per CORS |

Se le variabili Google OAuth non sono configurate, il login Google viene disabilitato automaticamente. Il login email/password funziona sempre.

---

## API Endpoints

### Autenticazione

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/auth/register` | Registrazione email/password |
| POST | `/api/auth/login` | Login email/password |
| POST | `/api/auth/logout` | Logout (invalida refresh token) |
| POST | `/api/auth/refresh` | Rinnova access + refresh token |
| GET | `/api/auth/google` | Avvia Google OAuth (se configurato) |
| GET | `/api/auth/google/callback` | Callback Google OAuth |

### Workout (autenticazione richiesta)

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/workouts?type=&from=&to=&limit=&offset=` | Lista con filtri (default limit 50, max 5000) |
| GET | `/api/workouts/:id` | Dettaglio singolo |
| POST | `/api/workouts` | Crea nuovo (`{ type, date, data }`) |
| PUT | `/api/workouts/:id` | Aggiorna |
| DELETE | `/api/workouts` | Elimina tutti i workout dell'utente |
| DELETE | `/api/workouts/:id` | Elimina singolo |
| DELETE | `/api/workouts/bulk` | Elimina multipli (`{ ids: [...] }`) |
| POST | `/api/workouts/import` | Import file (multipart) |

### Esercizi, Settings, Peso

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/exercises[/:id]` | CRUD libreria esercizi |
| GET/PUT | `/api/settings` | Leggi/aggiorna impostazioni |
| GET/POST/PUT/DELETE | `/api/weights[/:id]` | CRUD log peso |

### Utenti e Social

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/users/search?q=` | Cerca per nome (ILIKE) |
| GET | `/api/users/me/profile` | Profilo + stats corrente |
| GET | `/api/users/me/following` | Lista utenti seguiti |
| GET | `/api/users/:uid/stats` | Stats pubbliche di un utente |
| POST | `/api/users/:uid/follow` | Segui utente |
| DELETE | `/api/users/:uid/follow` | Smetti di seguire |

### Health check

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/health` | Status server (`{ status: "ok" }`) |

---

## Schema Database

```
users           1:N  workouts    (userId FK)
users           1:N  exercises   (userId FK)
users           1:1  settings    (userId PK/FK)
users           1:N  weights     (userId FK)
users (follower) N:M users (following) via follows (PK composta)

Workout.data    JSONB — dettagli completi (esercizi, serie, scores, advice)
Settings        JSONB — activeSports, activeGroups, dati biometrici
```

Il client fa il flatten dei workout (merge di `.data` nel top-level) per compatibilita con la logica di rendering. I campi `id`, `type`, `date` del DB hanno sempre priorita sui campi omonimi in `.data`.

---

## Funzionalita principali

- **20+ sport personalizzabili** con template e campi dedicati
- **Wizard multi-step** per la registrazione allenamenti
- **Scoring 0-10** per tipo di sport (palestra, corsa, karting, generico)
- **Profilo atletico** con radar chart su 6 dimensioni (forza, resistenza, consistenza, recupero, progressione, varieta)
- **Valutazione forma fisica** su 7 componenti pesate
- **Streak tracking** con record storico
- **Sistema amici** con follow, ricerca e confronto statistiche
- **Import multi-formato:** GPX (con split e grafici), CSV, Apple Health XML, FIT, JSON backup
- **Export/Import backup** JSON completo
- **Live Workout** per il tracking in tempo reale delle sessioni
- **Multi-select e bulk delete** nella cronologia workout
- **PubMed integration** per articoli scientifici correlati
- **Recovery status** per gruppo muscolare
- **PWA installabile** (standalone, icona adattiva)
- **Tema dark/light** automatico (OS) + override manuale
- **Login duale:** Google OAuth + email/password (Google opzionale)

---

## Scoring

Il calcolo dello score e **client-side** (`client/js/scoring.js`). Il server riceve e salva lo score calcolato.

- **Palestra:** volume 25% + intensita 25% + progressione 25% + varieta 15% + durata 10%
- **Corsa:** distanza 25% + pace 30% + efficienza FC 25% + sforzo 20%
- **Karting:** costanza 35% + miglioramento 40% + sforzo 25%
- **Altri sport:** RPE 60% + durata 40%

---

## Piano di migrazione (legacy → v3.2)

1. Completare le feature e i bugfix sulla v3.2 (in corso)
2. Gli utenti attuali fanno export JSON dalla versione legacy (GitHub Pages)
3. Gli utenti importano i dati sulla v3.2 (Render)
4. Spegnere GitHub Pages e spostare i file legacy in `_legacy/`
5. Aggiornare il README (rimuovere sezione legacy)

---

## Sviluppo locale

```bash
cd training-analyzer/server
npm run dev
```

Il server serve sia l'API (`/api/*`) che i file statici del client (`/`). Non serve un server separato per il frontend. Hot reload con nodemon; per il client basta ricaricare il browser.
