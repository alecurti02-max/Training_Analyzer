// ==================== UI MODULE (MAIN ORCHESTRATOR) ====================
// Entry point loaded by HTML: <script type="module" src="js/ui.js">
// Imports from all other 7 modules, owns global state, all rendering.

import { api, clearTokens } from './api.js';
import { initAuth, setupLoginUI, logout } from './auth.js';
import { SPORT_TEMPLATES, FIELD_DEFS, DEFAULT_MUSCLES, getUserActiveSports } from './sports.js';
import { scoreWorkout, getAdvice, getRecoveryStatus, calculateStreak, getFitnessAssessment } from './scoring.js';
import { destroyChart, storeChart, getChartTheme, renderHeatmap, renderRadarChart, renderWeeklyChart, renderProgress as renderProgressCharts, render1RMChart, updateORMChart, renderHRZones, renderWeightChart } from './charts.js';
import { handleGPXFiles, handleCSVFile, handleAppleHealthFile, handleFITFile, exportAllData, importJSONBackup } from './import.js';
import { searchUsers as searchUsersAPI, renderSearchResults, addFriendByUID, toggleFollow, renderFriendsPage as renderFriendsPageModule, renderFollowingList, renderCompareCheckboxes, compareSelected, timeAgo } from './friends.js';

// ==================== GLOBAL STATE ====================
let currentUser = null;
let workoutsCache = [], settingsCache = {}, exercisesCache = null, weightsCache = [];
let followingCache = {};
let activeSports = ['gym','running'];
let muscleGroups = [...DEFAULT_MUSCLES];
let isOnline = navigator.onLine;

// Wizard state
let wizStep = 1, wizType = '', wizExercises = [];

// Bottom sheet callback (dynamic, defaults to wizard)
let _sheetCallback = null;

// Live session state
let liveSession = null;
let liveTimerInterval = null;
let liveRestInterval = null;
let liveRestTotal = 90;
let liveRestRemaining = 0;
let liveSelectedType = '';

// History filter state
let historyFilter = 'all';

// ==================== HELPERS ====================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function toast(msg, type='') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.className = 'toast', 3000);
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function scoreColor(s) {
  if (s >= 8) return 'var(--green)'; if (s >= 6) return 'var(--yellow)';
  if (s >= 4) return 'var(--orange)'; return 'var(--red)';
}
function paceToSeconds(p) { if(!p)return 0; const parts=String(p).split(':'); return parts.length===2?parseInt(parts[0])*60+parseInt(parts[1]):parseFloat(p)*60; }
function secondsToPace(s) { if(!s||s<=0)return'--'; const m=Math.floor(s/60),sec=Math.round(s%60); return m+':'+String(sec).padStart(2,'0'); }
function formatDate(d) { return new Date(d).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}); }
function getWeekStart(d) { const dt=new Date(d),day=dt.getDay(),diff=dt.getDate()-day+(day===0?-6:1); return new Date(dt.setDate(diff)).toISOString().slice(0,10); }
function daysBetween(d1,d2) { return Math.abs(Math.floor((new Date(d1)-new Date(d2))/86400000)); }

// ==================== DEFAULT EXERCISES ====================
function getDefaultExercises() {
  return [
    {name:'Panca Piana',muscle:'Petto'},{name:'Panca Inclinata',muscle:'Petto'},{name:'Croci Cavi',muscle:'Petto'},{name:'Chest Press',muscle:'Petto'},
    {name:'Trazioni',muscle:'Schiena'},{name:'Lat Machine',muscle:'Schiena'},{name:'Rematore Bilanciere',muscle:'Schiena'},{name:'Pulley',muscle:'Schiena'},{name:'Rematore Manubrio',muscle:'Schiena'},
    {name:'Military Press',muscle:'Spalle'},{name:'Alzate Laterali',muscle:'Spalle'},{name:'Alzate Frontali',muscle:'Spalle'},{name:'Face Pull',muscle:'Spalle'},
    {name:'Curl Bilanciere',muscle:'Bicipiti'},{name:'Curl Manubri',muscle:'Bicipiti'},{name:'Curl Concentrato',muscle:'Bicipiti'},
    {name:'Pushdown Tricipiti',muscle:'Tricipiti'},{name:'French Press',muscle:'Tricipiti'},{name:'Dip',muscle:'Tricipiti'},
    {name:'Squat',muscle:'Quadricipiti'},{name:'Leg Press',muscle:'Quadricipiti'},{name:'Leg Extension',muscle:'Quadricipiti'},{name:'Affondi',muscle:'Quadricipiti'},
    {name:'Stacco Rumeno',muscle:'Femorali'},{name:'Leg Curl',muscle:'Femorali'},
    {name:'Hip Thrust',muscle:'Glutei'},{name:'Calf Raise',muscle:'Polpacci'},
    {name:'Crunch',muscle:'Addominali'},{name:'Plank',muscle:'Addominali'},
    {name:'Stacco da Terra',muscle:'Full Body'},{name:'Clean & Press',muscle:'Full Body'}
  ];
}

// ==================== ONLINE/OFFLINE ====================
window.addEventListener('online', () => { isOnline = true; updateSyncStatus(); });
window.addEventListener('offline', () => { isOnline = false; updateSyncStatus(); });

function updateSyncStatus() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (isOnline) { el.textContent = 'Sync OK'; el.className = 'sync-indicator sync-ok'; }
  else { el.textContent = 'Offline'; el.className = 'sync-indicator sync-offline'; }
}

// ==================== DATA LOADING ====================
async function loadAllData() {
  try {
    const [workoutsRes, settingsRes, exercisesRes, weightsRes, followingRes] = await Promise.all([
      api.get('/api/workouts?limit=5000').catch(() => []),
      api.get('/api/settings').catch(() => ({})),
      api.get('/api/exercises').catch(() => null),
      api.get('/api/weights').catch(() => []),
      api.get('/api/users/me/following').catch(() => ({}))
    ]);

    // Normalize workouts: server returns { workouts: [...] } with data in JSONB .data field
    const rawWorkouts = Array.isArray(workoutsRes) ? workoutsRes
      : (workoutsRes?.workouts ? workoutsRes.workouts
      : (workoutsRes ? Object.values(workoutsRes) : []));
    // Flatten: merge .data JSONB into top-level fields so the rest of the app works
    workoutsCache = rawWorkouts.map(w => {
      const data = w.data || {};
      // Remove conflicting keys from data before merging
      const { id: _ignoreId, type: _ignoreType, date: _ignoreDate, userId: _ignoreUser, ...safeData } = data;
      const flat = { ...w, ...safeData };
      // Ensure DB fields always win
      flat.id = w.id;
      flat.type = w.type;
      flat.date = w.date;
      return flat;
    });
    // Compute tonnage for gym workouts
    workoutsCache.forEach(w => {
      if (w.type === 'gym' && !w._tonnage) {
        let t = 0;
        (w.exercises||[]).forEach(ex => (ex.sets||[]).forEach(s => t += (s.reps||0)*(s.weight||0)));
        w._tonnage = t;
      }
    });

    settingsCache = settingsRes || {};
    if (settingsCache.activeSports) activeSports = settingsCache.activeSports;
    if (settingsCache.muscleGroups) muscleGroups = settingsCache.muscleGroups;

    exercisesCache = exercisesRes;
    if (!exercisesCache || (Array.isArray(exercisesCache) && !exercisesCache.length)) {
      exercisesCache = getDefaultExercises();
      api.post('/api/exercises', exercisesCache).catch(() => {});
    }

    weightsCache = Array.isArray(weightsRes) ? weightsRes : (weightsRes ? Object.values(weightsRes) : []);
    weightsCache.sort((a,b) => new Date(a.date) - new Date(b.date));

    followingCache = followingRes || {};

    populateSettingsUI();
    onDataChanged();
    updateSyncStatus();
  } catch (err) {
    console.error('Error loading data:', err);
    toast('Errore caricamento dati', 'error');
  }
}

// ==================== SCREEN / NAVIGATION ====================
function showScreen(name) {
  document.getElementById('screen-login').style.display = name === 'login' ? '' : 'none';
  document.getElementById('screen-app').style.display = name === 'app' ? '' : 'none';
  if (name === 'app') initApp();
}

const pageMap = {dashboard:'Dashboard',log:'Log',live:'Live',history:'Storico',progress:'Progressi',weight:'Peso',library:'Libreria',import:'Import',friends:'Amici',settings:'Impostazioni',profile:'Profilo',athletic:'Profilo Atletico'};

function showPage(page) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.remove('active');
    if(b.textContent===pageMap[page]) b.classList.add('active');
  });
  if(page==='dashboard') renderDashboard();
  if(page==='history') renderHistory();
  if(page==='progress') renderProgress();
  if(page==='weight') renderWeightPage();
  if(page==='library') { renderExerciseLibrary(); renderMuscleGroupsManager(); populateMuscleSelect(); }
  if(page==='settings') { populateSettingsUI(); renderSportsManager(); renderNotifications(); }
  if(page==='profile') renderProfile();
  if(page==='live') initLivePage();
  if(page==='log') initLogWizard();
  if(page==='friends') renderFriendsPageLocal();
  if(page==='athletic') renderAthleticDetail();
}

function onDataChanged() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-dashboard') renderDashboard();
  if (id === 'page-history') renderHistory();
  if (id === 'page-progress') renderProgress();
  if (id === 'page-weight') renderWeightPage();
}

// ==================== SAVE HELPERS (API calls) ====================
async function saveWorkout(workout) {
  const { type, date, ...rest } = workout;
  await api.post('/api/workouts', { type, date, data: rest });
}

async function deleteWorkout(id) {
  await api.del('/api/workouts/' + id);
}

async function saveSettingsToServer(s) {
  settingsCache = s;
  await api.put('/api/settings', s);
}

async function saveExercisesToServer(lib) {
  exercisesCache = lib;
  await api.put('/api/exercises', lib);
}

// ==================== LOG WIZARD ====================
function initLogWizard() {
  wizStep = 1; wizType = ''; wizExercises = [];
  document.getElementById('wiz-date').value = todayStr();
  document.getElementById('wiz-exercises').innerHTML = '';
  document.getElementById('wiz-notes').value = '';
  renderSportTypeGrid();
  updateWizStep();
}

function renderSportTypeGrid() {
  const sports = getUserActiveSports(settingsCache);
  const grid = document.getElementById('sport-type-grid');
  grid.innerHTML = sports.map(key => {
    const s = SPORT_TEMPLATES[key];
    if (!s) return '';
    return `<div class="type-card" data-sport="${key}"><div class="type-icon">${s.icon}</div><div class="type-name">${s.name}</div></div>`;
  }).join('');

  // Bind click events
  grid.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', function() { selectWorkoutType(this.dataset.sport, this); });
  });
}

function selectWorkoutType(type, el) {
  wizType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  setTimeout(() => wizGoStep(2), 200);
}

function wizGoStep(step) {
  if (step === 2 && !wizType) { toast('Seleziona un tipo!', 'error'); return; }
  wizStep = step;
  updateWizStep();
}

function wizGoBack() {
  if (wizStep > 1) {
    if (wizStep === 3 && wizType === 'gym') wizStep = 2;
    else if (wizStep === 4 && wizType === 'gym') wizStep = 3;
    else if (wizStep === 4) wizStep = 2;
    else wizStep--;
    updateWizStep();
  }
}

function updateWizStep() {
  document.querySelectorAll('.log-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById('log-step-' + wizStep);
  if (stepEl) stepEl.classList.add('active');
  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((d, i) => {
    d.className = 'step-dot';
    if (i + 1 === wizStep) d.classList.add('active');
    else if (i + 1 < wizStep) d.classList.add('done');
  });
  document.getElementById('wiz-back-btn').style.display = wizStep > 1 ? '' : 'none';

  if (wizStep === 2) {
    const isGym = wizType === 'gym';
    document.getElementById('wiz-gym-step2').style.display = isGym ? '' : 'none';
    document.getElementById('wiz-sport-step2').style.display = isGym ? 'none' : '';
    if (!isGym) renderSportFields();
  }
  if (wizStep === 3 && wizType === 'gym') renderWizSets();
  if (wizStep === 4) {
    let extra = '';
    if (wizType === 'gym') {
      extra = '<div class="form-row"><div class="form-group"><label>Durata (min)</label><input type="number" id="wiz-gym-duration" placeholder="60"></div><div class="form-group"><label>RPE (1-10)</label><input type="number" id="wiz-gym-rpe" min="1" max="10" placeholder="7"></div></div>';
    }
    document.getElementById('wiz-extra-fields').innerHTML = extra;
  }
}

function renderSportFields() {
  const tmpl = SPORT_TEMPLATES[wizType];
  if (!tmpl) return;
  document.getElementById('wiz-sport-title').textContent = tmpl.icon + ' Dati ' + tmpl.name;
  const fields = tmpl.fields || [];
  let html = '<div class="form-row">';
  let count = 0;
  fields.forEach(fKey => {
    const f = FIELD_DEFS[fKey];
    if (!f) return;
    if (count > 0 && count % 2 === 0) html += '</div><div class="form-row">';
    if (f.type === 'select') {
      html += `<div class="form-group"><label>${f.label}</label><select id="wiz-field-${fKey}">${(f.options||[]).map(o=>`<option value="${o.v}">${o.t}</option>`).join('')}</select></div>`;
    } else {
      html += `<div class="form-group"><label>${f.label}</label><input type="${f.type}" ${f.step?'step="'+f.step+'"':''} ${f.min!==undefined?'min="'+f.min+'"':''} ${f.max!==undefined?'max="'+f.max+'"':''} id="wiz-field-${fKey}" placeholder="${f.ph||''}"></div>`;
    }
    count++;
  });
  html += '</div>';
  document.getElementById('wiz-sport-fields').innerHTML = html;
}

// Exercise bottom sheet
function openExerciseSheet(callback) {
  _sheetCallback = callback || addWizExercise;
  document.getElementById('exercise-sheet-overlay').classList.add('show');
  document.getElementById('exercise-sheet').classList.add('show');
  document.getElementById('exercise-search').value = '';
  renderExerciseSheetList();
  setTimeout(() => document.getElementById('exercise-search').focus(), 300);
}
function closeExerciseSheet() {
  document.getElementById('exercise-sheet-overlay').classList.remove('show');
  document.getElementById('exercise-sheet').classList.remove('show');
}
function renderExerciseSheetList(filter = '') {
  const lib = exercisesCache || getDefaultExercises();
  const q = filter.toLowerCase();
  const filtered = q ? lib.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)) : lib;
  const listEl = document.getElementById('exercise-sheet-list');
  listEl.innerHTML = filtered.map(e =>
    `<div class="bs-exercise-item" data-ex-name="${e.name.replace(/"/g,'&quot;')}" data-ex-muscle="${e.muscle}"><span class="bs-ex-name">${e.name}</span><span class="bs-ex-muscle">${e.muscle}</span></div>`
  ).join('');
  listEl.querySelectorAll('.bs-exercise-item').forEach(item => {
    item.addEventListener('click', () => (_sheetCallback || addWizExercise)(item.dataset.exName, item.dataset.exMuscle));
  });
}
function filterExerciseSheet() {
  renderExerciseSheetList(document.getElementById('exercise-search').value);
}

function addWizExercise(name, muscle) {
  closeExerciseSheet();
  const lastPerf = getLastPerformance(name);
  wizExercises.push({
    name, muscle,
    sets: lastPerf ? lastPerf.sets.map(s => ({reps: s.reps, weight: s.weight, rpe: s.rpe || null})) : [{reps: '', weight: '', rpe: null}],
    lastPerf
  });
  renderWizExerciseList();
}

function getLastPerformance(exerciseName) {
  const sorted = [...workoutsCache].filter(w => w.type === 'gym').sort((a,b) => new Date(b.date) - new Date(a.date));
  for (const w of sorted) {
    const ex = (w.exercises || []).find(e => e.name === exerciseName);
    if (ex && ex.sets && ex.sets.length) return ex;
  }
  return null;
}

function renderWizExerciseList() {
  const el = document.getElementById('wiz-exercises');
  el.innerHTML = wizExercises.map((ex, idx) => {
    const lastStr = ex.lastPerf ? `Ultima volta: ${ex.lastPerf.sets.length}x${ex.lastPerf.sets[0]?.reps||'?'} @ ${ex.lastPerf.sets[0]?.weight||'?'}kg` : '';
    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><button class="btn-icon" data-remove-ex="${idx}">&times;</button></div>
      <div class="exercise-card-muscle">${ex.muscle}</div>
      ${lastStr ? `<div class="exercise-card-last">${lastStr}</div>` : ''}
    </div>`;
  }).join('');
  el.querySelectorAll('[data-remove-ex]').forEach(btn => {
    btn.addEventListener('click', () => removeWizExercise(parseInt(btn.dataset.removeEx)));
  });
}

function removeWizExercise(idx) { wizExercises.splice(idx, 1); renderWizExerciseList(); }

function renderWizSets() {
  const _paramLabels={reps:'Reps',duration:'Sec',distance:'m',calories:'Kcal'};
  const _paramPh={reps:'Reps',duration:'Secondi',distance:'Metri',calories:'Kcal'};
  const container = document.getElementById('wiz-sets-container');
  container.innerHTML = wizExercises.map((ex, exIdx) => {
    const lib=exercisesCache||[];
    const libEntry=lib.find(e=>e.name===ex.name);
    const param=libEntry?.param||'reps';
    const paramLabel=_paramLabels[param]||'Reps';
    const paramPh=_paramPh[param]||'Reps';
    let setsHTML = ex.sets.map((s, sIdx) =>
      `<div class="set-inline">
        <div class="set-num">${sIdx+1}</div>
        <input type="number" placeholder="${paramPh}" value="${s.reps||''}" data-set-update="${exIdx}-${sIdx}-reps">
        ${param==='reps'?`<input type="number" step="0.5" placeholder="Kg" value="${s.weight||''}" data-set-update="${exIdx}-${sIdx}-weight">`:''}
        <select data-set-update="${exIdx}-${sIdx}-rpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${s.rpe==n?'selected':''}>${n}</option>`).join('')}</select>
        <button class="btn-icon" data-remove-set="${exIdx}-${sIdx}">&#128465;</button>
      </div>`
    ).join('');
    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><span class="exercise-card-muscle">${ex.muscle} <span style="font-size:.72rem;color:var(--blue)">${paramLabel}</span></span></div>
      ${setsHTML}
      <div style="display:flex;gap:6px;margin-top:4px">
        <button class="btn btn-sm btn-secondary" data-add-set="${exIdx}">+ Serie</button>
        ${ex.lastPerf ? `<button class="copy-set-btn" data-copy-sets="${exIdx}">Copia precedente</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Bind events
  container.querySelectorAll('[data-set-update]').forEach(el => {
    el.addEventListener('change', function() {
      const [exIdx, sIdx, field] = this.dataset.setUpdate.split('-');
      wizUpdateSet(parseInt(exIdx), parseInt(sIdx), field, this.value);
    });
  });
  container.querySelectorAll('[data-remove-set]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [exIdx, sIdx] = this.dataset.removeSet.split('-').map(Number);
      wizRemoveSet(exIdx, sIdx);
    });
  });
  container.querySelectorAll('[data-add-set]').forEach(btn => {
    btn.addEventListener('click', function() { wizAddSet(parseInt(this.dataset.addSet)); });
  });
  container.querySelectorAll('[data-copy-sets]').forEach(btn => {
    btn.addEventListener('click', function() { wizCopyLastSets(parseInt(this.dataset.copySets)); });
  });
}

function wizUpdateSet(exIdx, sIdx, field, value) {
  if (field === 'reps') wizExercises[exIdx].sets[sIdx].reps = parseInt(value) || '';
  else if (field === 'weight') wizExercises[exIdx].sets[sIdx].weight = parseFloat(value) || '';
  else if (field === 'rpe') wizExercises[exIdx].sets[sIdx].rpe = parseInt(value) || null;
}
function wizAddSet(exIdx) {
  const lastSet = wizExercises[exIdx].sets[wizExercises[exIdx].sets.length - 1] || {};
  wizExercises[exIdx].sets.push({reps: lastSet.reps || '', weight: lastSet.weight || '', rpe: lastSet.rpe || null});
  renderWizSets();
}
function wizRemoveSet(exIdx, sIdx) {
  wizExercises[exIdx].sets.splice(sIdx, 1);
  if (!wizExercises[exIdx].sets.length) wizExercises[exIdx].sets.push({reps: '', weight: '', rpe: null});
  renderWizSets();
}
function wizCopyLastSets(exIdx) {
  const last = wizExercises[exIdx].lastPerf;
  if (last) { wizExercises[exIdx].sets = last.sets.map(s => ({reps: s.reps, weight: s.weight, rpe: s.rpe || null})); renderWizSets(); toast('Serie copiate!'); }
}

async function wizSaveWorkout() {
  const date = document.getElementById('wiz-date').value || todayStr();
  const notes = document.getElementById('wiz-notes').value;

  if (wizType === 'gym') {
    const exercises = [];
    wizExercises.forEach(ex => {
      const sets = ex.sets.filter(s => s.reps > 0);
      if (sets.length) exercises.push({name: ex.name, muscle: ex.muscle, sets});
    });
    if (!exercises.length) { toast('Aggiungi almeno un esercizio!', 'error'); return; }
    const workout = { id: uid(), type: 'gym', date, duration: parseInt(document.getElementById('wiz-gym-duration')?.value) || null,
      rpe: parseInt(document.getElementById('wiz-gym-rpe')?.value) || null, notes, exercises };
    let tonnage = 0;
    exercises.forEach(ex => ex.sets.forEach(s => tonnage += (s.reps||0) * (s.weight||0)));
    workout._tonnage = tonnage;
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout);
    await saveWorkout(workout);
    workoutsCache.push(workout);
    toast('Palestra salvata! Score: ' + workout.scores.overall, 'success');
    fetchPubMedForWorkout(workout);
  } else {
    const tmpl = SPORT_TEMPLATES[wizType];
    const workout = { id: uid(), type: wizType, date, notes };
    (tmpl?.fields || []).forEach(fKey => {
      const el = document.getElementById('wiz-field-' + fKey);
      if (!el) return;
      const f = FIELD_DEFS[fKey];
      if (f?.type === 'number') workout[fKey] = parseFloat(el.value) || null;
      else workout[fKey] = el.value || null;
    });
    if (wizType === 'running') {
      const paceStr = workout.pace;
      workout.paceInput = paceStr;
      workout._pace = paceToSeconds(paceStr) || (workout.duration && workout.distance ? (workout.duration*60)/workout.distance : 0);
      delete workout.pace;
    }
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout);
    await saveWorkout(workout);
    workoutsCache.push(workout);
    const sportName = tmpl?.name || wizType;
    toast(sportName + ' salvato! Score: ' + workout.scores.overall, 'success');
    if (wizType === 'running') fetchPubMedForWorkout(workout);
  }
  showPage('dashboard');
}

// ==================== PUBMED ====================
const PUBMED_CACHE_KEY = 'ta_pubmed_cache';
function getPubMedCache() { try { return JSON.parse(sessionStorage.getItem(PUBMED_CACHE_KEY)) || {}; } catch { return {}; } }
function setPubMedCache(key, data) { const c = getPubMedCache(); c[key] = data; sessionStorage.setItem(PUBMED_CACHE_KEY, JSON.stringify(c)); }

function buildPubMedQuery(workout) {
  if (workout.type === 'gym') {
    const muscles = [...new Set((workout.exercises || []).map(e => e.muscle).filter(Boolean))];
    const muscleMap = {'Petto':'chest press bench','Schiena':'back rowing pull','Spalle':'shoulder overhead press',
      'Bicipiti':'biceps curl','Tricipiti':'triceps extension','Quadricipiti':'squat quadriceps',
      'Femorali':'hamstring deadlift','Glutei':'glute hip thrust','Polpacci':'calf raise',
      'Addominali':'core abdominal','Full Body':'compound exercise'};
    const muscleTerms = muscles.slice(0,2).map(m => muscleMap[m]||m).join(' ');
    const rpe = workout.rpe||7;
    const intensity = rpe>=8?'high intensity':rpe>=5?'moderate intensity':'low intensity';
    return `strength training ${intensity} hypertrophy ${muscleTerms}`;
  }
  if (workout.type === 'running') {
    const typeMap = {easy:'aerobic base training',tempo:'lactate threshold running',interval:'interval training VO2max',long:'long distance endurance',recovery:'active recovery running',race:'race performance'};
    return `running ${typeMap[workout.runType]||'endurance'} cardiovascular adaptation`;
  }
  return 'exercise training adaptation performance';
}

async function fetchPubMedForWorkout(workout) {
  const query = buildPubMedQuery(workout);
  const cache = getPubMedCache();
  if (cache[query]) return cache[query];
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&sort=date&term=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (!ids.length) return [];
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();
    const articles = ids.map(id => {
      const item = summaryData.result?.[id];
      if (!item) return null;
      return { id, title: item.title, authors: (item.authors||[]).slice(0,3).map(a=>a.name).join(', '),
        year: item.pubdate?.split(' ')[0]||'', source: item.source||'',
        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/` };
    }).filter(Boolean);
    try {
      const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${ids.join(',')}`;
      const abstractRes = await fetch(abstractUrl);
      const abstractText = await abstractRes.text();
      const xmlDoc = new DOMParser().parseFromString(abstractText, 'text/xml');
      xmlDoc.querySelectorAll('PubmedArticle').forEach((node, i) => {
        const el = node.querySelector('AbstractText');
        if (el && articles[i]) {
          const full = el.textContent;
          articles[i].abstract = full.length > 300 ? full.slice(0,300)+'...' : full;
        }
      });
    } catch(e) {}
    setPubMedCache(query, articles);
    return articles;
  } catch(e) { return []; }
}

function renderPubMedBox(articles) {
  if (!articles || !articles.length) return '';
  let html = `<div class="research-box"><div class="research-header" onclick="this.nextElementSibling.classList.toggle('open')"><h4>Cosa dice la ricerca</h4><span style="font-size:.8rem;color:var(--text2)">&#9660;</span></div><div class="research-body">`;
  articles.forEach(a => {
    html += `<div class="research-article"><div class="article-title"><a href="${a.link}" target="_blank">${a.title}</a></div><div class="article-meta">${a.authors} - ${a.source} (${a.year})</div>${a.abstract?`<div class="article-insight">${a.abstract}</div>`:''}</div>`;
  });
  return html + '</div></div>';
}

// ==================== LIVE WORKOUT ====================

// --- Timer utilities ---
function liveFormatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
function liveGetElapsed() {
  if (!liveSession) return 0;
  const now = liveSession.paused ? liveSession.pausedAt : Date.now();
  return Math.floor((now - liveSession.startTime - liveSession.totalPaused) / 1000);
}
function liveUpdateTimerDisplay() {
  const el = document.getElementById('live-timer');
  if (!el) return;
  el.textContent = liveFormatTime(liveGetElapsed());
  el.classList.toggle('paused', !!(liveSession && liveSession.paused));
}
function liveStartTimer() {
  liveStopTimer();
  liveUpdateTimerDisplay();
  liveTimerInterval = setInterval(liveUpdateTimerDisplay, 1000);
}
function liveStopTimer() {
  if (liveTimerInterval) { clearInterval(liveTimerInterval); liveTimerInterval = null; }
}

// --- localStorage persistence ---
function liveDraftKey() { return 'liveSession_' + (currentUser?.uid || 'anon'); }
function liveSaveDraft() {
  if (!liveSession) return;
  liveSession._lastSavedAt = Date.now();
  try { localStorage.setItem(liveDraftKey(), JSON.stringify(liveSession)); } catch(e) {}
}
function liveLoadDraft() {
  try { const d = localStorage.getItem(liveDraftKey()); return d ? JSON.parse(d) : null; } catch(e) { return null; }
}
function liveClearDraft() {
  try { localStorage.removeItem(liveDraftKey()); } catch(e) {}
}

// --- Draft recovery ---
function liveCheckDraft() {
  const draft = liveLoadDraft();
  if (draft) {
    document.getElementById('live-recovery-modal').classList.add('show');
  }
}
function liveResumeDraft() {
  document.getElementById('live-recovery-modal').classList.remove('show');
  const draft = liveLoadDraft();
  if (!draft) return;
  // Adjust for offline gap: add time since last save to totalPaused if was not paused
  if (!draft.paused && draft._lastSavedAt) {
    const gap = Date.now() - draft._lastSavedAt;
    draft.totalPaused = (draft.totalPaused || 0) + gap;
  } else if (draft.paused) {
    // Was paused — pausedAt stays as it was
  }
  liveSession = draft;
  showPage('live');
}
function liveDiscardDraft() {
  document.getElementById('live-recovery-modal').classList.remove('show');
  liveClearDraft();
  liveSession = null;
}

// --- Screen management ---
function liveShowScreen(screen) {
  document.querySelectorAll('#page-live .live-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('live-' + screen);
  if (el) el.classList.add('active');
}

// --- Start screen ---
function initLivePage() {
  if (liveSession) {
    liveShowScreen('active');
    liveRenderActive();
    liveStartTimer();
    return;
  }
  liveShowScreen('start');
  liveSelectedType = '';
  const dateEl = document.getElementById('live-date');
  if (dateEl) dateEl.value = todayStr();
  document.getElementById('live-start-btn').disabled = true;
  liveRenderSportGrid();
}
function liveRenderSportGrid() {
  const sports = getUserActiveSports(settingsCache);
  const grid = document.getElementById('live-sport-grid');
  grid.innerHTML = sports.map(key => {
    const s = SPORT_TEMPLATES[key];
    if (!s) return '';
    return `<div class="type-card" data-live-sport="${key}"><div class="type-icon">${s.icon}</div><div class="type-name">${s.name}</div></div>`;
  }).join('');
  grid.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      liveSelectedType = card.dataset.liveSport;
      document.getElementById('live-start-btn').disabled = false;
    });
  });
}

// --- Session start ---
function liveStart() {
  if (!liveSelectedType) { toast('Seleziona un tipo!', 'error'); return; }
  const date = document.getElementById('live-date').value || todayStr();
  liveSession = {
    type: liveSelectedType,
    date,
    startTime: Date.now(),
    exercises: [],
    paused: false,
    pausedAt: null,
    totalPaused: 0,
    sportFields: {},
    _lastSavedAt: Date.now()
  };
  liveShowScreen('active');
  liveRenderActive();
  liveStartTimer();
  liveSaveDraft();
  // For gym, open exercise sheet immediately
  if (liveSelectedType === 'gym') {
    document.getElementById('live-fab').style.display = '';
    setTimeout(() => openExerciseSheet(liveAddExercise), 300);
  }
}

// --- Pause/Resume ---
function livePauseResume() {
  if (!liveSession) return;
  if (liveSession.paused) {
    // Resume
    liveSession.totalPaused += Date.now() - liveSession.pausedAt;
    liveSession.paused = false;
    liveSession.pausedAt = null;
    document.getElementById('live-pause-btn').textContent = 'Pausa';
    liveStartTimer();
  } else {
    // Pause
    liveSession.paused = true;
    liveSession.pausedAt = Date.now();
    document.getElementById('live-pause-btn').textContent = 'Riprendi';
    liveStopTimer();
    liveUpdateTimerDisplay();
  }
  liveSaveDraft();
}

// --- Exercise management (gym) ---
function liveAddExercise(name, muscle) {
  closeExerciseSheet();
  if (!liveSession) return;
  const lastPerf = getLastPerformance(name);
  const sets = lastPerf
    ? lastPerf.sets.map(s => ({reps: s.reps, weight: s.weight, rpe: s.rpe || null, done: false}))
    : [{reps: '', weight: '', rpe: null, done: false}];
  liveSession.exercises.push({ name, muscle, sets, lastPerf });
  liveRenderExercises();
  liveSaveDraft();
}
function liveRemoveExercise(idx) {
  if (!liveSession) return;
  liveSession.exercises.splice(idx, 1);
  liveRenderExercises();
  liveSaveDraft();
}
function liveOpenSheet() {
  openExerciseSheet(liveAddExercise);
}

// --- Set management ---
function liveUpdateSet(exIdx, sIdx, field, value) {
  if (!liveSession) return;
  const set = liveSession.exercises[exIdx]?.sets[sIdx];
  if (!set) return;
  if (field === 'reps') set.reps = parseInt(value) || '';
  else if (field === 'weight') set.weight = parseFloat(value) || '';
  else if (field === 'rpe') set.rpe = parseInt(value) || null;
  liveSaveDraft();
}
function liveAddSet(exIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  const lastSet = ex.sets[ex.sets.length - 1] || {};
  ex.sets.push({reps: lastSet.reps || '', weight: lastSet.weight || '', rpe: lastSet.rpe || null, done: false});
  liveRenderExercises();
  liveSaveDraft();
}
function liveRemoveSet(exIdx, sIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  ex.sets.splice(sIdx, 1);
  if (!ex.sets.length) ex.sets.push({reps: '', weight: '', rpe: null, done: false});
  liveRenderExercises();
  liveSaveDraft();
}
function liveCompleteSet(exIdx, sIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  const set = ex.sets[sIdx];
  if (!set || set.done) return;
  set.done = true;
  // Auto-add new empty set if this was the last undone set
  const hasUndone = ex.sets.some(s => !s.done);
  if (!hasUndone) {
    ex.sets.push({reps: set.reps || '', weight: set.weight || '', rpe: null, done: false});
  }
  liveRenderExercises();
  liveSaveDraft();
  liveRestStart();
}

// --- Rest timer ---
function liveRestStart() {
  liveRestTotal = 90;
  liveRestRemaining = 90;
  liveRestDismiss(); // clear any existing
  const overlay = document.getElementById('live-rest-overlay');
  overlay.style.display = '';
  liveRestUpdate();
  liveRestInterval = setInterval(() => {
    liveRestRemaining--;
    if (liveRestRemaining <= 0) {
      liveRestRemaining = 0;
      liveRestUpdate();
      liveRestDismiss();
      try { navigator.vibrate?.(200); } catch(e) {}
      toast('Riposo terminato!');
    } else {
      liveRestUpdate();
    }
  }, 1000);
}
function liveRestUpdate() {
  const timeEl = document.getElementById('live-rest-time');
  const progEl = document.getElementById('live-rest-progress');
  if (timeEl) {
    const m = Math.floor(liveRestRemaining / 60);
    const s = liveRestRemaining % 60;
    timeEl.textContent = m + ':' + String(s).padStart(2, '0');
  }
  if (progEl) {
    const circumference = 339.292;
    const fraction = liveRestTotal > 0 ? liveRestRemaining / liveRestTotal : 0;
    progEl.setAttribute('stroke-dashoffset', circumference * (1 - fraction));
  }
}
function liveRestAdjust(seconds) {
  liveRestRemaining = Math.max(0, liveRestRemaining + seconds);
  liveRestTotal = Math.max(liveRestTotal, liveRestRemaining);
  liveRestUpdate();
}
function liveRestDismiss() {
  if (liveRestInterval) { clearInterval(liveRestInterval); liveRestInterval = null; }
  const overlay = document.getElementById('live-rest-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- Rendering ---
function liveRenderActive() {
  if (!liveSession) return;
  const isGym = liveSession.type === 'gym';
  document.getElementById('live-fab').style.display = isGym ? '' : 'none';
  document.getElementById('live-exercises').style.display = isGym ? '' : 'none';
  document.getElementById('live-sport-fields-container').style.display = isGym ? 'none' : '';
  if (isGym) {
    liveRenderExercises();
  } else {
    liveRenderSportFields();
  }
  const btn = document.getElementById('live-pause-btn');
  if (btn) btn.textContent = liveSession.paused ? 'Riprendi' : 'Pausa';
}

function liveRenderExercises() {
  const container = document.getElementById('live-exercises');
  if (!liveSession || !container) return;
  const exercises = liveSession.exercises;
  if (!exercises.length) {
    container.innerHTML = '<div class="card" style="text-align:center;color:var(--text2);padding:32px"><p>Nessun esercizio aggiunto.</p><p style="font-size:.85rem">Usa il pulsante + per aggiungere esercizi.</p></div>';
    return;
  }
  container.innerHTML = exercises.map((ex, exIdx) => {
    const lib = exercisesCache || [];
    const libEntry = lib.find(e => e.name === ex.name);
    const param = libEntry?.param || 'reps';
    const _paramLabels = {reps:'Reps', duration:'Sec', distance:'m', calories:'Kcal'};
    const _paramPh = {reps:'Reps', duration:'Secondi', distance:'Metri', calories:'Kcal'};
    const paramLabel = _paramLabels[param] || 'Reps';
    const paramPh = _paramPh[param] || 'Reps';
    const lastStr = ex.lastPerf ? `Ultima volta: ${ex.lastPerf.sets.length}x${ex.lastPerf.sets[0]?.reps||'?'} @ ${ex.lastPerf.sets[0]?.weight||'?'}kg` : '';

    let setsHTML = ex.sets.map((s, sIdx) => {
      const doneClass = s.done ? ' done' : '';
      const actionBtn = s.done
        ? `<span class="set-done-check">&#10003;</span>`
        : `<button class="btn-fatto" data-live-done="${exIdx}-${sIdx}">Fatto</button>`;
      return `<div class="set-inline${doneClass}">
        <div class="set-num">${sIdx+1}</div>
        <input type="number" placeholder="${paramPh}" value="${s.reps||''}" data-live-set="${exIdx}-${sIdx}-reps">
        ${param==='reps'?`<input type="number" step="0.5" placeholder="Kg" value="${s.weight||''}" data-live-set="${exIdx}-${sIdx}-weight">`:''}
        <select data-live-set="${exIdx}-${sIdx}-rpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${s.rpe==n?'selected':''}>${n}</option>`).join('')}</select>
        ${actionBtn}
        <button class="btn-icon" data-live-remove-set="${exIdx}-${sIdx}">&#128465;</button>
      </div>`;
    }).join('');

    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><span class="exercise-card-muscle">${ex.muscle}</span><button class="btn-icon" data-live-remove-ex="${exIdx}" style="margin-left:auto">&times;</button></div>
      ${lastStr ? `<div style="font-size:.75rem;color:var(--text2);margin-bottom:6px">${lastStr}</div>` : ''}
      ${setsHTML}
      <button class="btn btn-sm btn-secondary" data-live-add-set="${exIdx}" style="margin-top:4px">+ Serie</button>
    </div>`;
  }).join('');

  // Bind events
  container.querySelectorAll('[data-live-set]').forEach(el => {
    el.addEventListener('change', function() {
      const [exIdx, sIdx, field] = this.dataset.liveSet.split('-');
      liveUpdateSet(parseInt(exIdx), parseInt(sIdx), field, this.value);
    });
  });
  container.querySelectorAll('[data-live-done]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [exIdx, sIdx] = this.dataset.liveDone.split('-').map(Number);
      liveCompleteSet(exIdx, sIdx);
    });
  });
  container.querySelectorAll('[data-live-add-set]').forEach(btn => {
    btn.addEventListener('click', function() { liveAddSet(parseInt(this.dataset.liveAddSet)); });
  });
  container.querySelectorAll('[data-live-remove-set]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [exIdx, sIdx] = this.dataset.liveRemoveSet.split('-').map(Number);
      liveRemoveSet(exIdx, sIdx);
    });
  });
  container.querySelectorAll('[data-live-remove-ex]').forEach(btn => {
    btn.addEventListener('click', function() { liveRemoveExercise(parseInt(this.dataset.liveRemoveEx)); });
  });
}

function liveRenderSportFields() {
  if (!liveSession) return;
  const tmpl = SPORT_TEMPLATES[liveSession.type];
  if (!tmpl) return;
  document.getElementById('live-sport-title').textContent = tmpl.icon + ' ' + tmpl.name;
  const fields = (tmpl.fields || []).filter(f => f !== 'duration'); // duration comes from timer
  let html = '<div class="form-row">';
  let count = 0;
  fields.forEach(fKey => {
    const f = FIELD_DEFS[fKey];
    if (!f) return;
    if (count > 0 && count % 2 === 0) html += '</div><div class="form-row">';
    const val = liveSession.sportFields[fKey] || '';
    if (f.type === 'select') {
      html += `<div class="form-group"><label>${f.label}</label><select data-live-field="${fKey}">${(f.options||[]).map(o=>`<option value="${o.v}" ${val===o.v?'selected':''}>${o.t}</option>`).join('')}</select></div>`;
    } else {
      html += `<div class="form-group"><label>${f.label}</label><input type="${f.type}" ${f.step?'step="'+f.step+'"':''} ${f.min!==undefined?'min="'+f.min+'"':''} ${f.max!==undefined?'max="'+f.max+'"':''} data-live-field="${fKey}" placeholder="${f.ph||''}" value="${val}"></div>`;
    }
    count++;
  });
  html += '</div>';
  document.getElementById('live-sport-fields').innerHTML = html;
  // Bind change events
  document.querySelectorAll('[data-live-field]').forEach(el => {
    el.addEventListener('change', function() {
      liveSession.sportFields[this.dataset.liveField] = this.value;
      liveSaveDraft();
    });
  });
}

// --- Finish flow ---
function liveFinishPrompt() {
  if (!liveSession) return;
  const elapsed = liveGetElapsed();
  const durationMin = Math.round(elapsed / 60);
  document.getElementById('live-duration').value = durationMin;

  // Build summary
  const tmpl = SPORT_TEMPLATES[liveSession.type];
  let summaryHTML = '';
  summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Sport</span><span class="live-summary-value">${tmpl?.icon||''} ${tmpl?.name||liveSession.type}</span></div>`;
  summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Data</span><span class="live-summary-value">${liveSession.date}</span></div>`;
  summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Durata</span><span class="live-summary-value">${liveFormatTime(elapsed)}</span></div>`;

  if (liveSession.type === 'gym') {
    const exCount = liveSession.exercises.length;
    let totalSets = 0, tonnage = 0;
    liveSession.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (s.done && s.reps > 0) {
          totalSets++;
          tonnage += (s.reps || 0) * (s.weight || 0);
        }
      });
    });
    summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Esercizi</span><span class="live-summary-value">${exCount}</span></div>`;
    summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Serie completate</span><span class="live-summary-value">${totalSets}</span></div>`;
    summaryHTML += `<div class="live-summary-row"><span class="live-summary-label">Tonnellaggio</span><span class="live-summary-value">${tonnage.toLocaleString()} kg</span></div>`;
  }
  document.getElementById('live-summary').innerHTML = summaryHTML;

  liveStopTimer();
  liveRestDismiss();
  liveShowScreen('finish');
}

function liveBackToSession() {
  liveShowScreen('active');
  if (liveSession && !liveSession.paused) liveStartTimer();
}

async function liveSaveWorkout() {
  if (!liveSession) return;
  const elapsed = liveGetElapsed();
  const durationMin = parseInt(document.getElementById('live-duration').value) || Math.round(elapsed / 60);
  const rpe = parseInt(document.getElementById('live-rpe').value) || null;
  const notes = document.getElementById('live-notes').value || '';

  if (liveSession.type === 'gym') {
    const exercises = [];
    liveSession.exercises.forEach(ex => {
      const sets = ex.sets.filter(s => s.done && s.reps > 0).map(s => ({reps: s.reps, weight: s.weight, rpe: s.rpe}));
      if (sets.length) exercises.push({name: ex.name, muscle: ex.muscle, sets});
    });
    if (!exercises.length) { toast('Nessuna serie completata!', 'error'); return; }
    const workout = { id: uid(), type: 'gym', date: liveSession.date, duration: durationMin, rpe, notes, exercises };
    let tonnage = 0;
    exercises.forEach(ex => ex.sets.forEach(s => tonnage += (s.reps||0) * (s.weight||0)));
    workout._tonnage = tonnage;
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout);
    await saveWorkout(workout);
    workoutsCache.push(workout);
    toast('Palestra salvata! Score: ' + workout.scores.overall, 'success');
    fetchPubMedForWorkout(workout);
  } else {
    const tmpl = SPORT_TEMPLATES[liveSession.type];
    const workout = { id: uid(), type: liveSession.type, date: liveSession.date, notes, duration: durationMin };
    if (rpe) workout.rpe = rpe;
    // Copy sport fields
    Object.entries(liveSession.sportFields).forEach(([key, val]) => {
      const f = FIELD_DEFS[key];
      if (f?.type === 'number') workout[key] = parseFloat(val) || null;
      else workout[key] = val || null;
    });
    if (liveSession.type === 'running') {
      const paceStr = workout.pace;
      workout.paceInput = paceStr;
      workout._pace = paceToSeconds(paceStr) || (workout.duration && workout.distance ? (workout.duration*60)/workout.distance : 0);
      delete workout.pace;
    }
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout);
    await saveWorkout(workout);
    workoutsCache.push(workout);
    const sportName = tmpl?.name || liveSession.type;
    toast(sportName + ' salvato! Score: ' + workout.scores.overall, 'success');
    if (liveSession.type === 'running') fetchPubMedForWorkout(workout);
  }

  // Cleanup
  liveStopTimer();
  liveRestDismiss();
  liveSession = null;
  liveClearDraft();
  document.getElementById('live-fab').style.display = 'none';
  showPage('dashboard');
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const workouts=[...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const now=todayStr();
  const thisWeek=workouts.filter(w=>daysBetween(now,w.date)<=7);
  const weekGoal=settingsCache.weekgoal||4;
  const avgScore=workouts.length?(workouts.reduce((s,w)=>s+(w.scores?.overall||0),0)/workouts.length).toFixed(1):'--';
  const weekKm=thisWeek.filter(w=>w.type==='running').reduce((s,w)=>s+(w.distance||0),0).toFixed(1);
  const weekTonnage=thisWeek.filter(w=>w.type==='gym').reduce((s,w)=>s+(w._tonnage||0),0);

  document.getElementById('dash-stats').innerHTML=`
    <div class="card"><div class="stat-box"><div class="stat-value" style="color:${thisWeek.length>=weekGoal?'var(--green)':'var(--yellow)'}">${thisWeek.length}/${weekGoal}</div><div class="stat-label">Allenamenti settimana</div></div></div>
    <div class="card"><div class="stat-box"><div class="stat-value" style="color:var(--accent)">${avgScore}</div><div class="stat-label">Score Medio</div></div></div>
    <div class="card"><div class="stat-box"><div class="stat-value" style="color:var(--green)">${weekKm} km</div><div class="stat-label">Km corsa settimana</div></div></div>
    <div class="card"><div class="stat-box"><div class="stat-value" style="color:var(--blue)">${Math.round(weekTonnage/1000*10)/10}t</div><div class="stat-label">Tonnellaggio settimana</div></div></div>`;

  const streak = calculateStreak(workoutsCache);
  document.getElementById('dash-streak').innerHTML = `
    <div style="text-align:center"><div class="streak-num">${streak.current}</div><div class="streak-info"><div class="streak-label">giorni consecutivi</div></div></div>
    <div style="text-align:center"><div class="streak-num" style="color:var(--yellow)">${streak.record}</div><div class="streak-info"><div class="streak-label">record storico</div></div></div>`;

  renderHeatmap(workouts);

  const recovery=getRecoveryStatus(workoutsCache, muscleGroups);
  let recHTML='';
  if(recovery.suggestedRestDays>0) recHTML+=`<div class="advice-box" style="margin-bottom:12px">Carico alto (${recovery.workoutsLast7} in 7gg). Consigliati ${recovery.suggestedRestDays} giorni di riposo.</div>`;
  Object.entries(recovery.muscleRecovery).forEach(([muscle,info])=>{
    if(info.pct>=100||!info.lastWorked) return;
    const color=info.pct>=80?'var(--green)':info.pct>=50?'var(--yellow)':'var(--red)';
    recHTML+=`<div class="muscle-item"><span>${muscle}</span><div style="display:flex;align-items:center;gap:8px"><span style="font-size:.8rem;color:var(--text2)">${info.daysAgo}g fa</span><div class="muscle-bar-bg"><div class="muscle-bar-fill" style="width:${info.pct}%;background:${color}"></div></div><span style="font-size:.8rem;width:35px;text-align:right">${info.pct}%</span></div></div>`;
  });
  if(!recHTML) recHTML='<p style="color:var(--text2);font-size:.85rem">Tutti i gruppi muscolari sono recuperati!</p>';
  document.getElementById('dash-recovery').innerHTML=recHTML;

  const recent=workouts.slice(0,5);
  document.getElementById('dash-recent').innerHTML = recent.length ?
    recent.map(w=>workoutItemHTML(w)).join('') :
    '<div class="empty-state"><p>Nessun allenamento registrato</p><p style="font-size:.85rem">Vai su "Log" per iniziare!</p></div>';

  renderWeeklyChart(workouts);
  renderRadarChart(workouts);
}

function workoutItemHTML(w) {
  const tmpl = SPORT_TEMPLATES[w.type];
  const typeName = tmpl?.name || w.type;
  const score=w.scores?.overall||'--';
  let detail = '';
  if (w.type==='gym') detail = `${(w.exercises||[]).length} esercizi \u00b7 ${Math.round((w._tonnage||0)/1000*10)/10}t`;
  else if (w.type==='running') { detail = `${w.distance||0} km \u00b7 ${secondsToPace(w._pace)}`; if(w.avghr) detail+=` \u00b7 FC ${w.avghr}`; }
  else if (w.type==='walking') { detail = `${w.distance||0} km \u00b7 ${w.duration||0} min`; if(w.avghr) detail+=` \u00b7 FC ${w.avghr}`; }
  else if (w.type==='cycling') { detail = `${w.distance||0} km \u00b7 ${w.duration||0} min`; if(w.avghr) detail+=` \u00b7 FC ${w.avghr}`; }
  else if (w.type==='swimming') { detail = `${w.distance?w.distance+' km \u00b7 ':''}${w.duration||0} min`; if(w.strokes) detail+=` \u00b7 ${w.strokes} bracciate`; }
  else if (w.type==='karting') detail = `${w.track||''} \u00b7 Best: ${w.bestLap||'--'}s`;
  else { let parts=[]; if(w.duration) parts.push(w.duration+' min'); if(w.distance) parts.push(w.distance+' km'); if(w.avghr) parts.push('FC '+w.avghr); detail=parts.join(' \u00b7 ')||''; }
  const typeClass = SPORT_TEMPLATES[w.type] ? 'type-'+w.type : 'type-custom';
  const isSelected = _selectedIds.has(w.id);
  const checkbox = _selectMode ? `<input type="checkbox" class="select-workout-cb" ${isSelected?'checked':''} style="width:18px;height:18px;cursor:pointer;flex-shrink:0">` : '';
  return `<div class="workout-item ${isSelected?'selected':''}" data-workout-id="${w.id}">
    ${checkbox}
    <div class="score-sm" style="background:${scoreColor(score)};color:#fff">${typeof score==='number'?score.toFixed(1):score}</div>
    <div class="workout-info"><h4>${formatDate(w.date)} <span class="workout-type-badge ${typeClass}">${typeName}</span></h4><p>${detail}</p></div>
  </div>`;
}

// ==================== HISTORY ====================
let _selectMode = false;
const _selectedIds = new Set();

function filterHistory(f, btn) {
  historyFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderHistory();
}

function toggleSelectMode() {
  _selectMode = !_selectMode;
  _selectedIds.clear();
  const bar = document.getElementById('history-select-bar');
  const btn = document.getElementById('btn-select-mode');
  if (bar) bar.style.display = _selectMode ? 'flex' : 'none';
  if (btn) { btn.textContent = _selectMode ? 'Annulla' : 'Seleziona'; btn.classList.toggle('active', _selectMode); }
  updateSelectCount();
  renderHistory();
}

function toggleWorkoutSelection(id) {
  if (_selectedIds.has(id)) _selectedIds.delete(id); else _selectedIds.add(id);
  const el = document.querySelector(`[data-workout-id="${id}"]`);
  if (el) el.classList.toggle('selected', _selectedIds.has(id));
  updateSelectCount();
}

function updateSelectCount() {
  const el = document.getElementById('history-select-count');
  if (el) el.textContent = _selectedIds.size + ' selezionati';
}

function selectAllVisible() {
  document.querySelectorAll('#history-list [data-workout-id]').forEach(el => {
    const id = el.dataset.workoutId;
    _selectedIds.add(id);
    el.classList.add('selected');
  });
  updateSelectCount();
}

function deselectAll() {
  _selectedIds.clear();
  document.querySelectorAll('#history-list .selected').forEach(el => el.classList.remove('selected'));
  updateSelectCount();
}

async function deleteSelected() {
  if (!_selectedIds.size) { toast('Nessun allenamento selezionato', 'error'); return; }
  if (!confirm(`Eliminare ${_selectedIds.size} allenamenti?`)) return;
  let deleted = 0;
  const ids = [..._selectedIds];
  // Delete in batches
  for (const id of ids) {
    try { await api.del('/api/workouts/' + id); deleted++; } catch(e) { console.error('Delete error', id, e); }
  }
  workoutsCache = workoutsCache.filter(w => !_selectedIds.has(w.id));
  _selectedIds.clear();
  toast(`${deleted} allenamenti eliminati`, 'success');
  updateSelectCount();
  onDataChanged();
}

function renderHistory() {
  const types = [...new Set(workoutsCache.map(w=>w.type))];
  const filtersEl = document.getElementById('history-filters');
  if (filtersEl) {
    filtersEl.innerHTML = `<button class="filter-btn ${historyFilter==='all'?'active':''}" data-hist-filter="all">Tutti</button>` +
      types.map(t => {
        const name = SPORT_TEMPLATES[t]?.name || t;
        return `<button class="filter-btn ${historyFilter===t?'active':''}" data-hist-filter="${t}">${name}</button>`;
      }).join('');
    filtersEl.querySelectorAll('[data-hist-filter]').forEach(btn => {
      btn.addEventListener('click', function() { filterHistory(this.dataset.histFilter, this); });
    });
  }

  let workouts=[...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(historyFilter!=='all') workouts=workouts.filter(w=>w.type===historyFilter);
  const listEl = document.getElementById('history-list');
  if(listEl) listEl.innerHTML=workouts.length?workouts.map(w=>workoutItemHTML(w)).join(''):'<div class="empty-state"><p>Nessun allenamento trovato</p></div>';
}

// ==================== WORKOUT DETAIL ====================
function showWorkoutDetail(id) {
  const w=workoutsCache.find(x=>x.id===id);
  if(!w) return;
  const tmpl = SPORT_TEMPLATES[w.type];
  const typeName = tmpl?.name || w.type;
  document.getElementById('modal-title').textContent=typeName+' - '+formatDate(w.date);
  let html='';
  const s=w.scores||{};
  html+=`<div style="display:flex;align-items:center;gap:20px;margin-bottom:16px;flex-wrap:wrap">
    <div class="score-circle" style="background:${scoreColor(s.overall||0)};color:#fff">${(s.overall||0).toFixed(1)}</div><div class="score-breakdown">`;
  const labels={volume:'Volume',intensity:'Intensita',variety:'Varieta',progression:'Progressione',duration:'Durata',distance:'Distanza',pace:'Pace',hrEfficiency:'Efficienza FC',effort:'Sforzo',consistency:'Costanza',improvement:'Miglioramento'};
  Object.entries(s).filter(([k])=>k!=='overall').forEach(([key,val])=>{
    html+=`<div class="score-item"><div class="score-sm" style="background:${scoreColor(val)};color:#fff">${val}</div><div class="score-label">${labels[key]||key}</div></div>`;
  });
  html+='</div></div>';
  if(w.advice?.length) html+='<div class="advice-box">'+w.advice.map(a=>'- '+a).join('<br>')+'</div>';
  html+='<div style="margin-top:16px">';
  if(w.type==='gym') {
    let gymInfo=[];
    if(w.duration) gymInfo.push('Durata: '+w.duration+' min');
    if(w.rpe) gymInfo.push('RPE: '+w.rpe);
    if(w._tonnage) gymInfo.push('Tonnellaggio: '+Math.round(w._tonnage)+' kg');
    if(w.avghr) gymInfo.push('FC Media: '+w.avghr+' bpm');
    if(w.maxhr) gymInfo.push('FC Max: '+w.maxhr+' bpm');
    if(w.calories) gymInfo.push('Calorie: '+Math.round(w.calories)+' kcal');
    if(w.mets) gymInfo.push('METs: '+w.mets);
    if(gymInfo.length) html+=`<p style="font-size:.85rem;color:var(--text2)">${gymInfo.join(' | ')}</p>`;
    (w.exercises||[]).forEach(ex=>{
      html+=`<div style="margin-top:10px"><strong style="font-size:.9rem">${ex.name}</strong> <span style="font-size:.75rem;color:var(--accent)">${ex.muscle||''}</span>`;
      html+='<table style="width:100%;font-size:.82rem;margin-top:4px;border-collapse:collapse"><tr style="color:var(--text2)"><td>Serie</td><td>Reps</td><td>Peso</td><td>RPE</td></tr>';
      ex.sets.forEach((s,i)=>{html+=`<tr><td>${i+1}</td><td>${s.reps}</td><td>${s.weight} kg</td><td>${s.rpe||'--'}</td></tr>`;});
      html+='</table></div>';
    });
  }
  if(w.type==='running') {
    let rd=[];
    if(w.distance) rd.push('Distanza: '+w.distance+' km');
    if(w.duration) rd.push('Durata: '+w.duration+' min');
    if(w._pace) rd.push('Pace: '+secondsToPace(w._pace)+'/km');
    html+='<p style="font-size:.85rem;color:var(--text2)">'+rd.join(' | ')+'</p>';
    let rd2=[];
    if(w.avghr) rd2.push('FC Media: '+w.avghr+' bpm');
    if(w.maxhr) rd2.push('FC Max: '+w.maxhr+' bpm');
    if(w.minhr) rd2.push('FC Min: '+w.minhr+' bpm');
    if(rd2.length) html+='<p style="font-size:.85rem;color:var(--text2)">'+rd2.join(' | ')+'</p>';
    let rd3=[];
    if(w.elevation) rd3.push('Dislivello: '+w.elevation+' m');
    if(w.calories) rd3.push('Calorie: '+Math.round(w.calories)+' kcal');
    if(w.steps) rd3.push('Passi: '+w.steps);
    if(w.rpe) rd3.push('RPE: '+w.rpe);
    if(w.mets) rd3.push('METs: '+w.mets);
    if(rd3.length) html+='<p style="font-size:.85rem;color:var(--text2)">'+rd3.join(' | ')+'</p>';
    let rd4=[];
    if(w.avgSpeed) rd4.push('Velocita: '+w.avgSpeed+' km/h');
    if(w.avgPower) rd4.push('Potenza: '+w.avgPower+' W');
    if(w.avgStride) rd4.push('Falcata: '+w.avgStride+' m');
    if(w.groundContact) rd4.push('Ground Contact: '+w.groundContact+' ms');
    if(w.vertOsc) rd4.push('Osc. Verticale: '+w.vertOsc+' cm');
    if(rd4.length) html+='<p style="font-size:.85rem;color:var(--text2)">'+rd4.join(' | ')+'</p>';
    if(w.avgCadence) rd4.push('Cadenza: '+w.avgCadence+' spm');
    if(rd4.length) html+='<p style="font-size:.85rem;color:var(--text2)">'+rd4.join(' | ')+'</p>';
    if(w.runType&&w.runType!=='easy') html+='<p style="font-size:.85rem;color:var(--text2)">Tipo: '+w.runType+'</p>';
    if(w.indoor) html+='<p style="font-size:.85rem;color:var(--text2)">Indoor</p>';
    // Splits table
    if(w.splits?.length){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Splits per km</h4>';
      html+='<table style="width:100%;font-size:.82rem;border-collapse:collapse"><tr style="color:var(--text2)"><td>Km</td><td>Pace</td></tr>';
      w.splits.forEach(s=>{html+=`<tr><td>${s.km}${s.partial?' (parziale)':''}</td><td>${secondsToPace(s.pace)}/km</td></tr>`;});
      html+='</table></div>';
    }
    // HR chart placeholder
    if(w.hrSeries?.length>2){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Frequenza Cardiaca</h4>';
      html+='<div style="height:160px"><canvas id="modal-hr-chart"></canvas></div></div>';
    }
    // Elevation chart placeholder
    if(w.eleSeries?.length>2){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Profilo Altimetrico</h4>';
      html+='<div style="height:140px"><canvas id="modal-ele-chart"></canvas></div></div>';
    }
  }
  else if(w.type==='karting') html+=`<p style="font-size:.85rem;color:var(--text2)">Circuito: ${w.track||'--'} | Durata: ${w.duration||'--'} min | Giri: ${w.laps||'--'}<br>Miglior Giro: ${w.bestLap||'--'}s | Giro Medio: ${w.avgLap||'--'}s | RPE: ${w.rpe||'--'}</p>`;
  else if (w.type !== 'gym') {
    // Smart generic detail: show ALL available fields, skip empty ones
    const allFields=[
      [w.distance,'Distanza',w.distance+' km'], [w.duration,'Durata',w.duration+' min'],
      [w._pace,'Pace',secondsToPace(w._pace)+'/km'],
      [w.avghr,'FC Media',w.avghr+' bpm'], [w.maxhr,'FC Max',w.maxhr+' bpm'], [w.minhr,'FC Min',w.minhr+' bpm'],
      [w.elevation,'Dislivello',w.elevation+' m'], [w.calories,'Calorie',Math.round(w.calories||0)+' kcal'],
      [w.rpe,'RPE',w.rpe], [w.mets,'METs',w.mets],
      [w.avgSpeed,'Velocita Media',w.avgSpeed+' km/h'], [w.avgPower,'Potenza',w.avgPower+' W'],
      [w.avgCadence,'Cadenza',w.avgCadence+' rpm'],
      [w.strokes,'Bracciate',w.strokes], [w.strokeStyle,'Stile',w.strokeStyle],
      [w.lapLength,'Vasca',w.lapLength+' m'], [w.steps,'Passi',w.steps],
      [w.rounds,'Round',w.rounds], [w.sets,'Set',w.sets],
    ];
    // Group into rows of 3
    const present=allFields.filter(([v])=>v);
    for(let i=0;i<present.length;i+=3){
      const row=present.slice(i,i+3).map(([,label,display])=>label+': '+display).join(' | ');
      html+='<p style="font-size:.85rem;color:var(--text2)">'+row+'</p>';
    }
    if(w.indoor) html+='<p style="font-size:.85rem;color:var(--text2)">Indoor</p>';
    // Splits and charts for non-running GPX imports too (walking, cycling, hiking)
    if(w.splits?.length){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Splits per km</h4>';
      html+='<table style="width:100%;font-size:.82rem;border-collapse:collapse"><tr style="color:var(--text2)"><td>Km</td><td>Pace</td></tr>';
      w.splits.forEach(s=>{html+=`<tr><td>${s.km}${s.partial?' (parziale)':''}</td><td>${secondsToPace(s.pace)}/km</td></tr>`;});
      html+='</table></div>';
    }
    if(w.hrSeries?.length>2){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Frequenza Cardiaca</h4>';
      html+='<div style="height:160px"><canvas id="modal-hr-chart"></canvas></div></div>';
    }
    if(w.eleSeries?.length>2){
      html+='<div style="margin-top:12px"><h4 style="font-size:.9rem;font-weight:600;margin-bottom:6px">Profilo Altimetrico</h4>';
      html+='<div style="height:140px"><canvas id="modal-ele-chart"></canvas></div></div>';
    }
  }
  if(w.notes) html+=`<p style="margin-top:10px;font-size:.85rem;font-style:italic;color:var(--text2)">"${w.notes}"</p>`;
  html+='</div><div id="modal-pubmed"></div>';
  document.getElementById('modal-body').innerHTML=html;

  // Render HR chart if data exists
  const hrCanvas=document.getElementById('modal-hr-chart');
  if(hrCanvas&&w.hrSeries?.length){
    new Chart(hrCanvas,{type:'line',data:{
      labels:w.hrSeries.map(p=>{const m=Math.floor(p.t/60);return m+'\'';} ),
      datasets:[{data:w.hrSeries.map(p=>p.hr),borderColor:'#e74c3c',backgroundColor:'rgba(231,76,60,.1)',fill:true,
        borderWidth:1.5,pointRadius:0,tension:.3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{display:true,ticks:{maxTicksLimit:8,font:{size:10},color:'#888'}},
          y:{display:true,ticks:{font:{size:10},color:'#888'},title:{display:true,text:'bpm',font:{size:10}}}}}});
  }
  // Render elevation chart if data exists
  const eleCanvas=document.getElementById('modal-ele-chart');
  if(eleCanvas&&w.eleSeries?.length){
    new Chart(eleCanvas,{type:'line',data:{
      labels:w.eleSeries.map(p=>{const m=Math.floor(p.t/60);return m+'\'';} ),
      datasets:[{data:w.eleSeries.map(p=>p.ele),borderColor:'#27ae60',backgroundColor:'rgba(39,174,96,.15)',fill:true,
        borderWidth:1.5,pointRadius:0,tension:.3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{display:true,ticks:{maxTicksLimit:8,font:{size:10},color:'#888'}},
          y:{display:true,ticks:{font:{size:10},color:'#888'},title:{display:true,text:'m',font:{size:10}}}}}});
  }

  document.getElementById('modal-delete-btn').onclick=async ()=>{
    if(confirm('Eliminare questo allenamento?')){
      await deleteWorkout(id);
      workoutsCache = workoutsCache.filter(w => w.id !== id);
      closeModal();
      toast('Allenamento eliminato');
      onDataChanged();
    }
  };
  document.getElementById('modal-edit-btn').onclick=(e)=>{ e.stopPropagation(); e.preventDefault(); editWorkout(id); };
  document.getElementById('modal-delete-btn').style.display='';
  document.getElementById('modal-edit-btn').style.display='';
  document.getElementById('workout-modal').classList.add('show');
  fetchPubMedForWorkout(w).then(articles=>{
    const el=document.getElementById('modal-pubmed');
    if(el) el.innerHTML=renderPubMedBox(articles);
  });
}

function closeModal(){document.getElementById('workout-modal').classList.remove('show');}

// Edit existing workout — inline in modal
let editingWorkoutId = null;

function editWorkout(id) {
  try {
  const w = workoutsCache.find(x => x.id === id);
  if (!w) { console.error('editWorkout: workout not found', id); return; }
  const tmpl = SPORT_TEMPLATES[w.type];
  const typeName = tmpl?.name || w.type;
  // Ensure modal stays open
  document.getElementById('workout-modal').classList.add('show');
  document.getElementById('modal-title').textContent = 'Modifica: ' + typeName;
  document.getElementById('modal-edit-btn').style.display = 'none';
  document.getElementById('modal-delete-btn').style.display = 'none';

  let html = '<div class="edit-workout-form">';

  // Date
  html += `<div class="form-group"><label>Data</label><input type="date" id="edit-w-date" value="${w.date}"></div>`;

  // Sport-specific fields
  if (w.type === 'gym') {
    html += `<div class="form-row">
      <div class="form-group"><label>Durata (min)</label><input type="number" id="edit-w-duration" value="${w.duration||''}"></div>
      <div class="form-group"><label>RPE (1-10)</label><input type="number" id="edit-w-rpe" min="1" max="10" value="${w.rpe||''}"></div>
    </div>`;
    // Exercises
    html += '<div class="card-title" style="margin-top:12px;font-size:.9rem">Esercizi</div>';
    (w.exercises || []).forEach((ex, ei) => {
      html += `<div class="edit-exercise" style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:.85rem">${ex.name} <span style="color:var(--accent);font-size:.75rem">${ex.muscle||''}</span></strong>
          <button class="btn-icon edit-remove-exercise" data-ei="${ei}" title="Rimuovi">&times;</button>
        </div>
        <table style="width:100%;font-size:.82rem;border-collapse:collapse">
          <tr style="color:var(--text2)"><td>Serie</td><td>Reps</td><td>Peso (kg)</td><td>RPE</td><td></td></tr>`;
      (ex.sets || []).forEach((s, si) => {
        html += `<tr>
          <td>${si + 1}</td>
          <td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="reps" value="${s.reps||0}" min="0" style="width:50px"></td>
          <td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="weight" value="${s.weight||0}" min="0" step="0.5" style="width:60px"></td>
          <td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="rpe" value="${s.rpe||''}" min="1" max="10" style="width:45px"></td>
          <td><button class="btn-icon edit-remove-set" data-ei="${ei}" data-si="${si}" title="Rimuovi serie">&times;</button></td>
        </tr>`;
      });
      html += `</table>
        <button class="btn btn-secondary btn-sm edit-add-set" data-ei="${ei}" style="margin-top:4px;font-size:.75rem">+ Serie</button>
      </div>`;
    });

    // Add exercise picker
    const lib = exercisesCache || [];
    const grouped = {};
    lib.forEach(e => { if (!grouped[e.muscle]) grouped[e.muscle] = []; grouped[e.muscle].push(e); });
    const muscleKeys = Object.keys(grouped).sort();

    html += `<div style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:10px">
      <div class="card-title" style="font-size:.85rem;margin-bottom:8px">Aggiungi Esercizio</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <div class="form-group" style="flex:1;min-width:180px;margin:0">
          <select id="edit-add-exercise-select" style="width:100%;padding:8px;border-radius:8px;background:var(--bg1);color:var(--text1);border:1px solid var(--bg3)">
            <option value="">Scegli esercizio...</option>
            ${muscleKeys.map(m => `<optgroup label="${m}">${grouped[m].map(e => `<option value="${e.name}" data-muscle="${e.muscle}">${e.name}</option>`).join('')}</optgroup>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-sm" id="edit-add-exercise-btn" style="white-space:nowrap">+ Esercizio</button>
      </div>
    </div>`;
  } else if (w.type === 'running') {
    html += `<div class="form-row">
      <div class="form-group"><label>Distanza (km)</label><input type="number" id="edit-w-distance" step="0.1" value="${w.distance||''}"></div>
      <div class="form-group"><label>Durata (min)</label><input type="number" id="edit-w-duration" value="${w.duration||''}"></div>
      <div class="form-group"><label>Pace (min/km)</label><input type="text" id="edit-w-pace" value="${w.paceInput||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>FC Media</label><input type="number" id="edit-w-avghr" value="${w.avghr||''}"></div>
      <div class="form-group"><label>FC Max</label><input type="number" id="edit-w-maxhr" value="${w.maxhr||''}"></div>
      <div class="form-group"><label>Dislivello (m)</label><input type="number" id="edit-w-elevation" value="${w.elevation||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tipo corsa</label>
        <select id="edit-w-runType">
          ${['easy','tempo','interval','long','recovery','race'].map(t=>`<option value="${t}" ${t===w.runType?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>RPE (1-10)</label><input type="number" id="edit-w-rpe" min="1" max="10" value="${w.rpe||''}"></div>
    </div>`;
  } else {
    // Generic sport fields from template
    if (tmpl && tmpl.fields) {
      html += '<div class="form-row" style="flex-wrap:wrap">';
      tmpl.fields.forEach(key => {
        const fd = FIELD_DEFS[key];
        if (!fd) return;
        const val = w[key] || '';
        if (fd.type === 'select' && fd.options) {
          html += `<div class="form-group"><label>${fd.label}</label><select id="edit-w-${key}">
            ${fd.options.map(o=>`<option value="${o}" ${o==val?'selected':''}>${o}</option>`).join('')}
          </select></div>`;
        } else {
          html += `<div class="form-group"><label>${fd.label}</label><input type="${fd.type||'number'}" id="edit-w-${key}" value="${val}" ${fd.step?'step="'+fd.step+'"':''} ${fd.min!==undefined?'min="'+fd.min+'"':''}></div>`;
        }
      });
      html += '</div>';
    }
  }

  // Notes
  html += `<div class="form-group" style="margin-top:12px"><label>Note</label><textarea id="edit-w-notes" rows="2" style="width:100%;border-radius:8px;padding:8px;background:var(--bg3);color:var(--text1);border:1px solid var(--bg3)">${w.notes||''}</textarea></div>`;

  // Save / Cancel buttons
  html += `<div style="display:flex;gap:8px;margin-top:16px">
    <button class="btn btn-primary" id="edit-w-save">Salva Modifiche</button>
    <button class="btn btn-secondary" id="edit-w-cancel">Annulla</button>
  </div></div>`;

  document.getElementById('modal-body').innerHTML = html;

  // Deep clone exercises for editing
  let editExercises = (w.exercises || []).map(ex => ({
    ...ex, sets: (ex.sets || []).map(s => ({ ...s }))
  }));

  // Wire up set inputs
  document.querySelectorAll('.edit-set-input').forEach(input => {
    input.addEventListener('change', () => {
      const ei = parseInt(input.dataset.ei), si = parseInt(input.dataset.si), field = input.dataset.field;
      const val = field === 'rpe' ? (parseInt(input.value) || null) : (parseFloat(input.value) || 0);
      if (editExercises[ei] && editExercises[ei].sets[si]) editExercises[ei].sets[si][field] = val;
    });
  });

  // Wire up add set buttons
  document.querySelectorAll('.edit-add-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.ei);
      if (editExercises[ei]) {
        editExercises[ei].sets.push({ reps: 0, weight: 0 });
        editWorkout(id); // re-render
      }
    });
  });

  // Wire up remove set buttons
  document.querySelectorAll('.edit-remove-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.ei), si = parseInt(btn.dataset.si);
      if (editExercises[ei] && editExercises[ei].sets.length > 1) {
        editExercises[ei].sets.splice(si, 1);
        // Update w temporarily so re-render picks up changes
        w.exercises = editExercises;
        editWorkout(id);
      }
    });
  });

  // Wire up remove exercise
  document.querySelectorAll('.edit-remove-exercise').forEach(btn => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.ei);
      if (confirm('Rimuovere ' + editExercises[ei]?.name + '?')) {
        editExercises.splice(ei, 1);
        w.exercises = editExercises;
        editWorkout(id);
      }
    });
  });

  // Wire up add exercise button (gym only)
  const addExBtn = document.getElementById('edit-add-exercise-btn');
  if (addExBtn) {
    addExBtn.addEventListener('click', () => {
      const sel = document.getElementById('edit-add-exercise-select');
      if (!sel || !sel.value) { toast('Seleziona un esercizio', 'error'); return; }
      const opt = sel.options[sel.selectedIndex];
      const newEx = { name: sel.value, muscle: opt.dataset.muscle || '', sets: [{ reps: 8, weight: 0 }] };
      editExercises.push(newEx);
      w.exercises = editExercises;
      editWorkout(id);
    });
  }

  // Cancel
  document.getElementById('edit-w-cancel').addEventListener('click', () => showWorkoutDetail(id));

  // Save
  document.getElementById('edit-w-save').addEventListener('click', async () => {
    const updated = { ...w };
    updated.date = document.getElementById('edit-w-date').value || w.date;
    updated.notes = document.getElementById('edit-w-notes').value || '';

    if (w.type === 'gym') {
      updated.duration = parseInt(document.getElementById('edit-w-duration')?.value) || w.duration;
      updated.rpe = parseInt(document.getElementById('edit-w-rpe')?.value) || w.rpe;
      // Read all set inputs fresh
      document.querySelectorAll('.edit-set-input').forEach(input => {
        const ei = parseInt(input.dataset.ei), si = parseInt(input.dataset.si), field = input.dataset.field;
        const val = field === 'rpe' ? (parseInt(input.value) || null) : (parseFloat(input.value) || 0);
        if (editExercises[ei] && editExercises[ei].sets[si]) editExercises[ei].sets[si][field] = val;
      });
      updated.exercises = editExercises;
      // Recalculate tonnage
      let t = 0;
      updated.exercises.forEach(ex => (ex.sets || []).forEach(s => t += (s.reps || 0) * (s.weight || 0)));
      updated._tonnage = t;
    } else if (w.type === 'running') {
      updated.distance = parseFloat(document.getElementById('edit-w-distance')?.value) || w.distance;
      updated.duration = parseInt(document.getElementById('edit-w-duration')?.value) || w.duration;
      updated.paceInput = document.getElementById('edit-w-pace')?.value || w.paceInput;
      updated._pace = paceToSeconds(updated.paceInput);
      updated.avghr = parseInt(document.getElementById('edit-w-avghr')?.value) || w.avghr;
      updated.maxhr = parseInt(document.getElementById('edit-w-maxhr')?.value) || w.maxhr;
      updated.elevation = parseInt(document.getElementById('edit-w-elevation')?.value) || w.elevation;
      updated.runType = document.getElementById('edit-w-runType')?.value || w.runType;
      updated.rpe = parseInt(document.getElementById('edit-w-rpe')?.value) || w.rpe;
    } else if (tmpl && tmpl.fields) {
      tmpl.fields.forEach(key => {
        const el = document.getElementById('edit-w-' + key);
        if (el) {
          const fd = FIELD_DEFS[key];
          updated[key] = fd?.type === 'number' || fd?.type === undefined ? (parseFloat(el.value) || null) : el.value;
        }
      });
    }

    // Recalculate scores
    updated.scores = scoreWorkout(updated, workoutsCache, settingsCache);
    updated.advice = getAdvice(updated);

    try {
      const { type, date, id: wId, data: _d, createdAt, updatedAt, userId, ...rest } = updated;
      await api.put('/api/workouts/' + id, { type, date, data: rest });
      // Update cache
      const idx = workoutsCache.findIndex(x => x.id === id);
      if (idx !== -1) workoutsCache[idx] = { ...workoutsCache[idx], ...updated };
      toast('Allenamento aggiornato!', 'success');
      showWorkoutDetail(id); // show updated detail
      onDataChanged();
    } catch (err) {
      toast('Errore: ' + (err.message || 'Salvataggio fallito'), 'error');
    }
  });
  } catch(err) {
    console.error('editWorkout error:', err);
    toast('Errore apertura editor: ' + err.message, 'error');
  }
}
window.editWorkout = editWorkout;

// ==================== PROGRESS ====================
function renderProgress() {
  renderProgressCharts(workoutsCache, settingsCache);
}

// ==================== WEIGHT ====================
function renderWeightPage() {
  document.getElementById('weight-date').value=todayStr();
  const weights=weightsCache;
  const statsEl=document.getElementById('weight-stats'), bmiEl=document.getElementById('weight-bmi-section');
  if(!weights.length){if(statsEl)statsEl.innerHTML='';if(bmiEl)bmiEl.innerHTML='';renderWeightChart(weightsCache,settingsCache);return;}
  const latest=weights[weights.length-1];
  const weekAgo=weights.filter(w=>daysBetween(todayStr(),w.date)>=6&&daysBetween(todayStr(),w.date)<=8);
  const monthAgo=weights.filter(w=>daysBetween(todayStr(),w.date)>=28&&daysBetween(todayStr(),w.date)<=32);
  const weekDiff=weekAgo.length?(latest.value-weekAgo[0].value).toFixed(1):'--';
  const monthDiff=monthAgo.length?(latest.value-monthAgo[0].value).toFixed(1):'--';
  if(statsEl) statsEl.innerHTML=`
    <div class="weight-stat"><div class="ws-value">${latest.value} kg</div><div class="ws-label">Peso attuale</div></div>
    <div class="weight-stat"><div class="ws-value" style="color:${weekDiff>0?'var(--red)':weekDiff<0?'var(--green)':'var(--text2)'}">${weekDiff!=='--'?(weekDiff>0?'+':'')+weekDiff:'--'}</div><div class="ws-label">vs settimana scorsa</div></div>
    <div class="weight-stat"><div class="ws-value" style="color:${monthDiff>0?'var(--red)':monthDiff<0?'var(--green)':'var(--text2)'}">${monthDiff!=='--'?(monthDiff>0?'+':'')+monthDiff:'--'}</div><div class="ws-label">vs mese scorso</div></div>`;
  const height=settingsCache.height||parseInt(document.getElementById('weight-height')?.value);
  if(height && bmiEl){
    const heightM=height/100, bmi=(latest.value/(heightM*heightM)).toFixed(1);
    let cat,cls;
    if(bmi<18.5){cat='Sottopeso';cls='bmi-underweight';}
    else if(bmi<25){cat='Normopeso';cls='bmi-normal';}
    else if(bmi<30){cat='Sovrappeso';cls='bmi-overweight';}
    else{cat='Obeso';cls='bmi-obese';}
    bmiEl.innerHTML=`<div style="margin-bottom:16px"><span class="bmi-badge ${cls}">BMI ${bmi} - ${cat}</span></div>`;
  } else if(bmiEl) bmiEl.innerHTML='<p style="font-size:.8rem;color:var(--text2);margin-bottom:12px">Inserisci l\'altezza per il BMI.</p>';
  renderWeightChart(weightsCache, settingsCache);
}

async function saveWeight() {
  const date=document.getElementById('weight-date').value||todayStr();
  const value=parseFloat(document.getElementById('weight-value').value);
  if(!value){toast('Inserisci il peso!','error');return;}
  const entry = {id:uid(),date,value};
  await api.post('/api/weights', entry);
  weightsCache.push(entry);
  weightsCache.sort((a,b) => new Date(a.date) - new Date(b.date));
  document.getElementById('weight-value').value='';
  toast('Peso registrato!','success');
  renderWeightPage();
}

async function saveWeightTarget(){
  const v=parseFloat(document.getElementById('weight-target').value);
  if(v){await saveSettingsToServer({...settingsCache,weightTarget:v});renderWeightChart(weightsCache,settingsCache);}
}

async function saveWeightHeight(){
  const v=parseInt(document.getElementById('weight-height').value);
  if(v){await saveSettingsToServer({...settingsCache,height:v});}
}

// ==================== PROFILE ====================
function renderProfile() {
  if(!currentUser) return;
  const avatarEl = document.getElementById('profile-avatar');
  if(avatarEl) avatarEl.src=currentUser.photoURL||'';
  document.getElementById('profile-name').textContent=currentUser.displayName||'Utente';
  document.getElementById('profile-email').textContent=currentUser.email||'';
  document.getElementById('profile-link').value=window.location.href;
  document.getElementById('profile-uid').value=currentUser.uid||'';
  // Show registration date from profile
  if(currentUser.createdAt) {
    document.getElementById('profile-since').textContent='Registrato dal '+formatDate(currentUser.createdAt);
  }
  renderFitnessAssessment();
}

function copyAppLink(){navigator.clipboard.writeText(window.location.href).then(()=>toast('Link copiato!')).catch(()=>toast('Errore copia','error'));}
function copyUID(){navigator.clipboard.writeText(currentUser?.uid||'').then(()=>toast('UID copiato!')).catch(()=>toast('Errore copia','error'));}

// ==================== FITNESS ASSESSMENT RENDERS ====================
function renderFitnessAssessment() {
  const fa = getFitnessAssessment(workoutsCache, settingsCache, weightsCache, muscleGroups);
  const el = document.getElementById('fitness-assessment');
  if (!el) return;
  let html = `<div class="fitness-card">
    <div class="fitness-score" style="color:${fa.levelColor}">${fa.score}%</div>
    <div class="fitness-label" style="color:${fa.levelColor}">${fa.level}</div>
    <div class="fitness-detail">Valutazione basata su forza, cardio, endurance, composizione corporea, flessibilita e atleticita</div>
    <div class="fitness-bars">`;
  fa.details.forEach(d => {
    html += `<div class="fitness-bar-row"><span class="fb-label">${d.label}</span><div class="fb-track"><div class="fb-fill" style="width:${d.pct}%;background:${d.color}"></div></div><span style="font-size:.75rem;width:80px;text-align:right;color:var(--text2)">${d.value}</span></div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

function renderAthleticFitnessAssessment() {
  const fa = getFitnessAssessment(workoutsCache, settingsCache, weightsCache, muscleGroups);
  const el = document.getElementById('athletic-fitness-assessment');
  if (!el) return;
  let html = `<div class="fitness-card">
    <div class="fitness-score" style="color:${fa.levelColor}">${fa.score}%</div>
    <div class="fitness-label" style="color:${fa.levelColor}">${fa.level}</div>
    <div class="fitness-bars" style="margin-top:16px">`;
  fa.details.forEach(d => {
    html += `<div class="fitness-bar-row"><span class="fb-label">${d.label}</span><div class="fb-track"><div class="fb-fill" style="width:${d.pct}%;background:${d.color}"></div></div><span style="font-size:.75rem;width:80px;text-align:right;color:var(--text2)">${d.value}</span></div>
    <div style="font-size:.78rem;color:var(--text2);margin-left:90px;margin-bottom:8px">${d.sublabel||''}</div>`;
  });
  html += `</div></div>
  <div class="advice-box" style="margin-top:12px">
    <strong>Calcolati automaticamente:</strong> Forza (1RM e carichi), Cardio (pace e FC), Endurance (consistenza e km), Atleticita (varieta sport).<br>
    <strong>Da inserire manualmente:</strong> VO2 Max, FC Riposo, Peso, Altezza, Flessibilita (in Impostazioni).
  </div>`;
  el.innerHTML = html;
}

// ==================== ATHLETIC DETAIL ====================
function renderAthleticDetail() {
  const workouts=[...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const now=todayStr();
  const last30=workouts.filter(w=>daysBetween(now,w.date)<=30);
  const gymW=last30.filter(w=>w.type==='gym'),runW=last30.filter(w=>w.type==='running');
  const forza=gymW.length?Math.min(10,gymW.reduce((s,w)=>s+(w.scores?.volume||5),0)/gymW.length):3;
  const totalKm=runW.reduce((s,w)=>s+(w.distance||0),0);
  const resistenza=Math.min(10,Math.max(2,totalKm/5));
  const uniqueDays=new Set(last30.map(w=>w.date)).size;
  const consistenza=Math.min(10,Math.max(2,uniqueDays/3));
  const highRPE=last30.filter(w=>(w.rpe||w.scores?.overall||5)>=8).length;
  const recupero=Math.max(3,10-highRPE);
  const progressione=gymW.length?gymW.reduce((s,w)=>s+(w.scores?.progression||5),0)/gymW.length:5;
  const muscleSet=new Set();
  gymW.forEach(w=>(w.exercises||[]).forEach(e=>{if(e.muscle)muscleSet.add(e.muscle);}));
  const typesUsed=new Set(last30.map(w=>w.type)).size;
  const varieta=Math.min(10,Math.max(2,muscleSet.size+typesUsed*2));

  // Proporzioni corporee (dalle circonferenze in settings)
  const circ = {
    chest: settingsCache.circChest, waist: settingsCache.circWaist, hips: settingsCache.circHips,
    bicep: settingsCache.circBicep, thigh: settingsCache.circThigh, calf: settingsCache.circCalf,
    neck: settingsCache.circNeck, shoulders: settingsCache.circShoulders
  };
  const circCount = Object.values(circ).filter(v => v && v > 0).length;
  let proporzioni = 5; // default
  let circDesc = 'Inserisci le circonferenze corporee nelle Impostazioni per una valutazione completa.';
  if (circCount >= 3) {
    let circScore = 5;
    if (circ.waist && circ.hips) {
      const whr = circ.waist / circ.hips;
      const isMale = settingsCache.gender !== 'F';
      const idealWHR = isMale ? 0.9 : 0.8;
      circScore += whr <= idealWHR ? 2 : (whr <= idealWHR + 0.1 ? 1 : -1);
    }
    if (circ.shoulders && circ.waist) {
      const swr = circ.shoulders / circ.waist;
      circScore += swr >= 1.6 ? 2 : (swr >= 1.4 ? 1 : 0);
    }
    if (circ.bicep) circScore += circ.bicep >= 35 ? 1 : 0;
    proporzioni = Math.min(10, Math.max(2, circScore));
    const parts = [];
    if (circ.waist && circ.hips) parts.push(`WHR: ${(circ.waist/circ.hips).toFixed(2)}`);
    if (circ.shoulders && circ.waist) parts.push(`Spalle/Vita: ${(circ.shoulders/circ.waist).toFixed(2)}`);
    parts.push(`${circCount} misurazioni inserite`);
    circDesc = parts.join(' | ') + '. ' + (proporzioni >= 7 ? 'Ottime proporzioni atletiche!' : 'Continua a lavorare sulle proporzioni.');
  }

  destroyChart('radarDetail');
  const ctx=document.getElementById('chart-radar-detail')?.getContext('2d');
  if(ctx){
    const isLight=!window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor=isLight?'#1D1D1F':'#F5F5F7';
    const gridColor=isLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)';
    storeChart('radarDetail', new Chart(ctx,{type:'radar',
      data:{labels:['Forza','Resistenza','Consistenza','Recupero','Progressione','Varieta','Proporzioni'],
        datasets:[{label:'Profilo',data:[forza,resistenza,consistenza,recupero,progressione,varieta,proporzioni].map(v=>Math.round(v*10)/10),
          backgroundColor:'rgba(224,32,32,0.15)',borderColor:'#E02020',pointBackgroundColor:'#E02020',pointBorderColor:'#fff',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:10,ticks:{stepSize:2,color:textColor,backdropColor:'transparent'},grid:{color:gridColor},pointLabels:{color:textColor,font:{size:13,family:'Poppins'}}}},plugins:{legend:{display:false}}}
    }));
  }

  const metrics=[
    {label:'Forza',value:forza,icon:'\u{1F4AA}',desc:gymW.length?`Basato sul volume medio di ${gymW.length} sessioni palestra negli ultimi 30 giorni. Tonnellaggio medio: ${Math.round(gymW.reduce((s,w)=>s+(w._tonnage||0),0)/gymW.length)} kg.`:'Nessuna sessione palestra negli ultimi 30 giorni.'},
    {label:'Resistenza',value:resistenza,icon:'\u{1FAC0}',desc:`${totalKm.toFixed(1)} km totali corsi negli ultimi 30 giorni.${runW.length?' Media '+Math.round(totalKm/runW.length*10)/10+' km/sessione.':''}`},
    {label:'Consistenza',value:consistenza,icon:'\u{1F4C5}',desc:`${uniqueDays} giorni di allenamento su 30. ${uniqueDays>=15?'Ottima costanza!':uniqueDays>=8?'Buona regolarita.':'Prova ad allenarti piu spesso.'}`},
    {label:'Recupero',value:recupero,icon:'\u{1F50B}',desc:`${highRPE} sessioni ad alta intensita (RPE >= 8) negli ultimi 30 giorni. ${recupero>=7?'Buon equilibrio intensita/recupero.':'Attenzione al sovrallenamento.'}`},
    {label:'Progressione',value:progressione,icon:'\u{1F4C8}',desc:gymW.length?`Score medio di progressione carichi: ${progressione.toFixed(1)}/10. ${progressione>=7?'Stai migliorando costantemente!':'Prova a incrementare gradualmente i carichi.'}`:'Serve almeno una sessione palestra.'},
    {label:'Varieta',value:varieta,icon:'\u{1F3AF}',desc:`${muscleSet.size} gruppi muscolari allenati, ${typesUsed} sport diversi praticati. ${varieta>=7?'Allenamento ben bilanciato!':'Prova a variare di piu gli stimoli.'}`},
    {label:'Proporzioni',value:proporzioni,icon:'\u{1F4D0}',desc:circDesc}
  ];

  const cardsEl = document.getElementById('athletic-detail-cards');
  if(cardsEl) cardsEl.innerHTML=metrics.map(m=>`
    <div class="card athletic-metric-card">
      <div style="font-size:1.5rem;margin-bottom:4px">${m.icon}</div>
      <div class="athletic-metric-value" style="color:${scoreColor(m.value)}">${m.value.toFixed(1)}</div>
      <div class="athletic-metric-label">${m.label}</div>
      <div class="athletic-metric-desc">${m.desc}</div>
    </div>`).join('');

  renderAthleticFitnessAssessment();
}

// ==================== EXERCISE LIBRARY ====================
function renderExerciseLibrary(){
  const lib=exercisesCache||[];
  const container=document.getElementById('exercise-library-list');if(!container)return;
  const filterEl=document.getElementById('lib-filter');
  const q=filterEl?filterEl.value.toLowerCase():'';
  const activeFilter=document.querySelector('.lib-filter-btn.active');
  const muscleFilter=activeFilter?activeFilter.dataset.muscle:'';
  let filtered=lib;
  if(q) filtered=filtered.filter(e=>e.name.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q));
  if(muscleFilter) filtered=filtered.filter(e=>e.muscle===muscleFilter);
  const filtersEl=document.getElementById('lib-muscle-filters');
  if(filtersEl){
    const muscles=[...new Set(lib.map(e=>e.muscle))].sort();
    filtersEl.innerHTML=`<button class="lib-filter-btn ${!muscleFilter?'active':''}" data-muscle="">Tutti (${lib.length})</button>`+
      muscles.map(m=>{
        const count=lib.filter(e=>e.muscle===m).length;
        return`<button class="lib-filter-btn ${muscleFilter===m?'active':''}" data-muscle="${m}">${m} (${count})</button>`;
      }).join('');
    filtersEl.querySelectorAll('.lib-filter-btn').forEach(btn => {
      btn.addEventListener('click', function() { setLibMuscleFilter(this.dataset.muscle, this); });
    });
  }
  const paramLabels={reps:'Ripetizioni',duration:'Durata (sec)',distance:'Distanza (m)',calories:'Calorie'};
  const paramIcons={reps:'',duration:'&#9201;',distance:'&#8644;',calories:'&#128293;'};

  // Group by muscle
  const grouped={};
  filtered.forEach(e=>{
    if(!grouped[e.muscle]) grouped[e.muscle]=[];
    grouped[e.muscle].push(e);
  });

  let html='';
  if(!filtered.length){
    html='<p style="color:var(--text2);font-size:.85rem">Nessun esercizio trovato.</p>';
  } else {
    const muscleKeys=Object.keys(grouped).sort();
    muscleKeys.forEach(muscle=>{
      html+=`<div class="lib-group"><div class="lib-group-header"><span class="muscle-tag">${muscle}</span> <span style="font-size:.75rem;color:var(--text2)">${grouped[muscle].length} esercizi</span></div>`;
      grouped[muscle].sort((a,b)=>a.name.localeCompare(b.name)).forEach(e=>{
        const origIdx=lib.indexOf(e);
        const paramTag=e.param&&e.param!=='reps'?`<span class="param-tag">${paramIcons[e.param]||''} ${paramLabels[e.param]||e.param}</span>`:'';
        html+=`<div class="lib-item">
          <span class="lib-item-name">${e.name} ${paramTag}</span>
          <div class="lib-item-actions">
            <button class="btn-icon" data-edit-lib="${origIdx}" title="Modifica">&#9998;</button>
            <button class="btn-icon" data-dup-lib="${origIdx}" title="Duplica">&#10697;</button>
            <button class="btn-icon" data-remove-lib="${origIdx}" title="Elimina">&times;</button>
          </div>
        </div>`;
      });
      html+=`</div>`;
    });
  }
  container.innerHTML=html;

  // Wire up action buttons
  container.querySelectorAll('[data-remove-lib]').forEach(btn => {
    btn.addEventListener('click', () => removeExercise(parseInt(btn.dataset.removeLib)));
  });
  container.querySelectorAll('[data-dup-lib]').forEach(btn => {
    btn.addEventListener('click', () => duplicateExercise(parseInt(btn.dataset.dupLib)));
  });
  container.querySelectorAll('[data-edit-lib]').forEach(btn => {
    btn.addEventListener('click', () => editExercise(parseInt(btn.dataset.editLib)));
  });
}

function setLibMuscleFilter(muscle,btn){
  document.querySelectorAll('.lib-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderExerciseLibrary();
}

async function addExerciseToLibrary(){
  const name=document.getElementById('lib-name').value.trim(),muscle=document.getElementById('lib-muscle').value;
  const param=document.getElementById('lib-param')?.value||'reps';
  if(!name){toast('Inserisci un nome!','error');return;}
  const lib=exercisesCache||[];
  if(lib.some(e=>e.name.toLowerCase()===name.toLowerCase())){toast('Esercizio gia presente!','error');return;}
  lib.push({name,muscle,param});lib.sort((a,b)=>a.name.localeCompare(b.name));
  await saveExercisesToServer(lib);document.getElementById('lib-name').value='';toast('Esercizio aggiunto!','success');
  renderExerciseLibrary();
}

async function removeExercise(idx){
  if(!confirm('Eliminare questo esercizio?')) return;
  const lib=[...(exercisesCache||[])];lib.splice(idx,1);
  await saveExercisesToServer(lib);
  renderExerciseLibrary();
}

async function duplicateExercise(idx){
  const lib=[...(exercisesCache||[])];
  const orig=lib[idx];if(!orig)return;
  const copy={...orig, name:orig.name+' (copia)'};
  lib.push(copy);lib.sort((a,b)=>a.name.localeCompare(b.name));
  await saveExercisesToServer(lib);
  toast('Esercizio duplicato!','success');
  renderExerciseLibrary();
}

function editExercise(idx){
  const lib=exercisesCache||[];
  const ex=lib[idx];if(!ex)return;
  const paramLabels={reps:'Ripetizioni',duration:'Durata (sec)',distance:'Distanza (m)',calories:'Calorie'};
  const modal=document.getElementById('workout-modal');
  document.getElementById('modal-title').textContent='Modifica Esercizio';
  let html=`<div style="display:flex;flex-direction:column;gap:12px">
    <div class="form-group"><label>Nome</label><input type="text" id="edit-ex-name" value="${ex.name}"></div>
    <div class="form-group"><label>Gruppo Muscolare</label><select id="edit-ex-muscle">
      ${muscleGroups.map(m=>`<option value="${m}" ${m===ex.muscle?'selected':''}>${m}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Parametro principale</label><select id="edit-ex-param">
      ${Object.entries(paramLabels).map(([k,v])=>`<option value="${k}" ${k===(ex.param||'reps')?'selected':''}>${v}</option>`).join('')}
    </select></div>
    <button class="btn btn-primary" id="edit-ex-save">Salva Modifiche</button>
  </div>`;
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-delete-btn').style.display='none';
  modal.classList.add('show');
  document.getElementById('edit-ex-save').addEventListener('click', async ()=>{
    const newName=document.getElementById('edit-ex-name').value.trim();
    if(!newName){toast('Inserisci un nome!','error');return;}
    lib[idx]={name:newName, muscle:document.getElementById('edit-ex-muscle').value, param:document.getElementById('edit-ex-param').value};
    await saveExercisesToServer(lib);
    toast('Esercizio modificato!','success');
    closeModal();
    document.getElementById('modal-delete-btn').style.display='';
    renderExerciseLibrary();
  });
}
window.duplicateExercise = duplicateExercise;
window.editExercise = editExercise;

// ==================== SETTINGS ====================
async function saveSettings(){
  const s={
    maxhr:parseInt(document.getElementById('set-maxhr').value)||null,
    resthr:parseInt(document.getElementById('set-resthr').value)||null,
    bodyweight:parseFloat(document.getElementById('set-bodyweight').value)||null,
    height:parseInt(document.getElementById('set-height').value)||null,
    vo2max:parseFloat(document.getElementById('set-vo2max').value)||null,
    age:parseInt(document.getElementById('set-age').value)||null,
    gender:document.getElementById('set-gender').value||null,
    weekgoal:parseInt(document.getElementById('set-weekgoal').value)||4,
    kmgoal:parseInt(document.getElementById('set-kmgoal').value)||null,
    flexibility:parseInt(document.getElementById('set-flexibility')?.value)||5,
    // Circonferenze corporee (cm)
    circChest:parseFloat(document.getElementById('set-circ-chest')?.value)||null,
    circWaist:parseFloat(document.getElementById('set-circ-waist')?.value)||null,
    circHips:parseFloat(document.getElementById('set-circ-hips')?.value)||null,
    circBicep:parseFloat(document.getElementById('set-circ-bicep')?.value)||null,
    circThigh:parseFloat(document.getElementById('set-circ-thigh')?.value)||null,
    circCalf:parseFloat(document.getElementById('set-circ-calf')?.value)||null,
    circNeck:parseFloat(document.getElementById('set-circ-neck')?.value)||null,
    circShoulders:parseFloat(document.getElementById('set-circ-shoulders')?.value)||null,
    activeSports: activeSports,
    muscleGroups: muscleGroups
  };
  await saveSettingsToServer(s);
  toast('Impostazioni salvate!', 'success');
}

function populateSettingsUI(){
  const s=settingsCache;
  const setVal = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
  setVal('set-maxhr', s.maxhr);
  setVal('set-resthr', s.resthr);
  setVal('set-bodyweight', s.bodyweight);
  setVal('set-height', s.height);
  if(s.height) setVal('weight-height', s.height);
  setVal('set-vo2max', s.vo2max);
  setVal('set-age', s.age);
  setVal('set-gender', s.gender);
  setVal('set-weekgoal', s.weekgoal);
  setVal('set-kmgoal', s.kmgoal);
  setVal('set-flexibility', s.flexibility);
  // Circonferenze
  setVal('set-circ-chest', s.circChest);
  setVal('set-circ-waist', s.circWaist);
  setVal('set-circ-hips', s.circHips);
  setVal('set-circ-bicep', s.circBicep);
  setVal('set-circ-thigh', s.circThigh);
  setVal('set-circ-calf', s.circCalf);
  setVal('set-circ-neck', s.circNeck);
  setVal('set-circ-shoulders', s.circShoulders);
  if(s.activeSports) activeSports = s.activeSports;
  if(s.muscleGroups) muscleGroups = s.muscleGroups;
  populateMuscleSelect();
}

function populateMuscleSelect() {
  const sel = document.getElementById('lib-muscle');
  if (!sel) return;
  sel.innerHTML = muscleGroups.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ==================== SPORTS MANAGER ====================
function renderSportsManager() {
  const activeEl = document.getElementById('active-sports-list');
  if(activeEl) activeEl.innerHTML = activeSports.map(key => {
    const s = SPORT_TEMPLATES[key];
    if (!s) return '';
    const isFixed = s.fixed;
    return `<span class="sport-chip active">${s.icon} ${s.name}${isFixed?'':`<span class="remove-sport" data-remove-sport="${key}">&times;</span>`}</span>`;
  }).join('');
  activeEl?.querySelectorAll('[data-remove-sport]').forEach(btn => {
    btn.addEventListener('click', () => removeSport(btn.dataset.removeSport));
  });

  const poolEl = document.getElementById('available-sports-pool');
  const available = Object.keys(SPORT_TEMPLATES).filter(k => !activeSports.includes(k));
  if(poolEl) poolEl.innerHTML = available.map(key => {
    const s = SPORT_TEMPLATES[key];
    return `<span class="sport-chip" data-add-sport="${key}">${s.icon} ${s.name}</span>`;
  }).join('');
  poolEl?.querySelectorAll('[data-add-sport]').forEach(btn => {
    btn.addEventListener('click', () => addSport(btn.dataset.addSport));
  });
}

function addSport(key) {
  if (!activeSports.includes(key)) {
    activeSports.push(key);
    saveSettings();
    renderSportsManager();
  }
}

function removeSport(key) {
  const tmpl = SPORT_TEMPLATES[key];
  if (tmpl?.fixed) return;
  activeSports = activeSports.filter(s => s !== key);
  saveSettings();
  renderSportsManager();
}

// ==================== MUSCLE GROUPS MANAGER ====================
function renderMuscleGroupsManager() {
  const el = document.getElementById('muscle-groups-list');
  if(!el) return;
  el.innerHTML = muscleGroups.map(m => {
    const isDefault = DEFAULT_MUSCLES.includes(m);
    return `<span class="muscle-chip">${m}${isDefault?'':`<span class="remove-muscle" data-remove-muscle="${m}">&times;</span>`}</span>`;
  }).join('');
  el.querySelectorAll('[data-remove-muscle]').forEach(btn => {
    btn.addEventListener('click', () => removeMuscleGroup(btn.dataset.removeMuscle));
  });
  populateMuscleSelect();
}

function addMuscleGroup() {
  const input = document.getElementById('new-muscle-group');
  const name = input.value.trim();
  if (!name) { toast('Inserisci un nome!', 'error'); return; }
  if (muscleGroups.includes(name)) { toast('Gruppo gia presente!', 'error'); return; }
  muscleGroups.push(name);
  input.value = '';
  saveSettings();
  renderMuscleGroupsManager();
  toast('Gruppo aggiunto!', 'success');
}

function removeMuscleGroup(name) {
  if (DEFAULT_MUSCLES.includes(name)) return;
  muscleGroups = muscleGroups.filter(m => m !== name);
  saveSettings();
  renderMuscleGroupsManager();
}

// ==================== NOTIFICATIONS ====================
function renderNotifications() {
  // In the API-based architecture, notifications can come from the server
  // For now, render an empty state or fetch from API if available
  const el = document.getElementById('notifications-list');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text2);font-size:.85rem">Nessuna notifica.</p>';
}

// ==================== FRIENDS (local wrapper) ====================
function renderFriendsPageLocal() {
  // Set myStats for compare feature
  const now = todayStr();
  const myL7 = workoutsCache.filter(w => daysBetween(now, w.date) <= 7);
  window._friendsMyStats = {
    avgScore: workoutsCache.length ? workoutsCache.reduce((s,w) => s + (w.scores?.overall||0), 0) / workoutsCache.length : 0,
    weekWorkouts: myL7.length,
    weekKm: myL7.filter(w => w.type === 'running').reduce((s,w) => s + (w.distance||0), 0),
    weekTonnage: myL7.filter(w => w.type === 'gym').reduce((s,w) => s + (w._tonnage||0), 0),
    totalWorkouts: workoutsCache.length
  };
  renderFriendsPageModule({ followingCache, workoutsCache, currentUser });
}

// ==================== INIT APP ====================
function initApp() {
  const wizDateEl = document.getElementById('wiz-date');
  if(wizDateEl) wizDateEl.value = todayStr();
  const weightDateEl = document.getElementById('weight-date');
  if(weightDateEl) weightDateEl.value = todayStr();
  updateSyncStatus();
  renderDashboard();
  liveCheckDraft();
}

// ==================== BACKWARD COMPATIBILITY (window.*) ====================
// Expose key functions on window for any remaining inline onclick handlers
window.showPage = showPage;
window.showWorkoutDetail = showWorkoutDetail;
window.filterHistory = filterHistory;
window.selectWorkoutType = selectWorkoutType;
window.wizGoStep = wizGoStep;
window.wizGoBack = wizGoBack;
window.wizSaveWorkout = wizSaveWorkout;
window.openExerciseSheet = openExerciseSheet;
window.closeExerciseSheet = closeExerciseSheet;
window.filterExerciseSheet = filterExerciseSheet;
window.addWizExercise = addWizExercise;
window.removeWizExercise = removeWizExercise;
window.wizUpdateSet = wizUpdateSet;
window.wizAddSet = wizAddSet;
window.wizRemoveSet = wizRemoveSet;
window.wizCopyLastSets = wizCopyLastSets;
window.closeModal = closeModal;
window.saveWeight = saveWeight;
window.saveWeightTarget = saveWeightTarget;
window.saveWeightHeight = saveWeightHeight;
window.saveSettings = saveSettings;
window.addSport = addSport;
window.removeSport = removeSport;
window.addMuscleGroup = addMuscleGroup;
window.removeMuscleGroup = removeMuscleGroup;
window.addExerciseToLibrary = addExerciseToLibrary;
window.removeExercise = removeExercise;
window.setLibMuscleFilter = setLibMuscleFilter;
window.copyAppLink = copyAppLink;
window.copyUID = copyUID;
window.signOut = async () => { await logout(); showScreen('login'); setupLoginUI(); };
window.searchUsers = searchUsersAPI;
window.addFriendByUID = () => { const input = document.getElementById('friend-uid-input'); addFriendByUID(input?.value?.trim()); };
window.toggleFollow = toggleFollow;
window.compareSelected = () => compareSelected(Object.values(followingCache));
window.updateORMChart = updateORMChart;
window.handleGPXFiles = (files) => handleGPXFiles(files, { workoutsCache, settingsCache, onImported: () => loadAllData() });
window.handleCSVFile = (file) => handleCSVFile(file, exercisesCache, { workoutsCache, settingsCache, onImported: () => loadAllData() });
window.handleAppleHealthFile = (file) => handleAppleHealthFile(file, { workoutsCache, settingsCache, onImported: () => loadAllData() });
window.handleFITFile = (file) => handleFITFile(file, { workoutsCache, settingsCache, onImported: () => loadAllData() });
window.confirmCSVImport = () => confirmCSVImport(window._csvImportData, workoutsCache, settingsCache);
window.importHealthWorkouts = () => importHealthWorkouts(window._healthImportData, workoutsCache, settingsCache);
window.exportAllData = () => exportAllData({ workoutsCache, settingsCache, exercisesCache, weightsCache });
window.importJSONBackup = (file) => importJSONBackup(file, { onImported: () => loadAllData() });
window.markNotifRead = () => {}; // placeholder - notifications handled server-side

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  // Navigation: click on nav buttons and any element with data-page
  document.querySelectorAll('.nav-btn[data-page], [data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) showPage(page);
    });
  });

  // Make nav-user clickable → go to profile
  const navUser = document.getElementById('nav-user');
  if (navUser) {
    navUser.style.cursor = 'pointer';
    navUser.addEventListener('click', () => showPage('profile'));
  }

  // data-action buttons — universal delegated handler
  const actionMap = {
    signOut: () => logout().then(() => { showScreen('login'); setupLoginUI(); }),
    exportAllData: () => window.exportAllData(),
    triggerImportJSON: () => document.getElementById('import-json')?.click(),
    openExerciseSheet: () => openExerciseSheet(addWizExercise),
    closeExerciseSheet: () => closeExerciseSheet(),
    wizGoStep3: () => wizGoStep(3),
    wizGoStep4: () => wizGoStep(4),
    wizSaveWorkout: () => wizSaveWorkout(),
    wizGoBack: () => wizGoBack(),
    saveWeight: () => saveWeight(),
    addExerciseToLibrary: () => addExerciseToLibrary(),
    addMuscleGroup: () => addMuscleGroup(),
    copyAppLink: () => copyAppLink(),
    copyUID: () => copyUID(),
    addFriendByUID: () => window.addFriendByUID(),
    compareSelected: () => window.compareSelected(),
    closeModal: () => closeModal(),
    saveSettings: () => saveSettings(),
    deleteAllWorkouts: async () => {
      if (!confirm('Sei sicuro? Verranno eliminati TUTTI gli allenamenti.')) return;
      try {
        const res = await api.del('/api/workouts');
        workoutsCache = [];
        toast('Eliminati ' + (res?.deleted || 'tutti gli') + ' allenamenti', 'success');
        onDataChanged();
      } catch (err) { toast('Errore: ' + err.message, 'error'); }
    },
    toggleSelectMode: () => toggleSelectMode(),
    selectAll: () => selectAllVisible(),
    deselectAll: () => deselectAll(),
    deleteSelected: () => deleteSelected(),
    // Live workout actions
    liveStart: () => liveStart(),
    livePauseResume: () => livePauseResume(),
    liveFinishPrompt: () => liveFinishPrompt(),
    liveBackToSession: () => liveBackToSession(),
    liveSaveWorkout: () => liveSaveWorkout(),
    liveOpenSheet: () => liveOpenSheet(),
    liveRestDismiss: () => liveRestDismiss(),
    liveResumeDraft: () => liveResumeDraft(),
    liveDiscardDraft: () => liveDiscardDraft(),
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    // Special handling for rest adjust (needs data-adj parameter)
    if (btn.dataset.action === 'liveRestAdjust') {
      liveRestAdjust(parseInt(btn.dataset.adj) || 0);
      return;
    }
    const handler = actionMap[btn.dataset.action];
    if (handler) handler();
  });

  // Import JSON file input
  const importJsonInput = document.getElementById('import-json');
  if (importJsonInput) {
    importJsonInput.addEventListener('change', (e) => {
      if (e.target.files[0]) window.importJSONBackup(e.target.files[0]);
    });
  }

  // Settings auto-save on change
  document.querySelectorAll('[data-settings]').forEach(input => {
    input.addEventListener('change', () => saveSettings());
  });

  // Weight target and height inputs (save on change)
  const weightTarget = document.getElementById('weight-target');
  if (weightTarget) weightTarget.addEventListener('change', () => saveWeightTarget());
  const weightHeight = document.getElementById('weight-height');
  if (weightHeight) weightHeight.addEventListener('change', () => saveWeightHeight());

  // Modal close on outside click
  const modal = document.getElementById('workout-modal');
  if (modal) modal.addEventListener('click', function(e) { if(e.target===this) closeModal(); });

  // Workout items (delegated click on dashboard, history)
  document.addEventListener('click', (e) => {
    const workoutItem = e.target.closest('[data-workout-id]');
    if (!workoutItem) return;
    if (_selectMode) {
      toggleWorkoutSelection(workoutItem.dataset.workoutId);
    } else {
      showWorkoutDetail(workoutItem.dataset.workoutId);
    }
  });

  // Drag & Drop zones
  ['gpx-drop','csv-drop','health-drop','fit-drop'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover');});
    el.addEventListener('dragleave',()=>el.classList.remove('dragover'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');
      if(id==='gpx-drop') window.handleGPXFiles(e.dataTransfer.files);
      else if(id==='csv-drop') window.handleCSVFile(e.dataTransfer.files[0]);
      else if(id==='health-drop') window.handleAppleHealthFile(e.dataTransfer.files[0]);
      else if(id==='fit-drop') window.handleFITFile(e.dataTransfer.files[0]);
    });
  });

  // File inputs (HTML IDs: gpx-file, csv-file, health-file, fit-file)
  const gpxInput = document.getElementById('gpx-file') || document.getElementById('gpx-input');
  if(gpxInput) gpxInput.addEventListener('change', (e) => window.handleGPXFiles(e.target.files));

  const csvInput = document.getElementById('csv-file') || document.getElementById('csv-input');
  if(csvInput) csvInput.addEventListener('change', (e) => window.handleCSVFile(e.target.files[0]));

  const healthInput = document.getElementById('health-file') || document.getElementById('health-input');
  if(healthInput) healthInput.addEventListener('change', (e) => window.handleAppleHealthFile(e.target.files[0]));

  const fitInput = document.getElementById('fit-file') || document.getElementById('fit-input');
  if(fitInput) fitInput.addEventListener('change', (e) => window.handleFITFile(e.target.files[0]));

  const jsonInput = document.getElementById('json-input');
  if(jsonInput) jsonInput.addEventListener('change', (e) => window.importJSONBackup(e.target.files[0]));

  // Drop zones: click to open file picker
  const dropFileMap = { 'gpx-drop': 'gpx-file', 'csv-drop': 'csv-file', 'health-drop': 'health-file', 'fit-drop': 'fit-file' };
  Object.entries(dropFileMap).forEach(([dropId, fileId]) => {
    const dropEl = document.getElementById(dropId);
    if (dropEl) dropEl.addEventListener('click', () => document.getElementById(fileId)?.click());
  });

  // Close search results on click outside
  document.addEventListener('click', e => {
    const searchResults = document.getElementById('friend-search-results');
    const searchInput = document.getElementById('friend-search');
    if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.className = 'search-results';
    }
  });

  // Friend search input
  const friendSearch = document.getElementById('friend-search');
  if(friendSearch) friendSearch.addEventListener('input', (e) => searchUsersAPI(e.target.value));

  // Exercise library filter
  const libFilter = document.getElementById('lib-filter');
  if(libFilter) libFilter.addEventListener('input', () => renderExerciseLibrary());

  // Exercise search in sheet
  const exSearch = document.getElementById('exercise-search');
  if(exSearch) exSearch.addEventListener('input', filterExerciseSheet);
});

// ==================== BOOT ====================
initAuth(
  async (user) => {
    currentUser = user;
    document.getElementById('nav-user').textContent = user.displayName || user.email || 'Utente';
    if (user.photoURL) {
      const avatar = document.getElementById('nav-avatar');
      if(avatar) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
    }
    showScreen('app');
    await loadAllData();
  },
  () => {
    showScreen('login');
    setupLoginUI();
  }
);
