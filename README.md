# Training Analyzer

Web app full-stack per tracciare allenamenti multi-sport, analizzare progressi e confrontarsi con amici.

**Versione:** 3.2.1
**Live:** https://training-analyzer-oiu2.onrender.com

---

## Struttura del progetto

```
.
├── training-analyzer/               App full-stack (v3.2)
│   ├── client/                      Frontend (Vanilla JS, ES modules)
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
├── index.html                       Legacy frontend (v3.1, client-only + Firebase)
├── css/style.css
├── js/app.js
├── fonts/
├── manifest.json
├── logo_ta.png
└── logica_valutazione_forma_fisica.md
```

> I file nella root (`index.html`, `js/app.js`, `css/style.css`) sono la versione legacy 3.1 (client-only con Firebase). La versione attiva e in sviluppo e dentro `training-analyzer/`.

---

## Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | Vanilla JS (ES modules), Chart.js 4.4.1, no framework, no build step |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16 |
| ORM | Sequelize 6 |
| Auth | Passport.js (Google OAuth2 + Local), JWT (access 15min + refresh 7gg) |
| Security | helmet, cors, express-rate-limit, bcryptjs |
| Container | Docker, docker-compose |
| Hosting | Render (Web Service + PostgreSQL) |

---

## Deploy attuale (Render)

L'app e in produzione su Render:

- **Web Service:** `training-analyzer` (Node runtime, root dir `training-analyzer`)
- **Database:** PostgreSQL managed su Render (Frankfurt)
- **Build command:** `cd server && npm install`
- **Start command:** `cd server && node src/index.js`
- **Auto-deploy:** su ogni push a `main`

Le tabelle vengono create automaticamente all'avvio del server (`sequelize.sync()`).

Google OAuth e opzionale: il server parte anche senza le credenziali Google (login email/password sempre disponibile).

---

## Quick Start (locale)

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
| `DATABASE_URL` | Si | Connection string PostgreSQL |
| `JWT_SECRET` | Si | Segreto per access token (64 char random) |
| `JWT_REFRESH_SECRET` | Si | Segreto per refresh token (64 char random) |
| `NODE_ENV` | No | `production` o `development` (default) |
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
| GET | `/api/workouts?type=&from=&to=&limit=&offset=` | Lista con filtri (default limit 50, max 200) |
| GET | `/api/workouts/:id` | Dettaglio singolo |
| POST | `/api/workouts` | Crea nuovo (`{ type, date, data }`) |
| PUT | `/api/workouts/:id` | Aggiorna |
| DELETE | `/api/workouts` | Elimina tutti i workout dell'utente |
| DELETE | `/api/workouts/:id` | Elimina singolo |
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
- **Import multi-formato:** GPX, CSV, Apple Health XML, FIT, JSON backup
- **Export/Import backup** JSON completo con cancellazione dati esistenti
- **PubMed integration** per articoli scientifici correlati all'allenamento
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

## Migrazione da Firebase (v3.1 → v3.2)

Due metodi disponibili:

### Metodo 1: Export/Import JSON (consigliato)

1. Vai sul sito vecchio (GitHub Pages) → Impostazioni → Export JSON
2. Vai sul sito nuovo (Render) → Import → Import JSON → carica il file

### Metodo 2: Script server-side

```bash
cd training-analyzer/server
npm install firebase-admin --save-dev
# Scarica firebase-service-account.json da Firebase Console
npm run migrate:firebase -- --dry-run
npm run migrate:firebase
```

---

## Sviluppo locale

```bash
cd training-analyzer/server
npm run dev
```

Il server serve sia l'API (`/api/*`) che i file statici del client (`/`). Non serve un server separato per il frontend. Hot reload con nodemon; per il client basta ricaricare il browser.
