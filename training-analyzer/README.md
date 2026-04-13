# Training Analyzer

Web app full-stack per tracciare allenamenti multi-sport, analizzare progressi e confrontarsi con amici.

**Versione:** 3.2 (architettura full-stack)

---

## Architettura

```
training-analyzer/
├── client/                      Frontend (Vanilla JS, ES modules, no build step)
│   ├── index.html               Struttura HTML (login tabs, nav, 10 pagine, modali)
│   ├── css/style.css            Stili (tema rosso, dark/light, responsive)
│   ├── manifest.json            PWA manifest
│   ├── logo_ta.png              Logo/icona app
│   ├── fonts/                   BasementGrotesque + Poppins
│   └── js/
│       ├── ui.js                Orchestratore: stato, render, wizard, PubMed
│       ├── api.js               Layer HTTP centralizzato + JWT auto-refresh
│       ├── auth.js              Login Google OAuth + email/password
│       ├── sports.js            SPORT_TEMPLATES, FIELD_DEFS, costanti
│       ├── scoring.js           Score workout, recovery, streak, fitness assessment
│       ├── charts.js            Chart.js, heatmap canvas, tutti i grafici
│       ├── import.js            GPX, CSV, Apple Health, FIT, JSON backup
│       └── friends.js           Ricerca utenti, follow, confronto stats
├── server/                      Backend (Node.js + Express)
│   ├── src/
│   │   ├── index.js             Entry point (listen + DB connect)
│   │   ├── app.js               Express: helmet, cors, rate-limit, routes
│   │   ├── config/
│   │   │   ├── database.js      Sequelize + PostgreSQL
│   │   │   ├── passport.js      Google OAuth2 + Local strategy
│   │   │   └── env.js           Validazione variabili d'ambiente
│   │   ├── models/              User, Workout, Exercise, Settings, Weight, Follow
│   │   ├── routes/              auth, workouts, exercises, settings, weights, users
│   │   ├── controllers/         Logica business (un file per route)
│   │   ├── middleware/          authenticate (JWT), authorize, errorHandler
│   │   └── utils/jwt.js         Generazione/verifica JWT
│   ├── migrations/              6 migration Sequelize
│   ├── seeders/                 Demo user + 3 workout campione
│   ├── scripts/
│   │   └── migrateFromFirebase.js  Migrazione dati da Firebase
│   ├── Dockerfile               Node 20 alpine multi-stage
│   └── package.json
├── docker-compose.yml           PostgreSQL 16 + server
├── .env.example                 Template variabili d'ambiente
└── .gitignore
```

### Stack

| Layer | Tecnologia |
|---|---|
| Frontend | Vanilla JS (ES modules), Chart.js 4.4.1, no framework, no build step |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16 |
| ORM | Sequelize 6 |
| Auth | Passport.js (Google OAuth2 + Local), JWT (access 15min + refresh 7gg) |
| Security | helmet, cors, express-rate-limit, bcryptjs |
| Container | Docker, docker-compose |

---

## Quick Start

### Con Docker (consigliato)

```bash
cp .env.example .env
# Modifica .env con le tue credenziali Google OAuth

docker-compose up --build
# Server su http://localhost:3000
# PostgreSQL su localhost:5432

# In un altro terminale, esegui le migrazioni:
docker-compose exec server npx sequelize-cli db:migrate
docker-compose exec server npx sequelize-cli db:seed:all
```

### Senza Docker

```bash
# 1. Avvia PostgreSQL (locale o remoto)
# 2. Crea database:
createdb training_analyzer

# 3. Configura ambiente:
cp .env.example .env
# Modifica DATABASE_URL, JWT secrets, Google OAuth credentials

# 4. Installa e avvia:
cd server
npm install
npm run migrate
npm run seed
npm run dev

# Server su http://localhost:3000
# Il client viene servito automaticamente da Express
```

### Demo user (dopo seed)

- **Email:** `demo@training-analyzer.app`
- **Password:** `Demo123!`

---

## Variabili d'ambiente

| Variabile | Descrizione | Esempio |
|---|---|---|
| `NODE_ENV` | Ambiente | `development` |
| `PORT` | Porta server | `3000` |
| `DATABASE_URL` | Connection string PostgreSQL | `postgres://user:pass@localhost:5432/training_analyzer` |
| `JWT_SECRET` | Segreto per access token | (stringa random 64 char) |
| `JWT_REFRESH_SECRET` | Segreto per refresh token | (stringa random 64 char) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Da Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Callback URL OAuth | `http://localhost:3000/api/auth/google/callback` |
| `CLIENT_ORIGIN` | Origin per CORS | `http://localhost:3000` |

---

## API Endpoints

### Autenticazione

| Metodo | Endpoint | Descrizione |
|---|---|---|
| POST | `/api/auth/register` | Registrazione email/password |
| POST | `/api/auth/login` | Login email/password |
| POST | `/api/auth/logout` | Logout (invalida refresh token) |
| POST | `/api/auth/refresh` | Rinnova access + refresh token |
| GET | `/api/auth/google` | Avvia Google OAuth |
| GET | `/api/auth/google/callback` | Callback Google OAuth |

### Workout (autenticazione richiesta)

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/workouts?type=&from=&to=&limit=&offset=` | Lista con filtri |
| GET | `/api/workouts/:id` | Dettaglio singolo |
| POST | `/api/workouts` | Crea nuovo |
| PUT | `/api/workouts/:id` | Aggiorna |
| DELETE | `/api/workouts/:id` | Elimina |
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

---

## Schema Database

```
users           1:N  workouts    (userId FK)
users           1:N  exercises   (userId FK)
users           1:1  settings    (userId PK/FK)
users           1:N  weights     (userId FK)
users (follower) N:M users (following) via follows (PK composta)

Workout.data    JSONB — contiene tutto il dettaglio (esercizi, serie, scores, advice)
Settings        JSONB — activeSports, activeGroups
```

---

## Scoring

Il calcolo dello score resta **client-side** (`client/js/scoring.js`). Il server riceve e salva lo score calcolato dal client.

- **Palestra:** volume 25% + intensita 25% + progressione 25% + varieta 15% + durata 10%
- **Corsa:** distanza 25% + pace 30% + efficienza FC 25% + sforzo 20%
- **Karting:** costanza 35% + miglioramento 40% + sforzo 25%
- **Altri sport:** RPE 60% + durata 40%

---

## Migrazione da Firebase

Per migrare i dati esistenti dal Firebase Realtime Database:

1. Scarica il service account JSON da Firebase Console > Project Settings > Service Accounts
2. Salva come `firebase-service-account.json` nella cartella `server/`
3. Aggiungi `firebase-admin` come dipendenza:
   ```bash
   cd server && npm install firebase-admin --save-dev
   ```
4. Esegui:
   ```bash
   # Dry run (mostra cosa verrebbe migrato)
   npm run migrate:firebase -- --dry-run

   # Migrazione effettiva
   npm run migrate:firebase
   ```

Lo script migra: utenti, workout (JSONB), esercizi, settings, pesi, relazioni follow. E sicuro rieseguirlo (usa `findOrCreate`).

---

## Deploy

### Fly.io

```bash
fly launch --name training-analyzer
fly postgres create --name ta-db
fly postgres attach ta-db
fly secrets set JWT_SECRET=... JWT_REFRESH_SECRET=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
fly deploy
```

### Railway / Render

Collega il repo GitHub. Imposta le variabili d'ambiente. Il Dockerfile viene rilevato automaticamente.

---

## Sviluppo locale

```bash
cd server && npm run dev
```

Il server serve sia l'API (`/api/*`) che i file statici del client (`/`). Non serve un server separato per il frontend.

Hot reload del server con nodemon. Per il client, basta ricaricare il browser.
