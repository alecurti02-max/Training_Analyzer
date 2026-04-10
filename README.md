# Training Analyzer

Web app per tracciare allenamenti multi-sport, analizzare progressi e confrontarsi con amici. Pensata per essere hostata su GitHub Pages con Firebase come backend.

**Live:** https://alecurti02-max.github.io/Training_Analyzer/

---

## Architettura

```
index.html      → Struttura HTML (login, nav, pagine, modali)
css/style.css   → Stili (tema rosso, auto light/dark, responsive mobile-first)
js/app.js       → Logica applicativa (Firebase, wizard, grafici, import/export)
```

Non c'è build step, bundler o framework. Tutto gira client-side. Le dipendenze esterne sono caricate via CDN:

- **Firebase 10.12** (Auth, Realtime Database) — compat SDK
- **Chart.js 4.4.1** — grafici (line, bar, doughnut, radar)
- **Google Fonts** — Inter

### Backend: Firebase

Non esiste un server. Firebase Realtime Database è il BaaS. La config è hardcodata in `js/app.js` (prime righe).

**Progetto Firebase:** `training-analyzer-deb1f`
**Database:** `https://training-analyzer-deb1f-default-rtdb.europe-west1.firebasedatabase.app`

#### Struttura dati

```
/users/{uid}/
  profile/          → displayName, email, photoURL, createdAt
  workouts/{id}/    → oggetto allenamento completo (tipo, data, score, esercizi/dati sport)
  exercises/        → array libreria esercizi personalizzata
  settings/         → FC max, FC riposo, peso, altezza, VO2max, età, sesso, sport attivi, gruppi muscolari
  weights/{id}/     → log peso corporeo {date, value}
  weightTarget      → numero (kg obiettivo)
  heightCm          → numero
  publicStats/      → metriche aggregate visibili agli amici autenticati
  following/{uid}/  → lista utenti seguiti {displayName, photoURL, uid, followedAt}

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

## Funzionalità principali

### Sport personalizzabili

Il sistema supporta 20+ sport definiti in `SPORT_TEMPLATES` (app.js). Ogni sport ha:

- `name`, `icon` — per UI
- `fixed: true` — palestra e corsa non rimovibili
- `fields` — array di chiavi che mappano a `FIELD_DEFS` (label, tipo input, placeholder)
- `hasExercises: true` — solo palestra, attiva il wizard esercizi/serie

L'utente attiva/disattiva sport da Impostazioni → I Miei Sport. La scelta viene salvata in `settings.activeSports`.

Per aggiungere un nuovo sport: inserire una entry in `SPORT_TEMPLATES` e definire eventuali nuovi campi in `FIELD_DEFS`. Il wizard si adatta automaticamente.

### Scoring

Ogni allenamento riceve uno score 0-10 calcolato diversamente per tipo:

- **Palestra:** volume (25%), intensità/RPE (25%), progressione carichi (25%), varietà muscoli (15%), durata (10%)
- **Corsa:** distanza vs media (25%), pace vs media (30%), efficienza FC (25%), sforzo/RPE (20%)
- **Karting:** costanza tra giri (35%), miglioramento best lap (40%), sforzo (25%)
- **Altri sport:** RPE (60%), durata (40%)

Funzioni: `scoreGymWorkout()`, `scoreRunWorkout()`, `scoreKartWorkout()`, `scoreGenericWorkout()`.

Il 1RM è stimato con la formula di Epley: `peso × (1 + reps/30)`.

### Valutazione forma fisica

Nel profilo, `getFitnessAssessment()` calcola un punteggio percentuale basato su:

| Componente | Peso max | Fonte |
|---|---|---|
| VO2 Max | 30 | Impostazioni |
| FC Riposo | 20 | Impostazioni |
| BMI | 15 | Peso + Altezza |
| Consistenza | 20 | Giorni allenamento ultimi 30gg |
| Performance | 15 | Score medio allenamenti |

Giudizio: Eccellente (85%+), Buono (70%+), Nella media (50%+), Da migliorare (30%+), Insufficiente.

### Sistema amici

- `/publicUsers/{uid}` viene scritto al login con nome e foto Google
- La ricerca in "Amici" filtra `publicUsersCache` per nome (client-side)
- Seguire qualcuno scrive in `following/{uid}` dell'utente corrente
- Il confronto legge `publicStats` di ogni amico selezionato e genera barre comparative

### Recovery status

`getRecoveryStatus()` stima il recupero per ogni gruppo muscolare basandosi su:

- Giorni trascorsi dall'ultimo allenamento di quel muscolo
- Intensità (RPE) della sessione
- Soglie: RPE ≥ 8 → 3 giorni, RPE ≥ 6 → 2 giorni, altrimenti 1.5

### Import

| Formato | Tipo risultante | Parser |
|---|---|---|
| GPX | running | `parseGPX()` — estrae trackpoints, calcola distanza (haversine), pace, FC, dislivello |
| CSV | gym | `handleCSVFile()` — formato: `data,esercizio,serie,reps,peso_kg,rpe` |
| Apple Health XML | running/gym | `handleAppleHealthFile()` — streaming a chunk da 1MB, regex su tag `<Workout>` |
| FIT | gym | `parseFITMinimal()` — scansione binaria per timestamp FIT epoch |
| JSON | tutti | `importJSONBackup()` — restore completo da backup |

### PubMed

Dopo il salvataggio di un allenamento palestra o corsa, `fetchPubMedForWorkout()` costruisce una query basata su muscoli/tipo e interroga le eutils API (esearch → esummary → efetch per abstract). I risultati sono cachati in `sessionStorage`.

---

## Tema e design

Il design segue lo stile GoPro: tipografia bold (Inter 700-900), uppercase, colore tema rosso `#E02020`.

Il tema si adatta automaticamente al sistema operativo tramite `prefers-color-scheme`. Le variabili CSS sono duplicate in `:root` (light), `@media (prefers-color-scheme: dark)` e negli attributi `[data-theme="dark"]` / `[data-theme="light"]` per eventuale override manuale.

I grafici Chart.js leggono il tema corrente tramite `getChartTheme()` per adattare colori di griglia e testo.

L'heatmap è renderizzata su Canvas (`renderHeatmap()`), non con Chart.js.

---

## Deploy

Il sito è hostato su GitHub Pages dal branch `main` della repo `alecurti02-max/Training_Analyzer`.

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

Aprire `http://localhost:8000`. Il login Google funziona su localhost (è tra i domini autorizzati Firebase di default).
