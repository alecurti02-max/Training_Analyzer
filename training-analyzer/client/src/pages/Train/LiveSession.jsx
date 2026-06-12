// Live Session — real-time workout recording, Preact port of the legacy live*
// functions (ui.js ~929-1630). Screen machine (start|active|finish), timestamp
// timer, rest overlay, draft persistence (liveSession_<uid>) with offline-gap
// resume. Intervals live in useEffect with cleanup (the #1 migration hazard:
// navigating away mid-session must not leak/double-count timers).

import { useState, useEffect, useRef } from 'preact/hooks';
import { SPORT_TEMPLATES, FIELD_DEFS } from '../../../js/sports.js';
import { todayStr, uid } from '@/lib/utils.js';
import { toast } from '@/lib/toast.js';
import { calcTonnage, scoreWorkout, getAdvice } from '@/scoring';
import { trainData, trainBridge, activeSportsFrom, lastPerformance, pendingLivePlan, consumePendingLivePlan } from '@/store/train.js';
import { initialSets, makeEmptySet } from './logic/setModel.js';
import { buildGymWorkout, buildSportWorkout, attachScores, countSkippedSets } from './logic/buildWorkout.js';
import {
  getElapsed, formatTime, togglePause, startSession, adjustResumedDraft,
  REST_PRESETS, clampRestDefault, clampRestPreset, restDashoffset, restClock,
} from './logic/liveTimer.js';
import { ExerciseCard } from './components/GymSetEditor.jsx';
import { ExerciseSheet } from './components/ExerciseSheet.jsx';
import { SportFields } from './components/SportFields.jsx';

function draftKey(uidStr) { return 'liveSession_' + (uidStr || 'anon'); }

export function LiveSession({ userId }) {
  const data = trainData.value;
  const lp = pendingLivePlan.value;
  const [screen, setScreen] = useState('start');     // start | active | finish
  const [session, setSession] = useState(null);
  const [selType, setSelType] = useState('');
  const [date, setDate] = useState(todayStr());
  const [now, setNow] = useState(Date.now());        // ticks the timer display
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState({});
  const [finishRpe, setFinishRpe] = useState('');
  const [finishNotes, setFinishNotes] = useState('');
  const [resume, setResume] = useState(null);

  // rest timer
  const [restTotal, setRestTotal] = useState(clampRestDefault(localStorage.getItem('ta_live_rest_default')));
  const [restRemaining, setRestRemaining] = useState(0);
  const [restOpen, setRestOpen] = useState(false);
  const restored = useRef(false);

  // ---- main timer: one interval, lives only while active & not paused ----
  useEffect(() => {
    if (screen !== 'active' || !session || session.paused) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [screen, session?.paused, !!session]);

  // ---- rest timer: one interval while the overlay is open ----
  useEffect(() => {
    if (!restOpen) return undefined;
    const id = setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 1) {
          setRestOpen(false);
          try { navigator.vibrate?.(200); } catch (_) { /* ignore */ }
          toast('Riposo terminato!');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [restOpen]);

  // ---- draft persistence ----
  function persist(s) {
    if (!s) return;
    const withTs = { ...s, _lastSavedAt: Date.now() };
    try { localStorage.setItem(draftKey(userId), JSON.stringify(withTs)); } catch (_) { /* ignore */ }
  }
  function clearDraft() { try { localStorage.removeItem(draftKey(userId)); } catch (_) { /* ignore */ } }
  function updateSession(next) { setSession(next); persist(next); }

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey(userId));
      if (raw) setResume(JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }, [userId]);

  // Auto-start della sessione LIVE da un piano programmato (Dashboard → "INIZIA ORA").
  // Pre-popola gli esercizi/serie (editabili qui); i set ripartono con done:false.
  useEffect(() => {
    if (!lp) return;
    const plan = consumePendingLivePlan();
    if (!plan) return;
    setResume(null);
    const t = plan.type || 'gym';
    const s = startSession(t, todayStr(), Date.now());
    s.exercises = (plan.exercises || []).map((e) => ({
      name: e.name,
      muscle: e.muscle,
      secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles.slice() : [],
      weightMode: e.weightMode || 'total',
      barbellWeight: e.barbellWeight || null,
      isUnilateral: !!e.isUnilateral,
      param: e.param || 'reps',
      sets: (Array.isArray(e.sets) && e.sets.length ? e.sets : [makeEmptySet(e, { live: true })]).map((st) => ({ ...st, done: false })),
    }));
    // CRM F2: se il piano viene da una scheda assegnata (launchDay/pin del coach),
    // trasporta il riferimento {assignmentId, dayKey, week} fino al salvataggio.
    s._assignment = plan._assignment || null;
    setSelType(t); setSession(s); persist(s); setScreen('active'); setNow(Date.now());
    // Piano gym senza esercizi: apri subito il picker (come lo start manuale).
    if (t === 'gym' && !s.exercises.length) setTimeout(() => setSheetOpen(true), 300);
  }, [lp]);

  // ---- start ----
  function start() {
    if (!selType) { toast('Seleziona un tipo!', 'error'); return; }
    const s = startSession(selType, date, Date.now());
    setSession(s); persist(s); setScreen('active'); setNow(Date.now());
    if (selType === 'gym') setTimeout(() => setSheetOpen(true), 300);
  }

  // ---- pause/resume ----
  function pauseResume() {
    if (!session) return;
    const next = togglePause(session, Date.now());
    updateSession(next);
    setNow(Date.now());
  }

  // ---- exercise + set management (gym) ----
  function addExercise(name, muscle) {
    setSheetOpen(false);
    if (!session) return;
    const libEntry = (data.exercises || []).find((e) => e.name === name) || {};
    const ex = {
      name, muscle,
      secondaryMuscles: Array.isArray(libEntry.secondaryMuscles) ? libEntry.secondaryMuscles.slice() : [],
      weightMode: libEntry.weightMode || 'total',
      barbellWeight: libEntry.barbellWeight || null,
      isUnilateral: !!libEntry.isUnilateral,
      param: libEntry.param || 'reps',
      lastPerf: lastPerformance(data.workouts, name),
    };
    ex.sets = initialSets(ex, ex.lastPerf, { live: true });
    updateSession({ ...session, exercises: [...session.exercises, ex] });
  }
  function updateExercise(idx, next, opts = {}) {
    const exercises = session.exercises.map((e, i) => (i === idx ? next : e));
    updateSession({ ...session, exercises });
    if (opts.startRest) startRest();
  }
  function removeExercise(idx) {
    updateSession({ ...session, exercises: session.exercises.filter((_, i) => i !== idx) });
  }

  // ---- rest controls ----
  function startRest() { setRestRemaining(restTotal); setRestOpen(true); }
  function restPreset(sec) {
    const v = clampRestPreset(sec);
    setRestTotal(v);
    try { localStorage.setItem('ta_live_rest_default', String(v)); } catch (_) { /* ignore */ }
    setRestRemaining(v); setRestOpen(true);
  }
  function restAdjust(delta) {
    setRestRemaining((r) => {
      const nr = Math.max(0, r + delta);
      setRestTotal((t) => Math.max(t, nr));
      return nr;
    });
  }

  // ---- finish + save ----
  const elapsed = getElapsed(session, now);
  function goFinish() { setFinishRpe(''); setFinishNotes(''); setScreen('finish'); }
  async function save() {
    if (!session) return;
    const durationMin = Math.round(elapsed / 60);
    const rpe = parseInt(finishRpe, 10) || null;
    let workout;
    if (session.type === 'gym') {
      workout = buildGymWorkout(session.exercises, { id: uid(), date: session.date, duration: durationMin, rpe, notes: finishNotes }, { onlyDone: true });
      if (!workout.exercises.length) { toast('Nessuna serie completata!', 'error'); return; }
    } else {
      const fields = {};
      Object.entries(session.sportFields || {}).forEach(([k, v]) => { fields[k] = v; });
      workout = buildSportWorkout(session.type, fields, { id: uid(), date: session.date, notes: finishNotes }, FIELD_DEFS, { extra: { duration: durationMin, rpe } });
    }
    attachScores(workout, { workoutsCache: data.workouts, settings: data.settings, calcTonnage, scoreWorkout, getAdvice });
    // CRM F2: la chiave extra finisce in workout.data._assignment (looseObject);
    // il server la valida e la "solleva" nelle colonne assignment* (anti-forgery).
    if (session._assignment) workout._assignment = session._assignment;
    try {
      const saved = await trainBridge.saveWorkout(workout);
      if (saved && saved.id) workout.id = saved.id;
    } catch (e) { toast('Errore nel salvataggio', 'error'); return; }
    const label = session.type === 'gym' ? 'Palestra' : (SPORT_TEMPLATES[session.type]?.name || session.type);
    clearDraft();
    setSession(null); setScreen('start'); setSelType('');
    trainBridge.onSaved?.(workout, `${label} salvato! Score: ${workout.scores.overall}`);
  }
  function cancel() {
    if (!confirm("Annullare l'allenamento? I dati non salvati saranno persi.")) return;
    clearDraft(); setSession(null); setScreen('start'); setSelType(''); setRestOpen(false);
    toast('Allenamento annullato');
  }

  const sports = activeSportsFrom(data.settings);

  // ---- resume modal ----
  if (resume) {
    return (
      <div class="card">
        <div class="card-title">Sessione in corso trovata</div>
        <p style="color:var(--text2);font-size:.9rem">{SPORT_TEMPLATES[resume.type]?.name || resume.type} · {(resume.exercises || []).length} esercizi</p>
        <button class="btn btn-primary" style="width:100%;margin-top:8px"
          onClick={() => { const adj = adjustResumedDraft(resume, Date.now()); setSession(adj); setScreen('active'); setNow(Date.now()); setResume(null); }}>Riprendi</button>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px"
          onClick={() => { clearDraft(); setResume(null); }}>Scarta</button>
      </div>
    );
  }

  return (
    <>
      {/* Start screen */}
      {screen === 'start' && (
        <div class="live-screen active">
          <div class="card">
            <div class="card-title">Allenamento Live</div>
            <div class="form-group"><label>Data</label>
              <input type="date" class="date-picker-big" value={date} onInput={(e) => setDate(e.target.value)} /></div>
            <div class="type-cards-grid">
              {sports.map((key) => {
                const s = SPORT_TEMPLATES[key];
                if (!s) return null;
                return (
                  <div key={key} class={`type-card${selType === key ? ' selected' : ''}`} onClick={() => setSelType(key)}>
                    <div class="type-icon">{s.icon}</div><div class="type-name">{s.name}</div>
                  </div>
                );
              })}
            </div>
            <button class="btn btn-primary" style="width:100%;margin-top:12px" disabled={!selType} onClick={start}>Inizia Allenamento</button>
          </div>
        </div>
      )}

      {/* Active session */}
      {screen === 'active' && session && (
        <div class="live-screen active">
          <div class="live-active-header">
            <div class={`live-timer${session.paused ? ' paused' : ''}`}>{formatTime(elapsed)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" onClick={pauseResume}>{session.paused ? 'Riprendi' : 'Pausa'}</button>
              <button class="btn btn-secondary btn-sm" onClick={cancel}>Annulla</button>
              <button class="btn btn-danger btn-sm" onClick={goFinish}>Termina</button>
            </div>
          </div>

          {session.type === 'gym' ? (
            <div>
              {!session.exercises.length && (
                <div class="card" style="text-align:center;color:var(--text2);padding:32px">
                  <p>Nessun esercizio aggiunto.</p>
                  <button class="btn btn-primary" style="margin-top:8px" onClick={() => setSheetOpen(true)}>+ Aggiungi esercizio</button>
                </div>
              )}
              {session.exercises.map((ex, idx) => (
                <ExerciseCard
                  key={idx} ex={ex} exIdx={idx} live
                  optsOpen={!!optsOpen[idx]}
                  onToggleOpts={() => setOptsOpen((p) => ({ ...p, [idx]: !p[idx] }))}
                  onChange={(next) => {
                    // Detect a set transitioning to done → start rest (mirrors liveCompleteSet).
                    const before = ex.sets.filter((s) => s.done).length;
                    const after = (next.sets || []).filter((s) => s.done).length;
                    updateExercise(idx, next, { startRest: after > before });
                  }}
                  onRemove={() => removeExercise(idx)}
                />
              ))}
            </div>
          ) : (
            <div class="card">
              <div class="card-title">{SPORT_TEMPLATES[session.type]?.icon} {SPORT_TEMPLATES[session.type]?.name}</div>
              <SportFields
                type={session.type} values={session.sportFields || {}} skipDuration
                onChange={(k, v) => updateSession({ ...session, sportFields: { ...session.sportFields, [k]: v } })}
              />
            </div>
          )}

          {session.type === 'gym' && <button class="live-fab" onClick={() => setSheetOpen(true)}>+</button>}
        </div>
      )}

      {/* Finish screen */}
      {screen === 'finish' && session && (
        <div class="live-screen active">
          <div class="card">
            <div class="card-title">Riepilogo Sessione</div>
            <div>
              <div class="live-summary-row"><span class="live-summary-label">Sport</span><span class="live-summary-value">{SPORT_TEMPLATES[session.type]?.icon} {SPORT_TEMPLATES[session.type]?.name || session.type}</span></div>
              <div class="live-summary-row"><span class="live-summary-label">Data</span><span class="live-summary-value">{session.date}</span></div>
              <div class="live-summary-row"><span class="live-summary-label">Durata</span><span class="live-summary-value">{formatTime(elapsed)}</span></div>
              {session.type === 'gym' && (
                <div class="live-summary-row"><span class="live-summary-label">Esercizi</span><span class="live-summary-value">{session.exercises.length}</span></div>
              )}
            </div>
            {session.type === 'gym' && countSkippedSets(session.exercises) > 0 && (
              <div class="advice-box" style="margin-top:8px">
                {countSkippedSets(session.exercises)} serie compilate ma non segnate "Fatto" non verranno salvate.
                Torna alla sessione per completarle.
              </div>
            )}
            <div class="form-row">
              <div class="form-group"><label>Durata (min)</label><input type="number" readonly value={Math.round(elapsed / 60)} /></div>
              <div class="form-group"><label>RPE (1-10)</label><input type="number" min="1" max="10" placeholder="7" value={finishRpe} onInput={(e) => setFinishRpe(e.target.value)} /></div>
            </div>
            <div class="form-group"><label>Note (opzionale)</label>
              <textarea placeholder="Come ti sei sentito, sensazioni..." style="min-height:80px;font-size:1rem" value={finishNotes} onInput={(e) => setFinishNotes(e.target.value)} /></div>
            <button class="btn btn-primary save-workout-big" onClick={save}>Salva Allenamento</button>
            <button class="btn btn-secondary" style="width:100%;margin-top:8px" onClick={() => setScreen('active')}>Torna alla Sessione</button>
          </div>
        </div>
      )}

      {/* Rest overlay — markup mirrors the legacy #live-rest-overlay in index.html */}
      {restOpen && (
        <div class="live-rest-overlay">
          <div class="live-rest-card">
            <div class="live-rest-circle-container">
              <svg viewBox="0 0 120 120" width="120" height="120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" stroke-width="8" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent)" stroke-width="8"
                  stroke-dasharray="339.292" stroke-dashoffset={restDashoffset(restRemaining, restTotal)}
                  stroke-linecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <div class="live-rest-time">{restClock(restRemaining)}</div>
            </div>
            <div style="display:flex;gap:6px;justify-content:center;margin-top:12px;flex-wrap:wrap">
              {REST_PRESETS.map((p) => (
                <button key={p} class={`bm-tab${p === restTotal ? ' active' : ''}`} onClick={() => restPreset(p)}>
                  {p < 60 ? `${p}s` : `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')}`}
                </button>
              ))}
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
              <button class="btn btn-secondary btn-sm" onClick={() => restAdjust(-15)}>-15s</button>
              <button class="btn btn-secondary btn-sm" onClick={() => restAdjust(15)}>+15s</button>
            </div>
            <button class="btn btn-sm" style="width:100%;margin-top:8px;background:var(--bg3);color:var(--text2)" onClick={() => setRestOpen(false)}>Salta</button>
          </div>
        </div>
      )}

      <ExerciseSheet open={sheetOpen} exercises={data.exercises} onPick={addExercise} onClose={() => setSheetOpen(false)} />
    </>
  );
}
