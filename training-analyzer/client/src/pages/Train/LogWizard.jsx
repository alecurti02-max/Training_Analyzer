// Log Wizard — 4-step manual workout entry, Preact port of the legacy
// initLogWizard/wiz* functions (ui.js ~272-927). Step machine + draft persistence
// (wizDraft_<uid>) + save via the injected bridge. Markup/classes match the
// legacy #log-step-* cards so css/style.css applies unchanged.

import { useState, useEffect, useRef } from 'preact/hooks';
import { SPORT_TEMPLATES, FIELD_DEFS, getDefaultMusclesForSport } from '../../../js/sports.js';
import { todayStr, uid } from '@/lib/utils.js';
import { toast } from '@/lib/toast.js';
import { calcTonnage, scoreWorkout, getAdvice } from '@/scoring';
import { trainData, trainBridge, activeSportsFrom, lastPerformance, pendingPlan, consumePendingPlan } from '@/store/train.js';
import { initialSets } from './logic/setModel.js';
import { buildGymWorkout, buildSportWorkout, attachScores } from './logic/buildWorkout.js';
import { ExerciseCard } from './components/GymSetEditor.jsx';
import { ExerciseSheet } from './components/ExerciseSheet.jsx';
import { SportFields } from './components/SportFields.jsx';

function draftKey(uidStr) { return 'wizDraft_' + (uidStr || 'anon'); }

export function LogWizard({ userId }) {
  const data = trainData.value;
  const pp = pendingPlan.value;
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [exercises, setExercises] = useState([]);   // gym
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [gymDuration, setGymDuration] = useState('');
  const [gymRpe, setGymRpe] = useState('');
  const [sportFields, setSportFields] = useState({}); // non-gym
  const [muscles, setMuscles] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState({});       // exIdx → bool
  const [resume, setResume] = useState(null);         // pending draft (resume modal)
  const restored = useRef(false);

  // ---- draft persistence (debounced via effect) ----
  useEffect(() => {
    // On mount: offer to resume an existing draft.
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey(userId));
      if (raw) setResume(JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }, [userId]);

  // Pre-fill da allenamento PROGRAMMATO (Dashboard → "INIZIA ORA"). Ha precedenza
  // sul draft: imposta tipo + muscoli + note e salta allo step 2.
  useEffect(() => {
    if (!pp) return;
    const plan = consumePendingPlan();
    if (!plan) return;
    setResume(null);
    setType(plan.type || 'gym');
    setMuscles(Array.isArray(plan.muscleGroups) ? plan.muscleGroups : []);
    setExercises([]);
    setSportFields({});
    setNotes(plan.note || '');
    setStep(2);
  }, [pp]);

  useEffect(() => {
    if (resume) return; // don't overwrite while resume modal is pending
    if (!type && !exercises.length) return;
    const draft = {
      wizStep: step, wizType: type, wizExercises: exercises,
      formFields: { date, notes, gymDuration, gymRpe, sportFields, pickedMuscles: muscles },
      _lastSavedAt: Date.now(),
    };
    try { localStorage.setItem(draftKey(userId), JSON.stringify(draft)); } catch (_) { /* ignore */ }
  }, [step, type, exercises, date, notes, gymDuration, gymRpe, sportFields, muscles, resume, userId]);

  function clearDraft() {
    try { localStorage.removeItem(draftKey(userId)); } catch (_) { /* ignore */ }
  }
  function reset() {
    setStep(1); setType(''); setExercises([]); setDate(todayStr());
    setNotes(''); setGymDuration(''); setGymRpe(''); setSportFields({}); setMuscles([]);
  }
  function applyDraft(d) {
    setType(d.wizType || '');
    setExercises(Array.isArray(d.wizExercises) ? d.wizExercises : []);
    setStep(d.wizStep || 1);
    const ff = d.formFields || {};
    setDate(ff.date || todayStr());
    setNotes(ff.notes || '');
    setGymDuration(ff.gymDuration || '');
    setGymRpe(ff.gymRpe || '');
    setSportFields(ff.sportFields || {});
    setMuscles(Array.isArray(ff.pickedMuscles) ? ff.pickedMuscles : []);
  }

  // ---- step nav (mirrors wizGoBack branching) ----
  function goStep(n) {
    if (n === 2 && !type) { toast('Seleziona un tipo!', 'error'); return; }
    setStep(n);
  }
  function goBack() {
    if (step <= 1) return;
    if (step === 3 && type === 'gym') setStep(2);
    else if (step === 4 && type === 'gym') setStep(3);
    else if (step === 4) setStep(2);
    else setStep(step - 1);
  }
  function selectType(t) {
    setType(t);
    if (t !== 'gym') setMuscles(getDefaultMusclesForSport(t));
    setTimeout(() => setStep(2), 200);
  }

  // ---- gym exercise management ----
  function addExercise(name, muscle) {
    setSheetOpen(false);
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
    ex.sets = initialSets(ex, ex.lastPerf);
    setExercises((prev) => [...prev, ex]);
  }
  const updateExercise = (idx, next) => setExercises((prev) => prev.map((e, i) => (i === idx ? next : e)));
  const removeExercise = (idx) => setExercises((prev) => prev.filter((_, i) => i !== idx));
  function copyLast(idx) {
    setExercises((prev) => prev.map((e, i) => {
      if (i !== idx || !e.lastPerf) return e;
      return { ...e, sets: initialSets(e, e.lastPerf) };
    }));
    toast('Serie copiate!');
  }

  // ---- save ----
  async function save() {
    let workout;
    if (type === 'gym') {
      workout = buildGymWorkout(exercises, {
        id: uid(), date,
        duration: parseInt(gymDuration, 10) || null,
        rpe: parseInt(gymRpe, 10) || null,
        notes,
      });
      if (!workout.exercises.length) { toast('Aggiungi almeno un esercizio!', 'error'); return; }
    } else {
      const fields = {};
      (SPORT_TEMPLATES[type]?.fields || []).forEach((k) => { if (sportFields[k] != null) fields[k] = sportFields[k]; });
      workout = buildSportWorkout(type, fields, { id: uid(), date, notes }, FIELD_DEFS, { muscles });
    }
    attachScores(workout, { workoutsCache: data.workouts, settings: data.settings, calcTonnage, scoreWorkout, getAdvice });
    try {
      const saved = await trainBridge.saveWorkout(workout);
      if (saved && saved.id) workout.id = saved.id;
    } catch (e) {
      toast('Errore nel salvataggio', 'error');
      return;
    }
    const label = type === 'gym' ? 'Palestra' : (SPORT_TEMPLATES[type]?.name || type);
    clearDraft();
    reset();
    trainBridge.onSaved?.(workout, `${label} salvato! Score: ${workout.scores.overall}`);
  }

  const sports = activeSportsFrom(data.settings);

  // ---- resume modal ----
  if (resume) {
    const exCount = (resume.wizExercises || []).length;
    const sportLabel = resume.wizType ? (SPORT_TEMPLATES[resume.wizType]?.name || resume.wizType) : 'sport non scelto';
    const when = resume._lastSavedAt ? new Date(resume._lastSavedAt).toLocaleString() : '';
    return (
      <div class="card">
        <div class="card-title">Bozza trovata</div>
        <p style="color:var(--text2);font-size:.9rem">{sportLabel} · {exCount} esercizi · {when}</p>
        <button class="btn btn-primary" style="width:100%;margin-top:8px"
          onClick={() => { applyDraft(resume); setResume(null); toast('Bozza ripristinata'); }}>Riprendi</button>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px"
          onClick={() => { clearDraft(); setResume(null); reset(); }}>Scarta</button>
      </div>
    );
  }

  return (
    <div class="log-wizard">
      <div class="step-indicator">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} class={`step-dot${n === step ? ' active' : ''}${n < step ? ' done' : ''}`} />
        ))}
      </div>

      {/* Step 1 — when + what */}
      {step === 1 && (
        <div class="log-step active">
          <div class="card">
            <div class="card-title">Quando e cosa?</div>
            <div class="form-group"><label>Data</label>
              <input type="date" class="date-picker-big" value={date} onInput={(e) => setDate(e.target.value)} />
            </div>
            <div class="type-cards-grid">
              {sports.map((key) => {
                const s = SPORT_TEMPLATES[key];
                if (!s) return null;
                return (
                  <div key={key} class={`type-card${type === key ? ' selected' : ''}`} onClick={() => selectType(key)}>
                    <div class="type-icon">{s.icon}</div>
                    <div class="type-name">{s.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — gym: exercises / non-gym: sport fields */}
      {step === 2 && (
        <div class="log-step active">
          {type === 'gym' ? (
            <div class="card">
              <div class="card-title">Esercizi</div>
              <button class="exercise-add-btn" onClick={() => setSheetOpen(true)}>+ Aggiungi Esercizio</button>
              <div>
                {exercises.map((ex, idx) => (
                  <div class="exercise-card" key={idx}>
                    <div class="exercise-card-header">
                      <span class="exercise-card-name">{ex.name}</span>
                      <button class="btn-icon" onClick={() => removeExercise(idx)}>×</button>
                    </div>
                    <div class="exercise-card-muscle">{ex.muscle}</div>
                    {ex.lastPerf && <div class="exercise-card-last">Ultima volta: {ex.lastPerf.sets.length}x{ex.lastPerf.sets[0]?.reps || '?'} @ {ex.lastPerf.sets[0]?.weight || '?'}kg</div>}
                  </div>
                ))}
              </div>
              <button class="btn btn-primary" style="width:100%;margin-top:8px" onClick={() => goStep(3)}>Continua →</button>
            </div>
          ) : (
            <div class="card">
              <div class="card-title">{SPORT_TEMPLATES[type]?.icon} Dati {SPORT_TEMPLATES[type]?.name}</div>
              <SportFields
                type={type} values={sportFields}
                onChange={(k, v) => setSportFields((prev) => ({ ...prev, [k]: v }))}
                showMuscles muscles={muscles}
                onToggleMuscle={(m) => setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))}
              />
              <button class="btn btn-primary" style="width:100%;margin-top:8px" onClick={() => goStep(4)}>Continua →</button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — gym sets */}
      {step === 3 && type === 'gym' && (
        <div class="log-step active">
          <div class="card">
            <div class="card-title">Serie & Carichi</div>
            <div>
              {exercises.map((ex, idx) => (
                <ExerciseCard
                  key={idx} ex={ex} exIdx={idx} live={false}
                  optsOpen={!!optsOpen[idx]}
                  onToggleOpts={() => setOptsOpen((p) => ({ ...p, [idx]: !p[idx] }))}
                  onChange={(next) => updateExercise(idx, next)}
                  onRemove={() => removeExercise(idx)}
                  onCopyLast={() => copyLast(idx)}
                />
              ))}
            </div>
            <button class="btn btn-primary" style="width:100%;margin-top:12px" onClick={() => goStep(4)}>Continua →</button>
          </div>
        </div>
      )}

      {/* Step 4 — notes + save */}
      {step === 4 && (
        <div class="log-step active">
          <div class="card">
            <div class="card-title">Note & Salvataggio</div>
            {type === 'gym' && (
              <div class="form-row">
                <div class="form-group"><label>Durata (min)</label>
                  <input type="number" placeholder="60" value={gymDuration} onInput={(e) => setGymDuration(e.target.value)} /></div>
                <div class="form-group"><label>RPE (1-10)</label>
                  <input type="number" min="1" max="10" placeholder="7" value={gymRpe} onInput={(e) => setGymRpe(e.target.value)} /></div>
              </div>
            )}
            <div class="form-group"><label>Note (opzionale)</label>
              <textarea placeholder="Come ti sei sentito, meteo, sensazioni..." style="min-height:80px;font-size:1rem"
                value={notes} onInput={(e) => setNotes(e.target.value)} /></div>
            <button class="btn btn-primary save-workout-big" onClick={save}>Salva Allenamento</button>
          </div>
        </div>
      )}

      {step > 1 && (
        <div style="text-align:center;margin-top:8px">
          <button class="btn btn-secondary" onClick={goBack}>← Indietro</button>
        </div>
      )}

      <ExerciseSheet open={sheetOpen} exercises={data.exercises} onPick={addExercise} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
