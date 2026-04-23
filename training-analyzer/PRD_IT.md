# Training Analyzer — Product Requirements Document

**Versione**: 0.1 (stato attuale: MVP in produzione)
**Data**: 2026-04-23
**Autore**: Alessandro Curti
**Stato**: Living document — aggiornare ad ogni release rilevante
**Audience**: founder (uso interno), sviluppatore esterno, investor pitch (sezioni §2, §3, §6, §7)

---

## 1. Executive Summary

Training Analyzer è una web app di analisi degli allenamenti per atleti amatoriali endurance e multi-sport. Aggrega dati da Apple Health, file GPX e input manuali in un'unica dashboard, calcola uno **score sport-specifico** e mostra trend di carico, recupero, peso e composizione corporea.

Oggi è in produzione (Render + Neon PostgreSQL 18, Frankfurt), multi-utente, con auth Google + email, **21 sport supportati**, body measurements tracking e admin dashboard. È un MVP solido, usato quotidianamente dall'autore. Il salto a prodotto richiede onboarding semplificato, un coach automatico e un funnel di acquisizione.

---

## 2. Vision & Mission

**Vision**: diventare il primo *coach digitale privacy-first* per amatori endurance che non si pagano un personal trainer ma vogliono allenarsi in modo strutturato.

**Mission**: aggregare i dati che hai già (Apple Health, Garmin, Strava, palestra manuale) e trasformarli in feedback azionabile — non solo grafici — restituendoti il controllo dei tuoi dati.

---

## 3. Problem Statement

Chi fa sport amatoriale endurance e/o multi-sport oggi affronta tre problemi mal serviti:

1. **Frammentazione dei dati** — Garmin sta in Garmin Connect, palestra in un'app separata, peso e misure in Apple Health, allenamenti casuali da nessuna parte. Nessuna view unica.
2. **Coaching personalizzato inaccessibile** — TrainingPeaks richiede un coach pagante (~150€/mese), Strava è social senza prescrizione, Garmin Coach è generico. Domande come *"sono in over-reaching questa settimana?"* restano senza risposta automatica.
3. **Monetizzazione sui tuoi dati** — Strava ha avuto controversie sui dati di utenti; Garmin lega tutto al proprio hardware. I dati biometrici (HRV, sonno, peso) sono asset di terze parti.

---

## 4. Solution

Web app (mobile-friendly) che:

- **Importa** Apple Health (XML completo), GPX (qualsiasi sportwatch), CSV palestra, input manuale, FIT base.
- **Unifica** tutto in un modello dati comune (Workout) con score sport-specifico computato automaticamente.
- **Visualizza** trend di carico, recupero, score, peso, composizione corporea con Chart.js.
- **Suggerisce** (roadmap v2) cosa fare oggi: riposo, easy run, intensità, tapering.
- **Possiede** i dati: singolo DB, export totale in JSON, opzione self-host (roadmap).

---

## 5. Target Users (Personas)

### Persona Primaria — *L'Amatore Strutturato*
- 22-45 anni, multi-sport (corsa + palestra + altro)
- Apple Watch / Garmin / Polar
- 4-6 sessioni/settimana, obiettivi chiari (peso, performance) ma niente coach
- Vuole capire se sta facendo troppo, troppo poco, se sta migliorando
- Smanettone-friendly ma non tollera UX da app B2B

### Persona Secondaria — *Il Curioso dei Dati*
- Più device, vuole una vista unificata "tutta la mia vita in una dashboard"
- Apprezza ownership ed export totale

### Persona Terziaria — *L'Atleta in Transizione*
- Ex-atleta strutturato senza più coach
- Vuole continuità e accountability automatica

---

## 6. Market & Competition

**TAM**: utenti Strava ~125M attivi; Garmin Connect ~50M+; TrainingPeaks ~500K paganti. Mercato endurance sports tracking ~$2B SAM.

| Competitor | Modello | Forza | Debolezza |
|---|---|---|---|
| **Strava** | Freemium ~€80/anno | Community, segments | Zero coaching, social-first |
| **TrainingPeaks** | ~€20/mese + coach | Planning serio | Complesso, richiede coach umano |
| **Garmin Connect** | Free + hardware | Integrazione device | Vendor lock-in |
| **Whoop** | ~€25/mese hardware+app | Recovery focus | Solo recovery, niente strength |
| **Coros / Form** | Hardware + app | UX moderna | Lock-in |

**Gap di mercato**: amatori italiani/europei che vogliono coaching automatizzato + data ownership + multi-sport, senza vendor lock-in. **Non esiste un player dominante in Italia.**

---

## 7. Differentiation — Three Wedges

### Wedge 1 — AI Coach for Amateurs
Coaching automatizzato (regole + ML) che osserva carico, HRV, peso e score e suggerisce *cosa fare oggi*. Non sostituisce un coach umano ma copre il 90% dei bisogni dell'amatore non-élite. **TAM addressable**: ~10M utenti EU che oggi non si pagano un coach.

### Wedge 2 — Privacy & Data Ownership
Self-hostable (open core in roadmap), export totale gratuito, zero third-party analytics, zero monetizzazione dei dati. **Differenziazione narrativa forte** post-controversie Strava/Garmin e in clima GDPR maturo.

### Wedge 3 — Multi-source Aggregator
Un'unica dashboard per Apple Health + Garmin + Strava + manuale + palestra + body measurements + (futuro) nutrizione e sonno. **Cross-source analysis** (es. correlazione sonno-performance da fonti diverse) che nessun singolo provider può offrire.

---

## 8. Product Features — Stato Attuale (v1.0)

### Auth & Account
- Login Google OAuth2 + email/password
- JWT (access 15min + refresh 7gg, rotation)
- Profilo: firstName, lastName, displayName, photoURL, role (user/admin)
- Admin dashboard con stats globali e lista utenti

### Import
- **GPX**: corsa, ciclismo, hiking (distanza, dislivello, traccia, HR opzionale)
- **Apple Health**: XML export completo (testato su 823 workout, 9 anni)
- **CSV**: sessioni palestra
- **JSON**: backup/restore interno
- **FIT**: supporto base

### Sport Supportati (21 tipi)
gym, running, walking, cycling, swimming, hiking, karting, boxing, tennis, padel, football, basketball, crossfit, yoga, climbing, skiing, martial_arts, volleyball, skateboard, surf, dance.

### Metriche & Scoring
Calcolate client-side (`scoring.js`):
- **Score sport-specifico**: palestra (volume + intensità + progressione + variety + durata); corsa (distanza + pace + efficienza FC + sforzo); karting (costanza + miglioramento + sforzo); ecc.
- Recovery score, streak, RPE da HR o METs, fitness assessment
- Calorie tracking (ActiveEnergyBurned + BasalEnergyBurned da Apple Health)

### Visualizzazioni
- Heatmap calendario (canvas)
- Trend score / peso / volume (Chart.js)
- Tabelle workout filtrabili
- Mappa traccia GPX
- Grafici composizione corporea

### Body Measurements & Settings
- Peso storico
- 8 circonferenze (petto, vita, fianchi, spalle, bicipite, collo, coscia, polpaccio)
- 8 composizione (grasso %, muscolo scheletrico, acqua, massa muscolare/ossea, proteine, grasso viscerale/sottocutaneo)
- Profilo cardiaco (maxHR, restHR), VO2max, weight target, sport attivi, gruppi muscolari

### Social (base)
- Ricerca utenti
- Follow/unfollow
- Visualizzazione stats pubbliche

### Admin (v1.0)
- Stats globali (utenti, signup 7/30gg, workout totali/recenti)
- Lista utenti paginata
- Breakdown sport (doughnut chart) + signup line chart
- Bootstrap admin via env var `ADMIN_EMAIL`

---

## 9. Technical Architecture

### Stack
- **Frontend**: Vanilla JS (ES modules, no build step), Chart.js 4.4.1
- **Backend**: Node.js 20, Express 4, Sequelize 6 ORM
- **Database**: PostgreSQL 18 (Neon production, Frankfurt) + 16 supportato
- **Auth**: Passport.js (Google OAuth2 + Local), JWT
- **Container**: Docker + docker-compose
- **Hosting**: Render (web service) + Neon (PostgreSQL pooler)

### Modello Dati (7 entità)
| Entità | Note |
|---|---|
| **User** | uid UUID, role (user/admin), provider (google/local) |
| **Workout** | JSONB `data` per dettagli sport-specifici, indici (userId,date) e (userId,type) |
| **Exercise** | tracking pesi (weightMode total/per-side, barbellWeight, isUnilateral) |
| **Settings** | profilo cardiaco, antropometria, sport attivi, gruppi muscolari, weightTarget |
| **Weight** | storico peso, indice unico (userId,date) |
| **BodyMeasurement** | 16 misure (8 circonferenze + 8 composizione), indice unico (userId,date) |
| **Follow** | composite PK followerId+followingId |

### Sicurezza
- `helmet` + CORS allowlist + `express-rate-limit` (2000 req/15min)
- `bcryptjs` password hashing
- JWT con refresh rotation
- SSL obbligatorio su DB in produzione (`sslmode=require`)

### API
RESTful, 8 route groups (auth, workouts, exercises, settings, weights, body, users, admin), no versioning (`/api/...`).

### Deploy
- Render auto-deploy su push `main`
- Migrazioni Sequelize CLI (`npm run migrate`) eseguite manualmente con `NODE_ENV=production` per SSL Neon
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`, `CLIENT_ORIGIN`, `ADMIN_EMAIL`

---

## 10. Roadmap

### v1.x — Stabilizzazione (Q2 2026)
- **Onboarding wizard** — oggi un nuovo utente arriva e non sa da dove iniziare
- **Mobile UX polish** — touch targets, swipe gestures, performance su iOS
- **Fix RPE impreciso** — calcolare da METs Apple Health, non da HR stimata
- **Import full-fidelity** — recuperare METs, dislivello, traccia GPS, calorie basali, trend VO2max persi nell'attuale parser Apple Health
- **Documentazione utente in italiano** — oggi solo `README.md` tecnico

### v2.0 — AI Coach (Q3-Q4 2026)
- *"Suggested workout today"* basato su carico 7gg + HRV + peso + score recenti
- Detection over-reaching / under-recovery con notifiche
- Tapering automatico pre-gara (configurabile)
- Notifiche email/push (digest settimanale, milestone)

### v3.0 — Aggregator (2027)
- Integrazione **Garmin Connect** (OAuth API)
- Integrazione **Strava** (OAuth API, import segments)
- Integrazione **MyFitnessPal** / nutrizione
- Sleep tracking (Apple Health + Oura/Whoop)

### v4.0 — Community + Monetization (2027+)
- Piani allenamento condivisibili tra follower
- Sfide e segments
- **Premium tier** (€7-10/mese): AI coach avanzato, integrazioni, export PDF formato coach
- **Self-hosted edition** (open core)

---

## 11. Success Metrics

### Product KPIs
- **WAU / MAU**
- Workout import per utente per settimana (≥3 = healthy)
- Sport diversity per utente (1 = casual, 3+ = power user)
- **Retention 4-settimane** (target: 40% per power users)
- Time-to-first-import (target: <10 min da signup)

### Business KPIs (post-monetization)
- **Conversion free → premium** (target: 3-5%)
- ARR, MRR
- **CAC** (target: <€20 organico, <€60 paid)
- LTV / CAC ratio (target: >3)

### Technical KPIs
- Uptime (target: 99.5%)
- p95 API latency (target: <500ms)
- Error rate (<0.5%)

---

## 12. Business Model (Future)

**Freemium consumer**
- *Free*: import illimitato, score base, dashboard, body measurements, social base
- *Premium €7/mese o €60/anno*: AI coach, integrazioni Garmin/Strava/MyFitnessPal, export PDF coach-grade, supporto prioritario

**Self-hosted (open core)**
- Gratis per uso personale (Docker self-host)
- Licenza commerciale per coach professionisti che vogliono ospitare i propri atleti

**Principi**
- Zero vendita di dati
- Zero ad-targeting
- Pricing trasparente, no dark patterns

---

## 13. Risks & Open Questions

### Rischi
- **Adozione amatori** — sensibili a "yet another app". Onboarding ≤5min è critico.
- **Apple Health friction** — export XML manuale dall'iPhone; iOS Shortcut necessario per UX decente.
- **Garmin/Strava API** — rate limits e potenziali costi enterprise futuri.
- **GDPR / dati biometrici** — categoria speciale (Art. 9 GDPR), richiede DPA, privacy policy, valutazione DPIA se scaling.
- **Scoring proprietario** — formule attuali validate sull'autore; servono benchmark con sport scientist per credibilità coaching.

### Domande Aperte
- **Naming definitivo** — "training-analyzer" è working title
- **Open-source o closed-source?** — decisione strategica chiave per il wedge "Privacy & ownership"
- **Mobile**: PWA o app nativa? — costo dev vs reach
- **Lingua di lancio**: solo IT o IT+EN dal day 1?
- **Scoring scientifico**: ingaggiare consulente sport-science per validare formule prima del coaching automatico?

---

## 14. Appendix — Documenti Correlati

- [README tecnico](README.md)
- [Migrazione DB Render → Neon](MIGRATION_RENDER_TO_NEON.md)
- [Profilo dati Apple Health utente](APPLE_HEALTH_DATA_PROFILE.md)
- [PRD English version](PRD_EN.md)
