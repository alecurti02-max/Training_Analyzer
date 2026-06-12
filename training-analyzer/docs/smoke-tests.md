# Smoke tests — checklist manuale

Da rieseguire dopo ogni fase del refactor prima di merge/deploy in produzione.

Ambiente:
- Frontend: aperto in browser dopo `cd client && npm run dev` (post-Fase 1) o aprendo `index.html` con static server (pre-Fase 1).
- Backend: `cd server && npm run dev` con DB locale o connesso a Neon staging.
- Account test: signup nuovo o login con account di test (registrare in `.env.local`).

Convenzione: ☐ = da eseguire, ☑ = passato, ✗ = fallito (annota issue).

## 1. Auth

- ☐ Signup nuovo utente (email + password) → login automatico + redirect dashboard.
- ☐ Logout → torna a schermata login.
- ☐ Login esistente (email + password) → dashboard popolata.
- ☐ Login Google OAuth → callback OK, utente creato/loggato.
- ☐ Refresh token: lascia tab aperta >15min, l'access token scade, una API chiama refresh automaticamente, nessun logout forzato.
- ☐ Delete account → conferma, utente sparisce dal DB, viene fatto logout.

## 2. Dashboard

- ☐ Carica con workout recenti visibili (latest workout card).
- ☐ Streak banner mostra n giorni consecutivi corretto.
- ☐ Bento cards mostrano metriche (allenamenti settimana, score medio, km, tonnellaggio).
- ☐ Sport tabs filtrano correttamente (gym, running, karting, all).
- ☐ Heatmap mensile mostra activity.
- ☐ Click su latest workout → apre dettaglio.

## 3. Wizard log workout (retrospettivo)

- ☐ Pulsante "Allenamento" → wizard step 1 (scelta sport).
- ☐ Step 1 → 2: scelta tipo → form campi sport-specific (gym: esercizi, running: distanza/pace, karting: lap times).
- ☐ Aggiungi esercizio gym: sheet con lista, ricerca, custom.
- ☐ Aggiungi set: reps, weight, RPE, drop set.
- ☐ Rimuovi set, rimuovi esercizio.
- ☐ Cambia weight mode (total / per_side / barbell_only).
- ☐ Toggle unilaterale → weightLeft/weightRight inputs.
- ☐ Salva workout → appare in storico, dashboard si aggiorna.
- ☐ Riprendi draft: ricarica pagina con wizard a metà → "draft trovato" → riprendi.
- ☐ Scarta draft → reset wizard.

## 4. Live session

- ☐ Avvia live session da pulsante dedicato → timer parte.
- ☐ Aggiungi esercizio durante live.
- ☐ Aggiungi set durante live (auto-save in `localStorage.liveSession_<uid>`).
- ☐ Rest timer: parte dopo set, preset 30/60/90/120/180, +30/-30 inline.
- ☐ Pausa/riprendi live timer.
- ☐ Chiudi live → salva come workout, sparisce draft localStorage.
- ☐ Crash test: ricarica browser durante live → resume prompt → recupera draft.

## 5. Storico

- ☐ Lista workout ordinata data DESC.
- ☐ Filtri per tipo (gym/running/karting/altri) + per gruppo muscolare.
- ☐ Click su workout → dettaglio: esercizi, set, score, AI analysis (se Premium).
- ☐ Pulsante AI analysis → call backend → JSON ricevuto + UI aggiornata.
- ☐ Edit workout: modifica data, esercizi, set → salva → storico aggiornato.
- ☐ Delete workout → conferma → sparisce.
- ☐ Bulk delete (select mode) → seleziona N → elimina tutti.

## 6. Progressi (charts)

- ☐ Tab "Generale": 1RM, peso settimanale, radar muscoli.
- ☐ Tab "Atletico": pace running, HR zones, distanza cumulata.
- ☐ Cambia periodo (settimana, mese, anno).
- ☐ Click su barre/punti → tooltip.

## 7. Corpo

- ☐ Tab Peso: log peso, target, height. Grafico mostra trend.
- ☐ BMI banner calcolato correttamente.
- ☐ Tab Misure: aggiungi misura body fat / muscolo / circonferenze.
- ☐ Tab Avatar: visualizza body avatar con percentuali per body part.
- ☐ Edit misura esistente, delete misura.

## 8. Recupero

- ☐ Aggiungi sleep log (data, ore, qualità).
- ☐ Aggiungi nutrition log (calorie, proteine, carb, grassi).
- ☐ Grafico recovery score.
- ☐ Edit/delete log.

## 9. Profile

- ☐ Visualizza dati utente (nome, email, plan, UID).
- ☐ Fitness assessment: score + categoria + raccomandazioni.
- ☐ AI Coach summary (Premium): call backend → JSON ricevuto + render.
- ☐ Cambia avatar foto.
- ☐ Export PDF profilo → download file PDF apribile.
- ☐ Copy UID button.

## 10. Friends

- ☐ Search user by name/UID → risultati.
- ☐ Follow user → appare in following list.
- ☐ Unfollow → sparisce.
- ☐ Compare workouts con friend (checkboxes + grafico).
- ☐ Profile friend pubblico visibile.

## 11. Setup

- ☐ Tab Library: lista esercizi default + custom. Aggiungi custom, edit, delete.
- ☐ Tab Sports: attiva/disattiva sport (gym, running, karting, altri).
- ☐ Tab Muscles: gestisci gruppi muscolari custom.
- ☐ Tab Settings: form profilo (età, sesso, altezza, peso, VO2max, HR max/rest).
  Salva → server aggiornato → settingsCache aggiornata.
- ☐ Tab Import: GPX, CSV, Apple Health, FIT, JSON backup → parsing OK, workout creati.

## 12. Admin (solo utenti admin)

- ☐ Tab visibile solo se role=admin.
- ☐ Lista utenti paginata.
- ☐ Grafici signup giornaliero/settimanale.
- ☐ Promote user a Premium, demote.

## 13. PWA

- ☐ Install banner su mobile (iOS Safari, Android Chrome).
- ☐ Offline mode: dashboard mostra cache, sync banner "Offline".
- ☐ Riconnesso → sync resume, banner "Sync OK".

## 14. Performance / regressione

- ☐ Lighthouse score: Performance ≥ baseline pre-refactor.
- ☐ Tempo di caricamento iniziale: ≤ baseline + 200ms.
- ☐ Nessun warning/error console critico (non-Chart.js).
- ☐ Network: nessuna 5xx, nessuna 4xx non attesa.

## 15. Backend

- ☐ `npm run test:smoke` (post-Fase 3): 0 fail.
- ☐ `GET /api/workouts` < 500ms.
- ☐ `POST /api/profile/health` (AI coach): risposta ≤ 30s, JSON valido.
- ☐ Health endpoint `/health` o `/` risponde 200.

## 16. Coach / Clienti (CRM PT, F1–F4)

Servono 2 account: un trainer (via `TRAINER_EMAILS` o registrato da `/register-pt`)
e un cliente.

- ☐ Nav "Clienti" visibile SOLO al trainer; `/clienti` da non-trainer → empty-state.
- ☐ Invito per email → il cliente lo vede in Profilo→Coach → Accetta → roster attivo.
- ☐ Revoca invito / Termina rapporto (da entrambi i lati) → letture coach chiuse.
- ☐ Schede: crea scheda A/B con progressione (es. sett. 2 al 105%), assegna al cliente.
- ☐ Cliente: Profilo→Coach mostra "La tua scheda · Settimana X di Y"; "Avvia" giorno →
  live precompilata coi carichi aggiustati; salva → il coach vede l'aderenza aggiornata.
- ☐ Pin giornata su data → appare nella NextUp del cliente, INIZIA ORA la lancia.
- ☐ Note/anagrafica: salvataggio e timeline; IL CLIENTE NON LE VEDE MAI.
- ☐ Pacchetti: crea, +1 seduta (auto-completed quando pieno), alert roster se
  scadenza ≤14gg o ≤2 sedute residue.
- ☐ Sharing: peso/nutrizione/sonno visibili al coach SOLO dopo il toggle del cliente;
  revoca immediata.
- ☐ `/register-pt` → form registrazione PT → account con area Clienti attiva.
