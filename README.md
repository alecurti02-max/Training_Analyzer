# Training Analyzer

Web app per tracciare allenamenti multi-sport, analizzare progressi e confrontarsi con amici. Pensata per essere hostata su GitHub Pages con Firebase come backend.

**Live:** https://alecurti02-max.github.io/Training_Analyzer/
**Versione:** 3.1

---

## Architettura

```
index.html        → Struttura HTML (login, nav, pagine, modali)
css/style.css     → Stili (tema rosso, dark/light, responsive mobile-first)
js/app.js         → Logica applicativa (Firebase, wizard, grafici, import/export)
fonts/            → Font locali (BasementGrotesque, Poppins)
manifest.json     → PWA manifest (standalone, icona adattiva)
logo_ta.png       → Logo/icona app (1024x1024)
```

Non c'e build step, bundler o framework. Tutto gira client-side. Le dipendenze esterne sono caricate via CDN:

- **Firebase 10.12** (Auth, Realtime Database) — compat SDK
- **Chart.js 4.4.1** — grafici (line, bar, doughnut, radar)
- **Google Fonts** — caricamento Poppins come fallback

### Font personalizzati

- **BasementGrotesque Black** (`fonts/BasementGrotesque-Black_v1.202.otf`) — titoli e heading (`.font-heading`, weight 900)
- **Poppins** (`fonts/Poppins/`, weights 300-900) — testo corpo e UI

### Backend: Firebase

Non esiste un server. Firebase Realtime Database e il BaaS. La config e hardcodata in `js/app.js` (prime righe).

**Progetto Firebase:** `training-analyzer-deb1f`
**Database:** `https://training-analyzer-deb1f-default-rtdb.europe-west1.firebasedatabase.app`

#### Struttura dati

```
/users/{uid}/
  profile/          → displayName, email, photoURL, createdAt
  workouts/{id}/    → oggetto allenamento completo (tipo, data, score, esercizi/dati sport)
  exercises/        → array libreria esercizi personalizzata
  settings/         → FC max, FC riposo, peso, altezza, VO2max, eta, sesso, sport attivi,
                      gruppi muscolari, flexibility (1-10), weekgoal, kmgoal
  weights/{id}/     → log peso corporeo {date, value}
  weightTarget      → numero (kg obiettivo)
  heightCm          → numero
  publicStats/      → metriche aggregate visibili agli amici autenticati
  following/{uid}/  → lista utenti seguiti {displayName, photoURL, uid, followedAt}
  notifications/{id}/ → {type, fromName, fromPhoto, fromUid, message, read, timestamp}

/publicUsers/{uid}/ → displayName, photoURL, uid (per ricerca amici)
```

#### Firebase Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth!=null && auth.uid==$uid",
        ".write": "auth!=null && auth.uid==$uid",
        "publicStats": { ".read": "auth!=null" }
      }
    },
    "publicUsers": {
      ".read": "auth!=null",
      "$uid": { ".write": "auth!=null && auth.uid==$uid" }
    }
  }
}
```

Ogni utente legge/scrive solo i propri dati. `publicStats` e `publicUsers` sono leggibili da chiunque autenticato.

#### Domini autorizzati (Firebase Auth)

In Firebase Console → Authentication → Settings → Authorized domains, devono essere presenti:

- `localhost`
- `alecurti02-max.github.io`

---

## Autenticazione

Login esclusivamente con Google (`signInWithPopup` su desktop, `signInWithRedirect` su mobile). Il fallback redirect evita il problema "missing initial state" che si verifica su browser mobile con storage partizionato.

All'avvio viene chiamato `getRedirectResult()` per gestire il ritorno dal redirect su mobile.

Non esiste schermata di setup o registrazione: l'utente clicca "Accedi con Google" e viene creato automaticamente il profilo su Firebase.

---

## Pagine dell'app

| Pagina | ID | Descrizione |
|---|---|---|
| Dashboard | `page-dashboard` | Panoramica: heatmap, score recenti, streak, grafici trend |
| Log | `page-log` | Wizard multi-step per registrare un allenamento |
| Storico | `page-history` | Lista allenamenti passati con filtri e dettaglio |
| Profilo atletico | `page-athletic` | Radar 6 metriche, card dettaglio per dimensione atletica |
| Profilo | `page-profile` | Valutazione forma fisica, dati personali, statistiche |
| Amici | `page-friends` | Ricerca utenti, follow, confronto statistiche |
| Impostazioni | `page-settings` | Dati biometrici, sport attivi, import/export, info |

---

## Funzionalita principali

### Sport personalizzabili

Il sistema supporta 20+ sport definiti in `SPORT_TEMPLATES` (app.js). Ogni sport ha:

- `name`, `icon` — per UI
- `fixed: true` — palestra e corsa non rimovibili
- `fields` — array di chiavi che mappano a `FIELD_DEFS` (label, tipo input, placeholder)
- `hasExercises: true` — solo palestra, attiva il wizard esercizi/serie

L'utente attiva/disattiva sport da Impostazioni → I Miei Sport. La scelta viene salvata in `settings.activeSports`.

Per aggiungere un nuovo sport: inserire una entry in `SPORT_TEMPLATES` e definire eventuali nuovi campi in `FIELD_DEFS`. Il wizard si adatta automaticamente.

### Wizard di registrazione allenamento

Il log usa un wizard a 4 step con indicatore visuale (`.step-dot`):

1. Selezione sport
2. Dati specifici dello sport (campi da `FIELD_DEFS`)
3. Per palestra: selezione esercizi tramite bottom sheet mobile-first + serie/reps/peso
4. Riepilogo e salvataggio

**Bottom sheet esercizi:** su mobile, la selezione esercizi avviene tramite un pannello che scorre dal basso (`.bottom-sheet`) con ricerca in tempo reale. Funzioni: `openExerciseSheet()`, `closeExerciseSheet()`, `filterExerciseSheet()`.

### Scoring

Ogni allenamento riceve uno score 0-10 calcolato diversamente per tipo:

- **Palestra:** volume (25%), intensita/RPE (25%), progressione carichi (25%), varieta muscoli (15%), durata (10%)
- **Corsa:** distanza vs media (25%), pace vs media (30%), efficienza FC (25%), sforzo/RPE (20%)
- **Karting:** costanza tra giri (35%), miglioramento best lap (40%), sforzo (25%)
- **Altri sport:** RPE (60%), durata (40%)

Funzioni: `scoreGymWorkout()`, `scoreRunWorkout()`, `scoreKartWorkout()`, `scoreGenericWorkout()`.

Il 1RM e stimato con la formula di Epley: `peso * (1 + reps/30)`.

Ogni score ha label dettagliate per componente (volume, intensity, variety, progression, duration, distance, pace, hrEfficiency, effort, consistency, improvement) e un advice box con consigli specifici generati da `getAdvice()`.

### Profilo atletico

Pagina dedicata (`page-athletic`) con analisi delle capacita atletiche su 6 dimensioni, calcolate sugli ultimi 30 giorni (`renderAthleticDetail()`):

| Metrica | Calcolo |
|---|---|
| Forza | Volume medio allenamenti palestra |
| Resistenza | Km totali corsi in 30 giorni |
| Consistenza | Giorni unici di allenamento / 30 |
| Recupero | Basato su numero sessioni ad alto RPE |
| Progressione | Score medio progressione carichi palestra |
| Varieta | Gruppi muscolari + sport diversi praticati |

Visualizzazione: **radar chart** a 6 assi + **6 card** con punteggio, barra colorata e descrizione testuale per ogni dimensione.

### Valutazione forma fisica

Nel profilo, `getFitnessAssessment()` calcola un punteggio percentuale basato su 7 componenti:

| Componente | Peso | Fonte |
|---|---|---|
| Forza | 25% | 1RM stimato, volume, progressione carichi |
| Cardio | 25% | VO2 Max, trend pace, efficienza FC |
| Endurance | 20% | Giorni allenamento, trend durata, km totali |
| Composizione corporea | 15% | BMI, trend peso, gruppi muscolari allenati |
| Flessibilita | 10% | Autovalutazione utente (1-10) da Impostazioni |
| Atleticita | 5% | Varieta sport praticati |

Ogni componente e visualizzato con barra colorata (verde 70%+, giallo 40%+, rosso sotto) e sub-label con il dettaglio del calcolo.

Giudizio complessivo: Eccellente (85%+), Buono (70%+), Nella media (50%+), Da migliorare (30%+), Insufficiente.

### Streak

Il sistema calcola e mostra in dashboard:

- **Streak corrente:** giorni consecutivi di allenamento
- **Record storico:** massimo streak raggiunto

Logica: verifica che le date consecutive differiscano di esattamente 1 giorno.

### Sistema amici

- `/publicUsers/{uid}` viene scritto al login con nome e foto Google
- La ricerca in "Amici" filtra `publicUsersCache` per nome (client-side) + ricerca via `publicStats`
- Seguire qualcuno scrive in `following/{uid}` dell'utente corrente
- Il confronto legge `publicStats` di ogni amico selezionato e genera barre comparative
- E possibile aggiungere amici anche tramite UID diretto

### Notifiche

Sistema di notifiche in-app per eventi sociali:

- **Follow notification:** quando qualcuno ti segue, viene generata una notifica
- **Struttura Firebase:** `/users/{uid}/notifications/{id}` con campi: type, fromName, fromPhoto, fromUid, message, read, timestamp
- **Funzioni:** `sendFollowNotification()`, `renderNotifications()`, `markNotifRead()`
- **UI:** badge conteggio non lette, lista con stato letto/non letto, formattazione "time ago" (ora, X min, X h, X gg)

### Recovery status

`getRecoveryStatus()` stima il recupero per ogni gruppo muscolare basandosi su:

- Giorni trascorsi dall'ultimo allenamento di quel muscolo
- Intensita (RPE) della sessione
- Soglie: RPE >= 8 → 3 giorni, RPE >= 6 → 2 giorni, altrimenti 1.5

Calcola anche un livello di **fatica generale** aggregato e suggerisce **giorni di riposo** nell'advice box della dashboard.

### PubMed

Dopo il salvataggio di un allenamento palestra o corsa, `fetchPubMedForWorkout()` costruisce una query basata su muscoli/tipo e interroga le eutils API (esearch → esummary → efetch per abstract). I risultati sono cachati in `sessionStorage` (chiave `ta_pubmed_cache`).

Gli articoli vengono mostrati nel dettaglio allenamento (`.research-box`) con titolo, autori, data, abstract e link diretto a PubMed.

### Import

| Formato | Tipo risultante | Parser |
|---|---|---|
| GPX | running | `parseGPX()` — estrae trackpoints, calcola distanza (haversine), pace, FC, dislivello |
| CSV | gym | `handleCSVFile()` — formato: `data,esercizio,serie,reps,peso_kg,rpe` |
| Apple Health XML | running/gym | `handleAppleHealthFile()` — streaming a chunk da 1MB, regex su tag `<Workout>` |
| FIT | gym | `parseFITMinimal()` — scansione binaria per timestamp FIT epoch |
| JSON | tutti | `importJSONBackup()` — restore completo da backup |

---

## Tema e design

Il design segue uno stile bold e sportivo: tipografia pesante (BasementGrotesque 900 per heading, Poppins per corpo), uppercase sui titoli, colore tema rosso `#E02020`.

### Sistema tema a 3 livelli

1. **Default:** variabili CSS in `:root` (light)
2. **Sistema operativo:** `@media (prefers-color-scheme: dark)` si adatta automaticamente
3. **Override manuale:** attributi `[data-theme="dark"]` / `[data-theme="light"]` per forzare il tema

I grafici Chart.js leggono il tema corrente tramite `getChartTheme()` per adattare colori di griglia e testo.

L'heatmap e renderizzata su Canvas (`renderHeatmap()`), non con Chart.js.

### Grafici implementati

- **Line chart:** score nel tempo, trend metriche
- **Bar chart:** volume, frequenza settimanale
- **Radar chart:** profilo atletico (6 dimensioni)
- **Doughnut:** distribuzione gruppi muscolari (ultime 4 settimane)
- **Canvas heatmap:** calendario attivita

---

## PWA

L'app e installabile come PWA grazie a `manifest.json`:

- `display: "standalone"` — si apre senza barra browser
- `background_color: "#0A0A0C"` — splash screen scuro
- `theme_color: "#E02020"` — rosso tema
- Icona adattiva (`purpose: "any maskable"`)

---

## Impostazioni utente

Oltre ai dati biometrici base (FC max, FC riposo, peso, altezza, VO2max, eta, sesso), le impostazioni includono:

- **Flessibilita / Mobilita** (`flexibility`): autovalutazione 1-10, usata nel fitness assessment (10% del punteggio). Non calcolabile automaticamente.
- **Obiettivo settimanale** (`weekgoal`): numero di allenamenti target a settimana
- **Obiettivo km** (`kmgoal`): km di corsa target a settimana
- **Sport attivi** (`activeSports`): lista sport abilitati nel wizard
- **Gruppi muscolari personalizzati:** aggiunte utente ai gruppi di default

---

## Deploy

Il sito e hostato su GitHub Pages dal branch `main` della repo `alecurti02-max/Training_Analyzer`.

Per aggiornare:

```bash
git add -A
git commit -m "descrizione"
git push origin main
```

GitHub Pages rebuilda automaticamente in 1-2 minuti. I dati utente non vengono toccati (vivono su Firebase).

---

## Sviluppo locale

Basta un server HTTP statico:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Aprire `http://localhost:8000`. Il login Google funziona su localhost (e tra i domini autorizzati Firebase di default).
