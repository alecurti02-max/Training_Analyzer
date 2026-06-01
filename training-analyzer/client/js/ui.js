// ==================== UI MODULE (MAIN ORCHESTRATOR) ====================
// Entry point loaded by HTML: <script type="module" src="js/ui.js">
// Imports from all other 7 modules, owns global state, all rendering.

import { api, clearTokens } from './api.js';
import { initAuth, setupLoginUI, logout } from './auth.js';
import { SPORT_TEMPLATES, FIELD_DEFS, DEFAULT_MUSCLES, getUserActiveSports, getDefaultMusclesForSport } from './sports.js';
import { scoreWorkout, getAdvice, renderAiAnalysis, getRecoveryStatus, calculateStreak, getFitnessAssessment, calcTonnage } from './scoring.js';
import { destroyChart, storeChart, getChartTheme, renderHeatmap, renderRadarChart, renderWeeklyChart, renderProgress as renderProgressCharts, render1RMChart, updateORMChart, renderHRZones, renderWeightChart } from './charts.js';
import { loadMeasurements, renderMeasurementsPage, getMeasurements } from './bodyMeasurements.js';
import { exportProfilePdf } from './pdfExport.js';
import { loadRecoveryData, renderRecoveryPage, saveNutritionLog, saveSleepLog } from './recovery.js';
import { handleGPXFiles, handleCSVFile, handleAppleHealthFile, handleFITFile, exportAllData, importJSONBackup } from './import.js';
import { searchUsers as searchUsersAPI, renderSearchResults, addFriendByUID, toggleFollow, renderFriendsPage as renderFriendsPageModule, renderFollowingList, renderCompareCheckboxes, compareSelected, timeAgo } from './friends.js';
import { renderAdmin, setupAdminGating } from './admin.js';
import { renderBodyAvatar, getBodyPartInfo } from './bodyAvatar.js';
import { uid, todayStr, scoreColor, paceToSeconds, secondsToPace, formatDate, getWeekStart, daysBetween } from '../src/lib/utils.js';
import { toast } from '../src/lib/toast.js';

// ==================== GLOBAL STATE ====================
let currentUser = null;
let workoutsCache = [], settingsCache = {}, exercisesCache = null, weightsCache = [];
const EXERCISES_LOAD_FAILED = Symbol('exercises_load_failed');
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
const LIVE_REST_PRESETS = [30, 60, 90, 120, 180];
let liveRestTotal = (function() {
  const v = parseInt(localStorage.getItem('ta_live_rest_default'));
  return (Number.isFinite(v) && v >= 15 && v <= 600) ? v : 90;
})();
let liveRestRemaining = 0;
let liveSelectedType = '';

// History filter state
let historyFilter = 'all';

// ==================== HELPERS ====================
// uid, toast, todayStr, scoreColor, paceToSeconds, secondsToPace, formatDate,
// getWeekStart, daysBetween are imported from src/lib/{utils,toast}.js (top of file).

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
      // Use a Symbol sentinel to distinguish network/server errors from a legitimate empty list,
      // so we never auto-overwrite the server-side library with defaults on a transient failure.
      api.get('/api/exercises').catch((e) => { console.error('exercises load failed:', e); return EXERCISES_LOAD_FAILED; }),
      api.get('/api/weights').catch(() => []),
      api.get('/api/users/me/following').catch(() => ({}))
    ]);
    await loadMeasurements();
    await loadRecoveryData();

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
    settingsCache = settingsRes || {};
    if (settingsCache.activeSports) activeSports = settingsCache.activeSports;
    if (settingsCache.muscleGroups) muscleGroups = settingsCache.muscleGroups;

    // Compute tonnage for gym workouts (after settings load so we know user bodyweight)
    const userBW = settingsCache.bodyweight || 0;
    workoutsCache.forEach(w => {
      if (w.type === 'gym' && !w._tonnage) {
        w._tonnage = calcTonnage(w.exercises, userBW);
      }
    });

    if (exercisesRes === EXERCISES_LOAD_FAILED) {
      // Server/network error: keep working set empty for this session, do NOT overwrite the server.
      exercisesCache = [];
      toast('Errore caricamento libreria esercizi: i dati sul server non sono stati toccati', 'error');
    } else if (Array.isArray(exercisesRes) && !exercisesRes.length) {
      // Legitimate empty list (new user onboarding): seed with defaults.
      exercisesCache = getDefaultExercises();
      api.put('/api/exercises', exercisesCache).catch(() => {});
    } else {
      exercisesCache = exercisesRes;
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

const pageMap = {dashboard:'Dashboard',train:'Allenamento',history:'Storico',progress:'Progressi',body:'Corpo',recovery:'Recupero',profile:'Profilo',setup:'Setup',admin:'Admin'};

// Old slugs → new page + tab (for backward compat with internal data-page="X" links and bookmarks)
const PAGE_ALIAS = {
  log:      { page: 'train',    tab: 'manual' },
  live:     { page: 'train',    tab: 'live' },
  athletic: { page: 'progress', tab: 'athletic' },
  weight:   { page: 'body',     tab: 'quicklog' },
  library:  { page: 'setup',    tab: 'library' },
  import:   { page: 'setup',    tab: 'import' },
  settings: { page: 'setup',    tab: 'settings' },
  friends:  { page: 'profile',  tab: 'friends' },
};

// Default tab per consolidated page (used when no localStorage value)
const PAGE_DEFAULT_TAB = {
  train:    'manual',
  progress: 'general',
  body:     'quicklog',
  recovery: 'nutrition',
  profile:  'me',
  setup:    'library',
};

function showPage(page) {
  // Redirect old slugs to consolidated page+tab
  if (PAGE_ALIAS[page]) {
    const a = PAGE_ALIAS[page];
    showPage(a.page);
    showTab(a.page, a.tab);
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) pageEl.classList.add('active');
  // Esponi la pagina corrente come attributo su <html> cosi' i token CSS scoped
  // (es. :root[data-active-page="dashboard"] in tokens.css) si attivano solo
  // quando la pagina rispettiva e' visibile. Usato anche da Chart.js che legge
  // le custom properties via getComputedStyle(document.documentElement).
  document.documentElement.dataset.activePage = page;
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.remove('active');
    if(b.textContent===pageMap[page]) b.classList.add('active');
  });
  if(page==='dashboard') renderDashboard();
  if(page==='history') renderHistory();
  if(page==='progress') { renderProgress(); renderAthleticDetail(); }
  if(page==='body') { renderWeightPage(); populateSettingsUI(); }
  if(page==='recovery') { renderRecoveryPage({ settings: settingsCache, toast }); }
  if(page==='profile') { renderProfile(); renderFriendsPageLocal(); }
  if(page==='train') {
    // When the Preact Train takes over, it fully owns the page — return early so
    // the PAGE_DEFAULT_TAB restore below doesn't re-show the hidden legacy markup.
    if (mountTrainPreactIfEnabled()) return;
    initLogWizard(); initLivePage();
  }
  if(page==='setup') {
    renderExerciseLibrary(); renderMuscleGroupsManager(); populateMuscleSelect();
    populateSettingsUI(); renderSportsManager(); renderNotifications();
  }
  if(page==='admin') renderAdmin();
  // Restore last-active sub-tab (if any)
  if (PAGE_DEFAULT_TAB[page]) {
    let savedTab;
    try { savedTab = localStorage.getItem('ta_tab_' + page); } catch(e) {}
    showTab(page, savedTab || PAGE_DEFAULT_TAB[page]);
  }
}

// ==================== TRAIN (Preact, flag-gated) ====================
// When localStorage.ta_train_preact === '1', the Train page is rendered by the
// Preact tree (src/pages/Train) instead of the legacy wizard/live functions. The
// legacy #page-train markup is hidden (not removed) so flipping the flag off
// restores the vanilla path with no reload. Returns true if it took over.
function trainPreactEnabled() {
  try { return localStorage.getItem('ta_train_preact') === '1'; } catch (e) { return false; }
}
function mountTrainPreactIfEnabled() {
  if (!trainPreactEnabled() || !globalThis.Preact?.train) return false;
  const pageEl = document.getElementById('page-train');
  if (!pageEl) return false;
  // Mount Preact into a dedicated host and hide every OTHER child of #page-train
  // (the legacy tabs/wizard/live markup). Done on every visit — idempotent — because
  // showTab() may have re-shown the legacy containers since the last mount.
  let host = document.getElementById('train-preact-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'train-preact-host';
    pageEl.appendChild(host);
  }
  Array.from(pageEl.children).forEach((c) => { c.style.display = c === host ? '' : 'none'; });
  globalThis.Preact.train.mount({
    host,
    data: {
      workouts: workoutsCache,
      settings: settingsCache,
      exercises: exercisesCache || getDefaultExercises(),
    },
    bridge: {
      saveWorkout,
      getDefaultExercises,
      // Mirror the legacy post-save: push to cache, toast, go to dashboard.
      onSaved: (workout, message) => {
        workoutsCache.push(workout);
        if (message) toast(message, 'success');
        showPage('dashboard');
      },
    },
  });
  return true;
}

function showTab(group, tab) {
  // Toggle nav buttons
  document.querySelectorAll('[data-tab-group="'+group+'"]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  // Toggle sub-section visibility
  document.querySelectorAll('#page-'+group+' [data-tab-content]').forEach(s => {
    s.style.display = s.dataset.tabContent === tab ? '' : 'none';
  });
  // Persist
  try { localStorage.setItem('ta_tab_' + group, tab); } catch(e) {}
}

function onDataChanged() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-dashboard') renderDashboard();
  if (id === 'page-history') renderHistory();
  if (id === 'page-progress') { renderProgress(); renderAthleticDetail(); }
  if (id === 'page-body') renderWeightPage();
}

// ==================== SAVE HELPERS (API calls) ====================
async function saveWorkout(workout) {
  // Auto-fill default muscles for non-gym workouts that didn't go through a form
  // (imports, live recording). Form-based flows pass an explicit muscles array.
  if (workout.type !== 'gym' && workout.muscles === undefined) {
    const defaults = getDefaultMusclesForSport(workout.type);
    if (defaults.length) workout.muscles = defaults;
  }
  const { type, date, ...rest } = workout;
  const saved = await api.post('/api/workouts', { type, date, data: rest });
  return saved;
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
function wizDraftKey() { return 'wizDraft_' + (currentUser?.uid || 'anon'); }
function wizSerializeFormFields() {
  const fields = {
    date: document.getElementById('wiz-date')?.value || '',
    notes: document.getElementById('wiz-notes')?.value || '',
    gymDuration: document.getElementById('wiz-gym-duration')?.value || '',
    gymRpe: document.getElementById('wiz-gym-rpe')?.value || '',
    sportFields: {},
    pickedMuscles: readMuscleChips('wiz'),
  };
  const tmplFields = (SPORT_TEMPLATES[wizType]?.fields) || [];
  tmplFields.forEach((k) => {
    const el = document.getElementById('wiz-field-' + k);
    if (el) fields.sportFields[k] = el.value;
  });
  return fields;
}
function wizSaveDraft() {
  if (!wizType && !wizExercises.length) return;
  const draft = {
    wizStep,
    wizType,
    wizExercises,
    formFields: wizSerializeFormFields(),
    _lastSavedAt: Date.now(),
  };
  try { localStorage.setItem(wizDraftKey(), JSON.stringify(draft)); } catch(e) {}
}
function wizLoadDraft() {
  try { const d = localStorage.getItem(wizDraftKey()); return d ? JSON.parse(d) : null; } catch(e) { return null; }
}
function wizClearDraft() {
  try { localStorage.removeItem(wizDraftKey()); } catch(e) {}
}
function wizCheckDraft() {
  const draft = wizLoadDraft();
  if (!draft) return false;
  const modal = document.getElementById('wiz-recovery-modal');
  if (!modal) return false;
  const meta = document.getElementById('wiz-recovery-meta');
  if (meta) {
    const exCount = (draft.wizExercises || []).length;
    const sportLabel = draft.wizType ? (SPORT_TEMPLATES[draft.wizType]?.name || draft.wizType) : 'sport non scelto';
    const when = draft._lastSavedAt ? new Date(draft._lastSavedAt).toLocaleString() : '';
    meta.textContent = `${sportLabel} · ${exCount} esercizi · ${when}`;
  }
  modal.classList.add('show');
  return true;
}
function wizApplyDraft(d) {
  wizType = d.wizType || '';
  wizExercises = Array.isArray(d.wizExercises) ? d.wizExercises : [];
  wizStep = d.wizStep || 1;
  // Re-render base UI then restore form values
  renderSportTypeGrid();
  // Mark selected sport card if any
  if (wizType) {
    const card = document.querySelector(`.type-card[data-sport="${wizType}"]`);
    if (card) { document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); }
  }
  updateWizStep();
  const ff = d.formFields || {};
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  setVal('wiz-date', ff.date);
  setVal('wiz-notes', ff.notes);
  setVal('wiz-gym-duration', ff.gymDuration);
  setVal('wiz-gym-rpe', ff.gymRpe);
  Object.entries(ff.sportFields || {}).forEach(([k, v]) => setVal('wiz-field-' + k, v));
  if (Array.isArray(ff.pickedMuscles)) {
    ff.pickedMuscles.forEach(m => {
      const btn = document.querySelector(`#wiz-muscles-chips [data-muscle-chip="${m}"]`);
      if (btn) btn.classList.add('active');
    });
  }
  if (wizStep === 3 && wizType === 'gym') renderWizSets();
}
function wizResumeDraft() {
  const d = wizLoadDraft();
  document.getElementById('wiz-recovery-modal')?.classList.remove('show');
  if (!d) return;
  wizApplyDraft(d);
  toast('Bozza ripristinata');
}
function wizDiscardDraft() {
  document.getElementById('wiz-recovery-modal')?.classList.remove('show');
  wizClearDraft();
  initLogWizard(true);
}

function initLogWizard(skipDraftCheck = false) {
  if (!skipDraftCheck && wizCheckDraft()) {
    // Wait for user choice; modal will trigger resume/discard
    return;
  }
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
  wizSaveDraft();
  setTimeout(() => wizGoStep(2), 200);
}

function wizGoStep(step) {
  if (step === 2 && !wizType) { toast('Seleziona un tipo!', 'error'); return; }
  wizStep = step;
  updateWizStep();
  wizSaveDraft();
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

// Multi-chip selector for muscle groups (used by add wizard + edit form for non-gym sports)
function renderMuscleChipsHTML(idPrefix, selected) {
  const set = new Set(selected || []);
  return `<div class="form-group" style="margin-top:12px">
    <label>Muscoli coinvolti <span style="font-size:.72rem;color:var(--text2);font-weight:400">(usati per il recupero in dashboard)</span></label>
    <div id="${idPrefix}-muscles-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
      ${DEFAULT_MUSCLES.map(m => `<button type="button" class="filter-btn ${set.has(m)?'active':''}" data-muscle-chip="${m}">${m}</button>`).join('')}
    </div>
  </div>`;
}
function attachMuscleChipHandlers(idPrefix) {
  document.querySelectorAll(`#${idPrefix}-muscles-chips [data-muscle-chip]`).forEach(b => {
    b.addEventListener('click', () => b.classList.toggle('active'));
  });
}
function readMuscleChips(idPrefix) {
  return Array.from(document.querySelectorAll(`#${idPrefix}-muscles-chips [data-muscle-chip].active`))
    .map(b => b.dataset.muscleChip);
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
  // Muscle chips (non-gym only; gym derives muscles from exercises)
  if (wizType !== 'gym') {
    html += renderMuscleChipsHTML('wiz', getDefaultMusclesForSport(wizType));
  }
  document.getElementById('wiz-sport-fields').innerHTML = html;
  if (wizType !== 'gym') attachMuscleChipHandlers('wiz');
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

function wizGetParam(name) {
  return ((exercisesCache || []).find(e => e.name === name)?.param) || 'reps';
}

function addWizExercise(name, muscle) {
  closeExerciseSheet();
  const lastPerf = getLastPerformance(name);
  const libEntry = (exercisesCache || []).find(e => e.name === name) || {};
  const weightMode = libEntry.weightMode || 'total';
  const barbellWeight = libEntry.barbellWeight || null;
  const isUnilateral = !!libEntry.isUnilateral;
  const param = libEntry.param || 'reps';
  const isReps = param === 'reps';
  const emptySet = isUnilateral
    ? (isReps ? { reps: '', weightLeft: '', weightRight: '', rpe: null, bodyweight: false }
              : { repsLeft: '', repsRight: '', rpe: null, bodyweight: false })
    : { reps: '', weight: '', rpe: null, bodyweight: false };
  const copyFromLast = (s) => isUnilateral
    ? (isReps
        ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight }
        : { repsLeft: s.repsLeft != null ? s.repsLeft : (s.reps || ''), repsRight: s.repsRight != null ? s.repsRight : (s.reps || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight })
    : { reps: s.reps != null ? s.reps : (s.repsLeft || ''), weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight, drops: Array.isArray(s.drops) && s.drops.length ? s.drops.map(d => ({ reps: d.reps, weight: d.weight })) : undefined };
  const secondaryMuscles = Array.isArray(libEntry.secondaryMuscles) ? libEntry.secondaryMuscles.slice() : [];
  wizExercises.push({
    name, muscle, secondaryMuscles, weightMode, barbellWeight, isUnilateral, param,
    sets: lastPerf ? lastPerf.sets.map(copyFromLast) : [emptySet],
    lastPerf
  });
  renderWizExerciseList();
  wizSaveDraft();
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

function removeWizExercise(idx) { wizExercises.splice(idx, 1); renderWizExerciseList(); wizSaveDraft(); }

// Builds an HTML summary of the current weight mode/barbell/unilateral for an exercise
function weightOptionsSummary(ex) {
  const parts = [];
  if (ex.weightMode === 'per_side') parts.push('Peso per lato');
  if (ex.barbellWeight) parts.push(`+${ex.barbellWeight}kg bilanciere`);
  if (ex.isUnilateral) parts.push('Unilaterale');
  return parts.length ? parts.join(' · ') : 'Peso totale';
}

// HTML for the weight-mode override panel, collapsed by default
function weightOptionsOverrideHTML(ex, exIdx, prefix) {
  const bOpts = [{v:'',t:'Nessuno'},{v:'20',t:'Olimpico 20kg'},{v:'10',t:'EZ 10kg'},{v:'25',t:'Trap 25kg'}];
  const curBW = ex.barbellWeight;
  const preset = curBW!=null && bOpts.some(o=>o.v===String(curBW));
  const bSel = curBW==null ? '' : (preset ? String(curBW) : 'custom');
  return `<div class="weight-opts-override" id="${prefix}-wopts-${exIdx}" style="display:none">
    <div class="wopts-row">
      <label>Modalita</label>
      <select data-wopt="${prefix}|${exIdx}|weightMode">
        <option value="total" ${ex.weightMode!=='per_side'?'selected':''}>Totale</option>
        <option value="per_side" ${ex.weightMode==='per_side'?'selected':''}>Per lato</option>
      </select>
    </div>
    <div class="wopts-row">
      <label>Bilanciere</label>
      <select data-wopt="${prefix}|${exIdx}|barbellSel">
        ${bOpts.map(o=>`<option value="${o.v}" ${o.v===bSel?'selected':''}>${o.t}</option>`).join('')}
        <option value="custom" ${bSel==='custom'?'selected':''}>Custom</option>
      </select>
      <input type="number" step="0.5" placeholder="kg" class="wopts-custom" data-wopt="${prefix}|${exIdx}|barbellCustom" value="${bSel==='custom'?curBW:''}" style="${bSel==='custom'?'':'display:none'}">
    </div>
    <div class="wopts-row">
      <label style="display:flex;align-items:center;gap:6px;margin:0">
        <input type="checkbox" data-wopt="${prefix}|${exIdx}|isUnilateral" ${ex.isUnilateral?'checked':''}>
        <span>Unilaterale</span>
      </label>
    </div>
  </div>`;
}

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
    const isReps = param === 'reps';
    const uni = !!ex.isUnilateral;
    const perSide = ex.weightMode === 'per_side';
    const bw = ex.barbellWeight || 0;
    const weightSuffix = perSide ? '/lato' : '';
    const barbellTag = bw ? `<div class="barbell-tag">+ ${bw}kg bilanciere</div>` : '';
    let setsHTML = ex.sets.map((s, sIdx) => {
      const repsInput = (uni && !isReps)
        ? `<div class="weight-uni">
             <input type="number" placeholder="${paramPh} SX" value="${s.repsLeft||''}" data-set-update="${exIdx}-${sIdx}-repsLeft" class="w-uni">
             <input type="number" placeholder="${paramPh} DX" value="${s.repsRight||''}" data-set-update="${exIdx}-${sIdx}-repsRight" class="w-uni">
           </div>`
        : `<input type="number" placeholder="${paramPh}" value="${s.reps||''}" data-set-update="${exIdx}-${sIdx}-reps">`;
      const kgPlaceholder = isReps ? `Kg${weightSuffix}` : 'Kg (opz.)';
      const bwChecked = s.bodyweight ? 'checked' : '';
      const bwToggle = uni ? '' : `<label class="bw-toggle" title="Corpo libero (peso = zavorra aggiunta)"><input type="checkbox" data-set-update="${exIdx}-${sIdx}-bodyweight" ${bwChecked}><span>BW</span></label>`;
      const weightInputs = uni
        ? `<div class="weight-uni">
             <input type="number" step="0.5" placeholder="SX" value="${s.weightLeft||''}" data-set-update="${exIdx}-${sIdx}-weightLeft" class="w-uni">
             <input type="number" step="0.5" placeholder="DX" value="${s.weightRight||''}" data-set-update="${exIdx}-${sIdx}-weightRight" class="w-uni">
           </div>`
        : `<input type="number" step="0.5" placeholder="${kgPlaceholder}" value="${s.weight||''}" data-set-update="${exIdx}-${sIdx}-weight">`;
      const dropsHTML = (!uni && Array.isArray(s.drops) && s.drops.length)
        ? s.drops.map((d, dIdx) => `<div class="drop-inline">
            <span class="drop-arrow">&#8627;</span>
            <input type="number" placeholder="Reps" value="${d.reps||''}" data-drop-update="${exIdx}-${sIdx}-${dIdx}-reps">
            <input type="number" step="0.5" placeholder="Kg" value="${d.weight||''}" data-drop-update="${exIdx}-${sIdx}-${dIdx}-weight">
            <button class="btn-icon" data-remove-drop="${exIdx}-${sIdx}-${dIdx}" title="Rimuovi drop">&times;</button>
          </div>`).join('')
        : '';
      const dropAddBtn = uni
        ? ''
        : `<button class="btn-link-sm" data-add-drop="${exIdx}-${sIdx}" title="Aggiungi un drop set">+ drop</button>`;
      return `<div class="set-block">
        <div class="set-inline">
          <div class="set-num">${sIdx+1}</div>
          ${repsInput}
          ${bwToggle}
          ${weightInputs}
          <select data-set-update="${exIdx}-${sIdx}-rpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${s.rpe==n?'selected':''}>${n}</option>`).join('')}</select>
          <button class="btn-icon" data-remove-set="${exIdx}-${sIdx}">&#128465;</button>
        </div>
        ${dropsHTML}
        ${dropAddBtn}
      </div>`;
    }).join('');
    const optsHTML = `
      <div class="weight-opts-summary">
        <span>${weightOptionsSummary(ex)}</span>
        <button type="button" class="btn-link-sm" data-wopts-toggle="wiz-wopts-${exIdx}">Modifica</button>
      </div>
      ${weightOptionsOverrideHTML(ex, exIdx, 'wiz')}
    `;
    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><span class="exercise-card-muscle">${ex.muscle} <span style="font-size:.72rem;color:var(--blue)">${paramLabel}</span></span></div>
      ${optsHTML}
      ${barbellTag}
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
      const parts = this.dataset.setUpdate.split('-');
      const exIdx = parseInt(parts[0]);
      const sIdx = parseInt(parts[1]);
      const field = parts.slice(2).join('-');
      const val = this.type === 'checkbox' ? this.checked : this.value;
      wizUpdateSet(exIdx, sIdx, field, val);
    });
  });
  container.querySelectorAll('[data-drop-update]').forEach(el => {
    el.addEventListener('change', function() {
      const parts = this.dataset.dropUpdate.split('-');
      wizUpdateDrop(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), parts[3], this.value);
    });
  });
  container.querySelectorAll('[data-add-drop]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [ei, si] = this.dataset.addDrop.split('-').map(Number);
      wizAddDrop(ei, si);
    });
  });
  container.querySelectorAll('[data-remove-drop]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [ei, si, di] = this.dataset.removeDrop.split('-').map(Number);
      wizRemoveDrop(ei, si, di);
    });
  });
  container.querySelectorAll('[data-remove-set]').forEach(btn => {
    btn.addEventListener('click', function() {
      const parts = this.dataset.removeSet.split('-');
      wizRemoveSet(parseInt(parts[0]), parseInt(parts[1]));
    });
  });
  container.querySelectorAll('[data-add-set]').forEach(btn => {
    btn.addEventListener('click', function() { wizAddSet(parseInt(this.dataset.addSet)); });
  });
  container.querySelectorAll('[data-copy-sets]').forEach(btn => {
    btn.addEventListener('click', function() { wizCopyLastSets(parseInt(this.dataset.copySets)); });
  });
  container.querySelectorAll('[data-wopts-toggle]').forEach(btn => {
    btn.addEventListener('click', function() {
      const panel = document.getElementById(this.dataset.woptsToggle);
      if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
  });
  container.querySelectorAll('[data-wopt]').forEach(el => {
    const handler = function() {
      const [prefix, exIdxStr, field] = this.dataset.wopt.split('|');
      if (prefix !== 'wiz') return;
      const exIdx = parseInt(exIdxStr);
      wizUpdateWeightOption(exIdx, field, this.type === 'checkbox' ? this.checked : this.value);
    };
    el.addEventListener('change', handler);
  });
}

function wizUpdateSet(exIdx, sIdx, field, value) {
  const set = wizExercises[exIdx].sets[sIdx];
  if (field === 'reps') set.reps = parseInt(value) || '';
  else if (field === 'repsLeft') set.repsLeft = parseFloat(value) || '';
  else if (field === 'repsRight') set.repsRight = parseFloat(value) || '';
  else if (field === 'weight') set.weight = parseFloat(value) || '';
  else if (field === 'weightLeft') set.weightLeft = parseFloat(value) || '';
  else if (field === 'weightRight') set.weightRight = parseFloat(value) || '';
  else if (field === 'rpe') set.rpe = parseInt(value) || null;
  else if (field === 'bodyweight') set.bodyweight = !!value;
  wizSaveDraft();
}

function wizAddDrop(exIdx, sIdx) {
  const ex = wizExercises[exIdx];
  if (!ex || ex.isUnilateral) return;
  const set = ex.sets[sIdx];
  if (!Array.isArray(set.drops)) set.drops = [];
  const last = set.drops[set.drops.length - 1] || { reps: set.reps, weight: set.weight };
  set.drops.push({ reps: last.reps || '', weight: last.weight || '' });
  renderWizSets();
  wizSaveDraft();
}

function wizRemoveDrop(exIdx, sIdx, dIdx) {
  const set = wizExercises[exIdx]?.sets?.[sIdx];
  if (!set || !Array.isArray(set.drops)) return;
  set.drops.splice(dIdx, 1);
  if (!set.drops.length) delete set.drops;
  renderWizSets();
  wizSaveDraft();
}

function wizUpdateDrop(exIdx, sIdx, dIdx, field, value) {
  const set = wizExercises[exIdx]?.sets?.[sIdx];
  if (!set || !Array.isArray(set.drops) || !set.drops[dIdx]) return;
  if (field === 'reps') set.drops[dIdx].reps = parseInt(value) || '';
  else if (field === 'weight') set.drops[dIdx].weight = parseFloat(value) || '';
  wizSaveDraft();
}

function wizUpdateWeightOption(exIdx, field, value) {
  const ex = wizExercises[exIdx];
  if (!ex) return;
  if (field === 'weightMode') ex.weightMode = value;
  else if (field === 'barbellSel') {
    if (value === '') ex.barbellWeight = null;
    else if (value === 'custom') ex.barbellWeight = ex.barbellWeight || 0;
    else ex.barbellWeight = parseFloat(value) || null;
  } else if (field === 'barbellCustom') {
    const c = parseFloat(value);
    ex.barbellWeight = isFinite(c) && c > 0 ? c : null;
  } else if (field === 'isUnilateral') {
    ex.isUnilateral = !!value;
    ex.sets = ex.sets.map(s => ex.isUnilateral
      ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight }
      : { reps: s.reps, weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight });
  }
  renderWizSets();
  wizSaveDraft();
}

function wizAddSet(exIdx) {
  const ex = wizExercises[exIdx];
  const lastSet = ex.sets[ex.sets.length - 1] || {};
  const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
  const newSet = ex.isUnilateral
    ? (isReps
        ? { reps: lastSet.reps || '', weightLeft: lastSet.weightLeft || '', weightRight: lastSet.weightRight || '', rpe: lastSet.rpe || null, bodyweight: !!lastSet.bodyweight }
        : { repsLeft: lastSet.repsLeft || '', repsRight: lastSet.repsRight || '', rpe: lastSet.rpe || null, bodyweight: !!lastSet.bodyweight })
    : { reps: lastSet.reps || '', weight: lastSet.weight || '', rpe: lastSet.rpe || null, bodyweight: !!lastSet.bodyweight };
  ex.sets.push(newSet);
  renderWizSets();
  wizSaveDraft();
}
function wizRemoveSet(exIdx, sIdx) {
  const ex = wizExercises[exIdx];
  ex.sets.splice(sIdx, 1);
  if (!ex.sets.length) {
    const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
    ex.sets.push(ex.isUnilateral
      ? (isReps ? { reps: '', weightLeft: '', weightRight: '', rpe: null, bodyweight: false }
                : { repsLeft: '', repsRight: '', rpe: null, bodyweight: false })
      : { reps: '', weight: '', rpe: null, bodyweight: false });
  }
  renderWizSets();
  wizSaveDraft();
}
function wizCopyLastSets(exIdx) {
  const ex = wizExercises[exIdx];
  const last = ex.lastPerf;
  if (!last) return;
  const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
  ex.sets = last.sets.map(s => ex.isUnilateral
    ? (isReps
        ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight }
        : { repsLeft: s.repsLeft != null ? s.repsLeft : (s.reps || ''), repsRight: s.repsRight != null ? s.repsRight : (s.reps || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight })
    : { reps: s.reps != null ? s.reps : (s.repsLeft || ''), weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, bodyweight: !!s.bodyweight, drops: Array.isArray(s.drops) ? s.drops.map(d => ({ reps: d.reps, weight: d.weight })) : undefined });
  renderWizSets();
  wizSaveDraft();
  toast('Serie copiate!');
}

async function wizSaveWorkout() {
  const date = document.getElementById('wiz-date').value || todayStr();
  const notes = document.getElementById('wiz-notes').value;

  if (wizType === 'gym') {
    const exercises = [];
    wizExercises.forEach(ex => {
      const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
      const sets = ex.sets
        .filter(s => (s.reps > 0) || (s.repsLeft > 0) || (s.repsRight > 0))
        .map(s => {
          let out;
          if (ex.isUnilateral) {
            out = isReps
              ? { reps: s.reps, weightLeft: s.weightLeft || 0, weightRight: s.weightRight || 0, rpe: s.rpe || null }
              : { repsLeft: s.repsLeft || 0, repsRight: s.repsRight || 0, rpe: s.rpe || null };
          } else {
            out = { reps: s.reps, weight: s.weight || 0, rpe: s.rpe || null };
            const drops = Array.isArray(s.drops)
              ? s.drops.filter(d => d.reps > 0).map(d => ({ reps: d.reps, weight: d.weight || 0 }))
              : [];
            if (drops.length) out.drops = drops;
          }
          if (s.bodyweight) out.bodyweight = true;
          return out;
        });
      if (sets.length) exercises.push({
        name: ex.name,
        muscle: ex.muscle,
        secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
        weightMode: ex.weightMode || 'total',
        barbellWeight: ex.barbellWeight || null,
        isUnilateral: !!ex.isUnilateral,
        param: ex.param || wizGetParam(ex.name),
        sets
      });
    });
    if (!exercises.length) { toast('Aggiungi almeno un esercizio!', 'error'); return; }
    const workout = { id: uid(), type: 'gym', date, duration: parseInt(document.getElementById('wiz-gym-duration')?.value) || null,
      rpe: parseInt(document.getElementById('wiz-gym-rpe')?.value) || null, notes, exercises };
    workout._tonnage = calcTonnage(exercises, settingsCache?.bodyweight || 0);
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout, workoutsCache, settingsCache);
    const saved = await saveWorkout(workout);
    if (saved && saved.id) workout.id = saved.id;
    workoutsCache.push(workout);
    toast('Palestra salvata! Score: ' + workout.scores.overall, 'success');
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
    const pickedMuscles = readMuscleChips('wiz');
    if (pickedMuscles.length) workout.muscles = pickedMuscles;
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout, workoutsCache, settingsCache);
    const saved = await saveWorkout(workout);
    if (saved && saved.id) workout.id = saved.id;
    workoutsCache.push(workout);
    const sportName = tmpl?.name || wizType;
    toast(sportName + ' salvato! Score: ' + workout.scores.overall, 'success');
  }
  wizClearDraft();
  showPage('dashboard');
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
function liveCancel() {
  if (!liveSession) return;
  if (!confirm("Annullare l'allenamento? I dati non salvati saranno persi.")) return;
  liveStopTimer();
  liveRestDismiss();
  liveClearDraft();
  liveSession = null;
  initLivePage();
  toast('Allenamento annullato');
}

// --- Screen management ---
function liveShowScreen(screen) {
  document.querySelectorAll('.live-screen').forEach(s => s.classList.remove('active'));
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
  const libEntry = (exercisesCache || []).find(e => e.name === name) || {};
  const weightMode = libEntry.weightMode || 'total';
  const barbellWeight = libEntry.barbellWeight || null;
  const isUnilateral = !!libEntry.isUnilateral;
  const param = libEntry.param || 'reps';
  const isReps = param === 'reps';
  const emptySet = isUnilateral
    ? (isReps ? { reps: '', weightLeft: '', weightRight: '', rpe: null, done: false, bodyweight: false }
              : { repsLeft: '', repsRight: '', rpe: null, done: false, bodyweight: false })
    : { reps: '', weight: '', rpe: null, done: false, bodyweight: false };
  const copyFromLast = (s) => isUnilateral
    ? (isReps
        ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, done: false, bodyweight: !!s.bodyweight }
        : { repsLeft: s.repsLeft != null ? s.repsLeft : (s.reps || ''), repsRight: s.repsRight != null ? s.repsRight : (s.reps || ''), rpe: s.rpe || null, done: false, bodyweight: !!s.bodyweight })
    : { reps: s.reps != null ? s.reps : (s.repsLeft || ''), weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, done: false, bodyweight: !!s.bodyweight };
  const sets = lastPerf ? lastPerf.sets.map(copyFromLast) : [emptySet];
  const secondaryMuscles = Array.isArray(libEntry.secondaryMuscles) ? libEntry.secondaryMuscles.slice() : [];
  liveSession.exercises.push({ name, muscle, secondaryMuscles, weightMode, barbellWeight, isUnilateral, param, sets, lastPerf });
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
  else if (field === 'repsLeft') set.repsLeft = parseFloat(value) || '';
  else if (field === 'repsRight') set.repsRight = parseFloat(value) || '';
  else if (field === 'weight') set.weight = parseFloat(value) || '';
  else if (field === 'weightLeft') set.weightLeft = parseFloat(value) || '';
  else if (field === 'weightRight') set.weightRight = parseFloat(value) || '';
  else if (field === 'rpe') set.rpe = parseInt(value) || null;
  else if (field === 'bodyweight') set.bodyweight = !!value;
  liveSaveDraft();
}
function liveAddDrop(exIdx, sIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  if (!ex || ex.isUnilateral) return;
  const set = ex.sets[sIdx];
  if (!Array.isArray(set.drops)) set.drops = [];
  const last = set.drops[set.drops.length - 1] || { reps: set.reps, weight: set.weight };
  set.drops.push({ reps: last.reps || '', weight: last.weight || '' });
  liveRenderExercises();
  liveSaveDraft();
}
function liveRemoveDrop(exIdx, sIdx, dIdx) {
  if (!liveSession) return;
  const set = liveSession.exercises[exIdx]?.sets?.[sIdx];
  if (!set || !Array.isArray(set.drops)) return;
  set.drops.splice(dIdx, 1);
  if (!set.drops.length) delete set.drops;
  liveRenderExercises();
  liveSaveDraft();
}
function liveUpdateDrop(exIdx, sIdx, dIdx, field, value) {
  if (!liveSession) return;
  const set = liveSession.exercises[exIdx]?.sets?.[sIdx];
  if (!set || !Array.isArray(set.drops) || !set.drops[dIdx]) return;
  if (field === 'reps') set.drops[dIdx].reps = parseInt(value) || '';
  else if (field === 'weight') set.drops[dIdx].weight = parseFloat(value) || '';
  liveSaveDraft();
}
function liveAddSet(exIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  const lastSet = ex.sets[ex.sets.length - 1] || {};
  const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
  const newSet = ex.isUnilateral
    ? (isReps
        ? { reps: lastSet.reps || '', weightLeft: lastSet.weightLeft || '', weightRight: lastSet.weightRight || '', rpe: lastSet.rpe || null, done: false, bodyweight: !!lastSet.bodyweight }
        : { repsLeft: lastSet.repsLeft || '', repsRight: lastSet.repsRight || '', rpe: lastSet.rpe || null, done: false, bodyweight: !!lastSet.bodyweight })
    : { reps: lastSet.reps || '', weight: lastSet.weight || '', rpe: lastSet.rpe || null, done: false, bodyweight: !!lastSet.bodyweight };
  ex.sets.push(newSet);
  liveRenderExercises();
  liveSaveDraft();
}
function liveRemoveSet(exIdx, sIdx) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  ex.sets.splice(sIdx, 1);
  if (!ex.sets.length) {
    const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
    ex.sets.push(ex.isUnilateral
      ? (isReps ? { reps: '', weightLeft: '', weightRight: '', rpe: null, done: false, bodyweight: false }
                : { repsLeft: '', repsRight: '', rpe: null, done: false, bodyweight: false })
      : { reps: '', weight: '', rpe: null, done: false, bodyweight: false });
  }
  liveRenderExercises();
  liveSaveDraft();
}
function liveUpdateWeightOption(exIdx, field, value) {
  if (!liveSession) return;
  const ex = liveSession.exercises[exIdx];
  if (!ex) return;
  if (field === 'weightMode') ex.weightMode = value;
  else if (field === 'barbellSel') {
    if (value === '') ex.barbellWeight = null;
    else if (value === 'custom') ex.barbellWeight = ex.barbellWeight || 0;
    else ex.barbellWeight = parseFloat(value) || null;
  } else if (field === 'barbellCustom') {
    const c = parseFloat(value);
    ex.barbellWeight = isFinite(c) && c > 0 ? c : null;
  } else if (field === 'isUnilateral') {
    ex.isUnilateral = !!value;
    ex.sets = ex.sets.map(s => ex.isUnilateral
      ? { reps: s.reps, weightLeft: s.weightLeft != null ? s.weightLeft : (s.weight || ''), weightRight: s.weightRight != null ? s.weightRight : (s.weight || ''), rpe: s.rpe || null, done: !!s.done, bodyweight: !!s.bodyweight }
      : { reps: s.reps, weight: s.weight != null ? s.weight : (s.weightLeft || ''), rpe: s.rpe || null, done: !!s.done, bodyweight: !!s.bodyweight });
  }
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
    const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
    const newSet = ex.isUnilateral
      ? (isReps
          ? { reps: set.reps || '', weightLeft: set.weightLeft || '', weightRight: set.weightRight || '', rpe: null, done: false }
          : { repsLeft: set.repsLeft || '', repsRight: set.repsRight || '', rpe: null, done: false })
      : { reps: set.reps || '', weight: set.weight || '', rpe: null, done: false };
    ex.sets.push(newSet);
  }
  liveRenderExercises();
  liveSaveDraft();
  liveRestStart();
}

// --- Rest timer ---
function liveRestStart() {
  liveRestRemaining = liveRestTotal;
  liveRestDismiss(); // clear any existing
  const overlay = document.getElementById('live-rest-overlay');
  overlay.style.display = '';
  liveRestRenderPresets();
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
function liveRestPreset(seconds) {
  const sec = Math.max(15, Math.min(600, parseInt(seconds) || 90));
  liveRestTotal = sec;
  try { localStorage.setItem('ta_live_rest_default', String(sec)); } catch(e) {}
  liveRestStart();
}
function liveRestRenderPresets() {
  document.querySelectorAll('[data-action="liveRestPreset"]').forEach(btn => {
    const v = parseInt(btn.dataset.rest);
    btn.classList.toggle('active', v === liveRestTotal);
  });
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
    const isReps = param === 'reps';
    const uni = !!ex.isUnilateral;
    const perSide = ex.weightMode === 'per_side';
    const bw = ex.barbellWeight || 0;
    const weightSuffix = perSide ? '/lato' : '';
    const barbellTag = bw ? `<div class="barbell-tag">+ ${bw}kg bilanciere</div>` : '';
    const lastSet0 = ex.lastPerf?.sets[0];
    let lastStr = '';
    if (ex.lastPerf && lastSet0) {
      if (lastSet0.repsLeft != null || lastSet0.repsRight != null) {
        lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x SX ${lastSet0.repsLeft||'?'} / DX ${lastSet0.repsRight||'?'} ${paramLabel}`;
      } else if (lastSet0.weightLeft != null || lastSet0.weightRight != null) {
        lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x${lastSet0.reps||'?'} @ SX ${lastSet0.weightLeft||'?'} / DX ${lastSet0.weightRight||'?'} kg`;
      } else {
        lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x${lastSet0.reps||'?'} @ ${lastSet0.weight||'?'}kg`;
      }
    }

    let setsHTML = ex.sets.map((s, sIdx) => {
      const doneClass = s.done ? ' done' : '';
      const actionBtn = s.done
        ? `<span class="set-done-check">&#10003;</span>`
        : `<button class="btn-fatto" data-live-done="${exIdx}-${sIdx}">Fatto</button>`;
      const repsInput = (uni && !isReps)
        ? `<div class="weight-uni">
             <input type="number" placeholder="${paramPh} SX" value="${s.repsLeft||''}" data-live-set="${exIdx}-${sIdx}-repsLeft" class="w-uni">
             <input type="number" placeholder="${paramPh} DX" value="${s.repsRight||''}" data-live-set="${exIdx}-${sIdx}-repsRight" class="w-uni">
           </div>`
        : `<input type="number" placeholder="${paramPh}" value="${s.reps||''}" data-live-set="${exIdx}-${sIdx}-reps">`;
      const kgPlaceholder = isReps ? `Kg${weightSuffix}` : 'Kg (opz.)';
      const bwChecked = s.bodyweight ? 'checked' : '';
      const bwToggle = uni ? '' : `<label class="bw-toggle" title="Corpo libero (peso = zavorra aggiunta)"><input type="checkbox" data-live-set="${exIdx}-${sIdx}-bodyweight" ${bwChecked}><span>BW</span></label>`;
      const weightInputs = uni
        ? `<div class="weight-uni">
             <input type="number" step="0.5" placeholder="SX" value="${s.weightLeft||''}" data-live-set="${exIdx}-${sIdx}-weightLeft" class="w-uni">
             <input type="number" step="0.5" placeholder="DX" value="${s.weightRight||''}" data-live-set="${exIdx}-${sIdx}-weightRight" class="w-uni">
           </div>`
        : `<input type="number" step="0.5" placeholder="${kgPlaceholder}" value="${s.weight||''}" data-live-set="${exIdx}-${sIdx}-weight">`;
      const dropsHTML = (!uni && Array.isArray(s.drops) && s.drops.length)
        ? s.drops.map((d, dIdx) => `<div class="drop-inline">
            <span class="drop-arrow">&#8627;</span>
            <input type="number" placeholder="Reps" value="${d.reps||''}" data-live-drop="${exIdx}-${sIdx}-${dIdx}-reps">
            <input type="number" step="0.5" placeholder="Kg" value="${d.weight||''}" data-live-drop="${exIdx}-${sIdx}-${dIdx}-weight">
            <button class="btn-icon" data-live-remove-drop="${exIdx}-${sIdx}-${dIdx}" title="Rimuovi drop">&times;</button>
          </div>`).join('')
        : '';
      const dropAddBtn = uni ? '' : `<button class="btn-link-sm" data-live-add-drop="${exIdx}-${sIdx}" title="Aggiungi un drop set">+ drop</button>`;
      return `<div class="set-block">
        <div class="set-inline${doneClass}">
          <div class="set-num">${sIdx+1}</div>
          ${repsInput}
          ${bwToggle}
          ${weightInputs}
          <select data-live-set="${exIdx}-${sIdx}-rpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${s.rpe==n?'selected':''}>${n}</option>`).join('')}</select>
          ${actionBtn}
          <button class="btn-icon" data-live-remove-set="${exIdx}-${sIdx}">&#128465;</button>
        </div>
        ${dropsHTML}
        ${dropAddBtn}
      </div>`;
    }).join('');

    const optsHTML = `
      <div class="weight-opts-summary">
        <span>${weightOptionsSummary(ex)}</span>
        <button type="button" class="btn-link-sm" data-wopts-toggle="live-wopts-${exIdx}">Modifica</button>
      </div>
      ${weightOptionsOverrideHTML(ex, exIdx, 'live')}
    `;

    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><span class="exercise-card-muscle">${ex.muscle}</span><button class="btn-icon" data-live-remove-ex="${exIdx}" style="margin-left:auto">&times;</button></div>
      ${lastStr ? `<div style="font-size:.75rem;color:var(--text2);margin-bottom:6px">${lastStr}</div>` : ''}
      ${optsHTML}
      ${barbellTag}
      ${setsHTML}
      <button class="btn btn-sm btn-secondary" data-live-add-set="${exIdx}" style="margin-top:4px">+ Serie</button>
    </div>`;
  }).join('');

  // Bind events
  container.querySelectorAll('[data-live-set]').forEach(el => {
    el.addEventListener('change', function() {
      const parts = this.dataset.liveSet.split('-');
      const exIdx = parseInt(parts[0]);
      const sIdx = parseInt(parts[1]);
      const field = parts.slice(2).join('-');
      const val = this.type === 'checkbox' ? this.checked : this.value;
      liveUpdateSet(exIdx, sIdx, field, val);
    });
  });
  container.querySelectorAll('[data-live-drop]').forEach(el => {
    el.addEventListener('change', function() {
      const parts = this.dataset.liveDrop.split('-');
      liveUpdateDrop(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), parts[3], this.value);
    });
  });
  container.querySelectorAll('[data-live-add-drop]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [ei, si] = this.dataset.liveAddDrop.split('-').map(Number);
      liveAddDrop(ei, si);
    });
  });
  container.querySelectorAll('[data-live-remove-drop]').forEach(btn => {
    btn.addEventListener('click', function() {
      const [ei, si, di] = this.dataset.liveRemoveDrop.split('-').map(Number);
      liveRemoveDrop(ei, si, di);
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
  container.querySelectorAll('[data-wopts-toggle]').forEach(btn => {
    btn.addEventListener('click', function() {
      const panel = document.getElementById(this.dataset.woptsToggle);
      if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
  });
  container.querySelectorAll('[data-wopt]').forEach(el => {
    el.addEventListener('change', function() {
      const [prefix, exIdxStr, field] = this.dataset.wopt.split('|');
      if (prefix !== 'live') return;
      const exIdx = parseInt(exIdxStr);
      liveUpdateWeightOption(exIdx, field, this.type === 'checkbox' ? this.checked : this.value);
    });
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
    let totalSets = 0;
    const doneOnly = liveSession.exercises.map(ex => ({
      ...ex,
      sets: (ex.sets || []).filter(s => s.done),
    }));
    doneOnly.forEach(ex => ex.sets.forEach(s => { if (s.reps > 0 || s.repsLeft > 0 || s.repsRight > 0) totalSets++; }));
    const tonnage = Math.round(calcTonnage(doneOnly, settingsCache?.bodyweight || 0));
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
      const isReps = (ex.param || wizGetParam(ex.name)) === 'reps';
      const sets = ex.sets
        .filter(s => s.done && ((s.reps > 0) || (s.repsLeft > 0) || (s.repsRight > 0)))
        .map(s => {
          let out;
          if (ex.isUnilateral) {
            out = isReps
              ? { reps: s.reps, weightLeft: s.weightLeft || 0, weightRight: s.weightRight || 0, rpe: s.rpe || null }
              : { repsLeft: s.repsLeft || 0, repsRight: s.repsRight || 0, rpe: s.rpe || null };
          } else {
            out = { reps: s.reps, weight: s.weight || 0, rpe: s.rpe || null };
            const drops = Array.isArray(s.drops)
              ? s.drops.filter(d => d.reps > 0).map(d => ({ reps: d.reps, weight: d.weight || 0 }))
              : [];
            if (drops.length) out.drops = drops;
          }
          if (s.bodyweight) out.bodyweight = true;
          return out;
        });
      if (sets.length) exercises.push({
        name: ex.name,
        muscle: ex.muscle,
        secondaryMuscles: Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [],
        weightMode: ex.weightMode || 'total',
        barbellWeight: ex.barbellWeight || null,
        isUnilateral: !!ex.isUnilateral,
        param: ex.param || wizGetParam(ex.name),
        sets
      });
    });
    if (!exercises.length) { toast('Nessuna serie completata!', 'error'); return; }
    const workout = { id: uid(), type: 'gym', date: liveSession.date, duration: durationMin, rpe, notes, exercises };
    workout._tonnage = calcTonnage(exercises, settingsCache?.bodyweight || 0);
    workout.scores = scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice = getAdvice(workout, workoutsCache, settingsCache);
    const saved = await saveWorkout(workout);
    if (saved && saved.id) workout.id = saved.id;
    workoutsCache.push(workout);
    toast('Palestra salvata! Score: ' + workout.scores.overall, 'success');
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
    workout.advice = getAdvice(workout, workoutsCache, settingsCache);
    const saved = await saveWorkout(workout);
    if (saved && saved.id) workout.id = saved.id;
    workoutsCache.push(workout);
    const sportName = tmpl?.name || liveSession.type;
    toast(sportName + ' salvato! Score: ' + workout.scores.overall, 'success');
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
  const workouts = [...workoutsCache].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Fase 5: i 4 contenitori dinamici (#dash-stats, #dash-streak, #dash-recovery,
  // #dash-recent) sono ora renderizzati dal componente Preact in
  // src/pages/Dashboard/Dashboard.jsx. Le chart legacy (heatmap, weekly, radar)
  // restano gestite imperativamente da charts.js qui sotto, fino a Fase 6/8.
  if (globalThis.Preact?.dashboard) {
    globalThis.Preact.dashboard.mount({
      workouts: workoutsCache,
      settings: settingsCache,
      muscleGroups,
    });
  }

  renderHeatmap(workouts);
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
  // Fase 6a: filters + list rendered by Preact. Filter button clicks are
  // handled below via delegation (filterHistory). Workout-item clicks reuse
  // the global delegation set up at the bottom of this file.
  if (globalThis.Preact?.history) {
    globalThis.Preact.history.mount({
      workouts: workoutsCache,
      filter: historyFilter,
      selectMode: _selectMode,
      selectedIds: [..._selectedIds],
    });
  }
  // Re-bind filter button delegation each render (Preact replaces nodes).
  const filtersEl = document.getElementById('history-filters');
  if (filtersEl) {
    filtersEl.querySelectorAll('[data-hist-filter]').forEach((btn) => {
      btn.addEventListener('click', function () { filterHistory(this.dataset.histFilter, this); });
    });
  }
}

// ==================== WORKOUT DETAIL ====================
function renderAiAnalysisSection(w) {
  const cached = w.aiAnalysis;
  const wid = String(w.id || '').replace(/"/g, '');
  let inner;
  if (cached) {
    const actions = `<button class="ana-regen" data-ai-regen="${wid}" title="Rigenera analisi" aria-label="Rigenera">↻</button>`;
    inner = renderAiAnalysis(cached, { title: 'Analisi AI', badge: 'AI', variant: 'ai', actions });
  } else {
    inner = `<div class="ana-empty">
      <div class="ana-empty-head">
        <span class="ana-title">Analisi AI</span>
        <span class="ana-badge">AI</span>
      </div>
      <p class="ana-empty-msg">Genera un'analisi personalizzata di questo allenamento confrontandolo con il tuo storico recente.</p>
      <button class="ana-cta" data-ai-analyze="${wid}"><span aria-hidden="true">✦</span> Analizza con AI</button>
    </div>`;
  }
  return `<div id="ai-analysis-section">${inner}</div>`;
}

async function handleAiAnalyzeClick(workoutId, force) {
  const w = workoutsCache.find(x => x.id === workoutId);
  if (!w) return;
  const section = document.getElementById('ai-analysis-section');
  if (section) {
    section.innerHTML = `<div class="ana-loading">
      <span class="ana-loading-spinner"></span>
      <span>Analisi in corso${force ? ' (rigenerazione)' : ''}…</span>
    </div>`;
  }
  try {
    const res = await api.analyzeWorkout(workoutId, { force: !!force });
    w.aiAnalysis = res.aiAnalysis;
    w.aiAnalysisGeneratedAt = res.aiAnalysisGeneratedAt;
    w.aiAnalysisModel = res.aiAnalysisModel;
    w.aiAnalysisVersion = res.aiAnalysisVersion;
    if (section) {
      section.outerHTML = renderAiAnalysisSection(w);
      bindAiAnalyzeButtons(w);
    }
    if (!res.cached) toast('Analisi AI generata', 'success');
  } catch (err) {
    const code = err?.code || err?.data?.error?.code || err?.data?.code;
    let msg = err?.message || 'Errore generando l\'analisi';
    if (code === 'ai_not_configured') msg = 'AI non configurata sul server';
    else if (code === 'ai_requires_premium') msg = 'L\'analisi AI richiede un piano premium';
    else if (code === 'ai_rate_limited') msg = 'Troppe analisi AI in poco tempo, riprova più tardi';
    else if (code === 'ai_parse_failed') msg = 'L\'AI ha risposto in formato non valido, riprova';
    if (section) {
      section.innerHTML = `<div class="ana-error">
        <p class="ana-error-msg">${msg.replace(/[<>]/g, '')}</p>
        <button class="ana-cta" data-ai-analyze="${String(workoutId).replace(/"/g, '')}">Riprova</button>
      </div>`;
      bindAiAnalyzeButtons(w);
    }
    toast(msg, 'error');
  }
}

function bindAiAnalyzeButtons(w) {
  document.querySelectorAll('[data-ai-analyze]').forEach(btn => {
    btn.onclick = () => handleAiAnalyzeClick(btn.dataset.aiAnalyze, false);
  });
  document.querySelectorAll('[data-ai-regen]').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); handleAiAnalyzeClick(a.dataset.aiRegen, true); };
  });
}

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
  // ===== ANALISI AUTOMATICA (regole espanse) =====
  // Se workout.advice è già un oggetto strutturato lo usiamo, altrimenti lo (ri)calcoliamo.
  let _advice = w.advice;
  if (!_advice || typeof _advice !== 'object' || Array.isArray(_advice)) {
    try { _advice = getAdvice(w, workoutsCache, settingsCache); w.advice = _advice; } catch (e) { _advice = null; }
  }
  if (_advice) html += renderAiAnalysis(_advice, { title: 'Analisi automatica' });
  // ===== ANALISI AI (on-demand, cached nel DB) =====
  html += renderAiAnalysisSection(w);
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
    const _libCache = exercisesCache || [];
    const _paramLabels = {reps:'Reps', duration:'Sec', distance:'m', calories:'Kcal'};
    (w.exercises||[]).forEach(ex=>{
      const wm = ex.weightMode || 'total';
      const bw = ex.barbellWeight || 0;
      const uni = !!ex.isUnilateral;
      const param = ex.param || _libCache.find(e=>e.name===ex.name)?.param || 'reps';
      const isReps = param === 'reps';
      const paramLabel = _paramLabels[param] || 'Reps';
      const dualParam = uni && !isReps;
      const tags = [];
      if (wm === 'per_side') tags.push('<span class="opt-tag">per lato</span>');
      if (bw) tags.push(`<span class="opt-tag">+${bw}kg bil.</span>`);
      if (uni) tags.push('<span class="opt-tag opt-tag-uni">unilaterale</span>');
      html+=`<div style="margin-top:10px"><strong style="font-size:.9rem">${ex.name}</strong> <span style="font-size:.75rem;color:var(--accent)">${ex.muscle||''}</span> ${tags.join(' ')}`;
      let header;
      if (dualParam) header = `<td>SX (${paramLabel})</td><td>DX (${paramLabel})</td>`;
      else if (uni)  header = `<td>${paramLabel}</td><td>SX</td><td>DX</td><td class="col-derived">Totale</td>`;
      else if (isReps) header = `<td>${paramLabel}</td><td>Peso</td><td class="col-derived">Effettivo</td>`;
      else           header = `<td>${paramLabel}</td>`;
      html+=`<table class="exercise-set-table" style="width:100%;font-size:.82rem;margin-top:4px;border-collapse:collapse"><tr style="color:var(--text2)"><td>Serie</td>${header}<td>RPE</td></tr>`;
      ex.sets.forEach((s,i)=>{
        let cells;
        if (dualParam) {
          cells = `<td>${s.repsLeft||0}</td><td>${s.repsRight||0}</td>`;
        } else if (uni) {
          const wL = (s.weightLeft || 0);
          const wR = (s.weightRight || 0);
          const effL = (wm === 'per_side' ? wL * 2 : wL) + bw;
          const effR = (wm === 'per_side' ? wR * 2 : wR) + bw;
          cells = `<td>${s.reps||0}</td><td>${wL} kg</td><td>${wR} kg</td><td class="col-derived">${Math.round((effL + effR) * 10) / 10} kg</td>`;
        } else if (isReps) {
          const base = s.weight || 0;
          const eff = (wm === 'per_side' ? base * 2 : base) + bw;
          const effStr = eff !== base ? `${Math.round(eff * 10) / 10} kg` : '--';
          cells = `<td>${s.reps||0}</td><td>${base}${wm === 'per_side' ? ' /lato' : ''} kg</td><td class="col-derived">${effStr}</td>`;
        } else {
          cells = `<td>${s.reps||0}</td>`;
        }
        html+=`<tr><td>${i+1}</td>${cells}<td>${s.rpe||'--'}</td></tr>`;
      });
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
  html+='</div>';
  document.getElementById('modal-body').innerHTML=html;

  // Render HR chart if data exists
  const hrCanvas=document.getElementById('modal-hr-chart');
  if(hrCanvas&&w.hrSeries?.length){
    new Chart(hrCanvas,{type:'line',data:{
      labels:w.hrSeries.map(p=>{const m=Math.floor(p.t/60);return m+'\'';} ),
      datasets:[{data:w.hrSeries.map(p=>p.hr),borderColor:'#DC2626',backgroundColor:'rgba(220,38,38,.1)',fill:true,
        borderWidth:1.5,pointRadius:0,tension:.3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{display:true,ticks:{maxTicksLimit:8,font:{size:10},color:'#B0B4BE'}},
          y:{display:true,ticks:{font:{size:10},color:'#B0B4BE'},title:{display:true,text:'bpm',font:{size:10}}}}}});
  }
  // Render elevation chart if data exists
  const eleCanvas=document.getElementById('modal-ele-chart');
  if(eleCanvas&&w.eleSeries?.length){
    new Chart(eleCanvas,{type:'line',data:{
      labels:w.eleSeries.map(p=>{const m=Math.floor(p.t/60);return m+'\'';} ),
      datasets:[{data:w.eleSeries.map(p=>p.ele),borderColor:'#10B981',backgroundColor:'rgba(16,185,129,.15)',fill:true,
        borderWidth:1.5,pointRadius:0,tension:.3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{display:true,ticks:{maxTicksLimit:8,font:{size:10},color:'#B0B4BE'}},
          y:{display:true,ticks:{font:{size:10},color:'#B0B4BE'},title:{display:true,text:'m',font:{size:10}}}}}});
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
  bindAiAnalyzeButtons(w);
  document.getElementById('workout-modal').classList.add('show');
}

function closeModal(){
  document.getElementById('workout-modal').classList.remove('show');
  // Restore default modal-header buttons visibility (some flows hide them)
  const editBtn = document.getElementById('modal-edit-btn');
  const delBtn = document.getElementById('modal-delete-btn');
  if (editBtn) editBtn.style.display = '';
  if (delBtn) delBtn.style.display = '';
}

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
      const uni = !!ex.isUnilateral;
      const wm = ex.weightMode || 'total';
      const bw = ex.barbellWeight || 0;
      const tags = [];
      if (wm === 'per_side') tags.push('<span class="opt-tag">per lato</span>');
      if (bw) tags.push(`<span class="opt-tag">+${bw}kg bil.</span>`);
      if (uni) tags.push('<span class="opt-tag opt-tag-uni">unilaterale</span>');
      const weightHeader = uni ? '<td>SX (kg)</td><td>DX (kg)</td>' : '<td>Peso (kg)</td>';
      html += `<div class="edit-exercise" style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:.85rem">${ex.name} <span style="color:var(--accent);font-size:.75rem">${ex.muscle||''}</span> ${tags.join(' ')}</strong>
          <button class="btn-icon edit-remove-exercise" data-ei="${ei}" title="Rimuovi">&times;</button>
        </div>
        <table style="width:100%;font-size:.82rem;border-collapse:collapse">
          <tr style="color:var(--text2)"><td>Serie</td><td>Reps</td>${weightHeader}<td>RPE</td><td></td></tr>`;
      (ex.sets || []).forEach((s, si) => {
        const weightCells = uni
          ? `<td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="weightLeft" value="${s.weightLeft||0}" min="0" step="0.5" style="width:60px"></td>
             <td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="weightRight" value="${s.weightRight||0}" min="0" step="0.5" style="width:60px"></td>`
          : `<td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="weight" value="${s.weight||0}" min="0" step="0.5" style="width:60px"></td>`;
        html += `<tr>
          <td>${si + 1}</td>
          <td><input type="number" class="edit-set-input" data-ei="${ei}" data-si="${si}" data-field="reps" value="${s.reps||0}" min="0" style="width:50px"></td>
          ${weightCells}
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
    html += renderMuscleChipsHTML('edit', Array.isArray(w.muscles) && w.muscles.length ? w.muscles : getDefaultMusclesForSport('running'));
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
    html += renderMuscleChipsHTML('edit', Array.isArray(w.muscles) && w.muscles.length ? w.muscles : getDefaultMusclesForSport(w.type));
  }

  // Notes
  html += `<div class="form-group" style="margin-top:12px"><label>Note</label><textarea id="edit-w-notes" rows="2" style="width:100%;border-radius:8px;padding:8px;background:var(--bg3);color:var(--text1);border:1px solid var(--bg3)">${w.notes||''}</textarea></div>`;

  // Save / Cancel buttons
  html += `<div style="display:flex;gap:8px;margin-top:16px">
    <button class="btn btn-primary" id="edit-w-save">Salva Modifiche</button>
    <button class="btn btn-secondary" id="edit-w-cancel">Annulla</button>
  </div></div>`;

  document.getElementById('modal-body').innerHTML = html;

  if (w.type !== 'gym') attachMuscleChipHandlers('edit');

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
        const ex = editExercises[ei];
        ex.sets.push(ex.isUnilateral ? { reps: 0, weightLeft: 0, weightRight: 0 } : { reps: 0, weight: 0 });
        w.exercises = editExercises;
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
      const libEntry = (exercisesCache || []).find(e => e.name === sel.value) || {};
      const uni = !!libEntry.isUnilateral;
      const newEx = {
        name: sel.value,
        muscle: opt.dataset.muscle || libEntry.muscle || '',
        weightMode: libEntry.weightMode || 'total',
        barbellWeight: libEntry.barbellWeight || null,
        isUnilateral: uni,
        sets: [uni ? { reps: 8, weightLeft: 0, weightRight: 0 } : { reps: 8, weight: 0 }]
      };
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
      updated._tonnage = calcTonnage(updated.exercises, settingsCache?.bodyweight || 0);
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

    if (w.type !== 'gym') {
      const picked = readMuscleChips('edit');
      if (picked.length) updated.muscles = picked;
      else delete updated.muscles;
    }

    // Recalculate scores
    updated.scores = scoreWorkout(updated, workoutsCache, settingsCache);
    updated.advice = getAdvice(updated, workoutsCache, settingsCache);

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

// ==================== WEIGHT / BODY MEASUREMENTS ====================
function renderWeightPage() {
  // Date default for the simple weight log
  const wd = document.getElementById('weight-date');
  if (wd && !wd.value) wd.value = todayStr();

  // BMI banner on the overview
  renderBmiBanner();

  // Delegate the rest to the measurements module
  renderMeasurementsPage({
    weights: weightsCache,
    settings: settingsCache,
    onChange: () => { renderMeasurementsPage({ weights: weightsCache, settings: settingsCache }); renderBmiBanner(); },
    onSave: syncSettingsFromMeasurement,
    toast,
  });

  // Prefill obiettivo / altezza inputs
  const tgt = document.getElementById('weight-target');
  if (tgt && settingsCache.weightTarget != null) tgt.value = settingsCache.weightTarget;
  const hIn = document.getElementById('weight-height');
  if (hIn && settingsCache.height != null) hIn.value = settingsCache.height;
}

function renderBmiBanner() {
  // Fase 6c: delegated to Preact (src/pages/Body/Body.jsx).
  globalThis.Preact?.body?.mountBmiBanner({ weights: weightsCache, settings: settingsCache });
}

async function saveWeight() {
  const date=document.getElementById('weight-date').value||todayStr();
  const value=parseFloat(document.getElementById('weight-value').value);
  if(!value){toast('Inserisci il peso!','error');return;}
  const saved = await api.post('/api/weights', { date, value });
  const entry = saved && saved.id ? saved : { id: uid(), date, value };
  const i = weightsCache.findIndex(w => w.date === entry.date);
  if (i >= 0) weightsCache[i] = entry; else weightsCache.push(entry);
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
}

function copyAppLink(){navigator.clipboard.writeText(window.location.href).then(()=>toast('Link copiato!')).catch(()=>toast('Errore copia','error'));}
function copyUID(){navigator.clipboard.writeText(currentUser?.uid||'').then(()=>toast('UID copiato!')).catch(()=>toast('Errore copia','error'));}

// Fitness assessment renders (legacy DOM versions) replaced by
// src/pages/Profile/Profile.jsx in Fase 6b. Old functions removed in Fase 8b.

// ==================== ATHLETIC DETAIL ====================
function openBodyPartModal(partKey) {
  const info = getBodyPartInfo(partKey, settingsCache);
  const modal = document.getElementById('workout-modal');
  if (!modal) return;
  document.getElementById('modal-title').textContent = info.title;
  // Hide workout-specific buttons (used only for workout edit/delete flow)
  const editBtn = document.getElementById('modal-edit-btn');
  const delBtn = document.getElementById('modal-delete-btn');
  if (editBtn) editBtn.style.display = 'none';
  if (delBtn) delBtn.style.display = 'none';
  document.getElementById('modal-body').innerHTML = `
    <div class="body-detail-row"><span>Valore corrente</span><strong>${info.valueStr}${info.delta || ''}</strong></div>
    <div class="body-detail-row"><span>Range tipico</span><strong>${info.idealStr}</strong></div>
    ${info.extra || ''}
    <div class="body-detail-explanation">${info.explanation}</div>
  `;
  modal.classList.add('show');
}

function renderAthleticDetail() {
  // Render body avatar (silhouette + side panel) at the top — imperative.
  const avatarEl = document.getElementById('body-avatar-container');
  if (avatarEl) renderBodyAvatar(avatarEl, settingsCache);

  // Fase 6b: metric cards + athletic fitness assessment renderizzati da Preact.
  // Il radar Chart.js resta imperative (richiede canvas + Chart instance lifecycle).
  const ctx = { workouts: workoutsCache, settings: settingsCache, weights: weightsCache, muscleGroups };
  let radarValues = null;
  if (globalThis.Preact?.profile) {
    const { radarValues: rv } = globalThis.Preact.profile.computeAthleticMetrics(ctx);
    radarValues = rv;
    globalThis.Preact.profile.mountAthletic(ctx);
  }

  // Radar chart (legacy Chart.js)
  destroyChart('radarDetail');
  const canvasCtx = document.getElementById('chart-radar-detail')?.getContext('2d');
  if (canvasCtx && radarValues) {
    const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isLight ? '#0E1014' : '#F4F5F8';
    const gridColor = isLight ? 'rgba(14,16,20,0.10)' : 'rgba(244,245,248,0.10)';
    storeChart('radarDetail', new Chart(canvasCtx, {
      type: 'radar',
      data: {
        labels: ['Forza', 'Resistenza', 'Consistenza', 'Recupero', 'Progressione', 'Varieta', 'Proporzioni'],
        datasets: [{
          label: 'Profilo',
          data: radarValues.map((v) => Math.round(v * 10) / 10),
          backgroundColor: 'rgba(225,29,44,0.15)',
          borderColor: '#E11D2C',
          pointBackgroundColor: '#E11D2C',
          pointBorderColor: '#fff',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, color: textColor, backdropColor: 'transparent' }, grid: { color: gridColor }, pointLabels: { color: textColor, font: { size: 13, family: 'Poppins' } } } },
        plugins: { legend: { display: false } },
      },
    }));
  }
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
        const wmTag = (e.weightMode==='per_side') ? `<span class="opt-tag">per lato</span>` : '';
        const bbTag = (e.barbellWeight) ? `<span class="opt-tag">+${e.barbellWeight}kg bil.</span>` : '';
        const uniTag = e.isUnilateral ? `<span class="opt-tag opt-tag-uni">unilaterale</span>` : '';
        const secMuscles = Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles.filter(Boolean) : [];
        const secTag = secMuscles.length ? `<span class="opt-tag" title="Muscoli secondari: ${secMuscles.join(', ')}">+${secMuscles.length} musc.</span>` : '';
        html+=`<div class="lib-item">
          <span class="lib-item-name">${e.name} ${paramTag}${wmTag}${bbTag}${uniTag}${secTag}</span>
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

function readLibWeightOptions() {
  const weightMode = document.getElementById('lib-weightmode')?.value || 'total';
  const barbellSel = document.getElementById('lib-barbell')?.value || '';
  let barbellWeight = null;
  if (barbellSel === 'custom') {
    const c = parseFloat(document.getElementById('lib-barbell-custom')?.value);
    barbellWeight = isFinite(c) && c > 0 ? c : null;
  } else if (barbellSel !== '') {
    barbellWeight = parseFloat(barbellSel) || null;
  }
  return { weightMode, barbellWeight };
}

async function addExerciseToLibrary(){
  const name=document.getElementById('lib-name').value.trim(),muscle=document.getElementById('lib-muscle').value;
  const param=document.getElementById('lib-param')?.value||'reps';
  if(!name){toast('Inserisci un nome!','error');return;}
  const lib=exercisesCache||[];
  if(lib.some(e=>e.name.toLowerCase()===name.toLowerCase())){toast('Esercizio gia presente!','error');return;}
  const opts = readLibWeightOptions();
  const isUnilateral = !!document.getElementById('lib-unilateral')?.checked;
  const secondaryMuscles = readLibSecondaryChips().filter(m => m && m !== muscle);
  lib.push({name,muscle,param,...opts,isUnilateral,secondaryMuscles});
  lib.sort((a,b)=>a.name.localeCompare(b.name));
  await saveExercisesToServer(lib);
  document.getElementById('lib-name').value='';
  const uniCb = document.getElementById('lib-unilateral'); if (uniCb) uniCb.checked = false;
  const wm = document.getElementById('lib-weightmode'); if (wm) wm.value = 'total';
  const bb = document.getElementById('lib-barbell'); if (bb) bb.value = '';
  const bbCustom = document.getElementById('lib-barbell-custom-group'); if (bbCustom) bbCustom.style.display = 'none';
  renderLibSecondaryChips([]);
  toast('Esercizio aggiunto!','success');
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
  const curWM = ex.weightMode || 'total';
  const curBW = ex.barbellWeight;
  const curUni = !!ex.isUnilateral;
  const barbellOpts = [{v:'',t:'Nessun bilanciere'},{v:'20',t:'Olimpico (20 kg)'},{v:'10',t:'EZ (10 kg)'},{v:'25',t:'Trap Bar (25 kg)'}];
  const preset = curBW!=null && barbellOpts.some(o=>o.v===String(curBW));
  const bSel = curBW==null ? '' : (preset ? String(curBW) : 'custom');
  const curParam = ex.param || 'reps';
  let html=`<div style="display:flex;flex-direction:column;gap:12px">
    <div class="form-group"><label>Nome</label><input type="text" id="edit-ex-name" value="${ex.name}"></div>
    <div class="form-group"><label>Gruppo Muscolare (primario)</label><select id="edit-ex-muscle">
      ${muscleGroups.map(m=>`<option value="${m}" ${m===ex.muscle?'selected':''}>${m}</option>`).join('')}
    </select></div>
    <div class="form-group">
      <label>Muscoli secondari (opzionale)</label>
      <div id="edit-ex-secondary-muscles" class="muscle-chips"></div>
    </div>
    <div class="form-group"><label>Parametro principale</label><select id="edit-ex-param">
      ${Object.entries(paramLabels).map(([k,v])=>`<option value="${k}" ${k===curParam?'selected':''}>${v}</option>`).join('')}
    </select></div>
    <div id="edit-ex-weight-options" style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group"><label>Modalita peso</label><select id="edit-ex-weightmode">
        <option value="total" ${curWM==='total'?'selected':''}>Peso totale</option>
        <option value="per_side" ${curWM==='per_side'?'selected':''}>Peso per lato</option>
      </select></div>
      <div class="form-group"><label>Bilanciere</label><select id="edit-ex-barbell">
        ${barbellOpts.map(o=>`<option value="${o.v}" ${o.v===bSel?'selected':''}>${o.t}</option>`).join('')}
        <option value="custom" ${bSel==='custom'?'selected':''}>Personalizzato...</option>
      </select></div>
      <div class="form-group" id="edit-ex-barbell-custom-group" style="${bSel==='custom'?'':'display:none'}">
        <label>Peso bilanciere (kg)</label>
        <input type="number" step="0.5" id="edit-ex-barbell-custom" value="${bSel==='custom'?curBW:''}">
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:6px;margin-bottom:0">
        <input type="checkbox" id="edit-ex-unilateral" ${curUni?'checked':''} style="width:auto">
        <span>Esercizio unilaterale (un lato alla volta)</span>
      </label>
    </div>
    <button class="btn btn-primary" id="edit-ex-save">Salva Modifiche</button>
  </div>`;
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-delete-btn').style.display='none';
  modal.classList.add('show');
  renderLibSecondaryChips(ex.secondaryMuscles || [], 'edit-ex-secondary-muscles', 'edit-ex-muscle');
  document.getElementById('edit-ex-muscle').addEventListener('change', () => {
    renderLibSecondaryChips(readLibSecondaryChips('edit-ex-secondary-muscles'), 'edit-ex-secondary-muscles', 'edit-ex-muscle');
  });
  const barbellSel = document.getElementById('edit-ex-barbell');
  const customGrp = document.getElementById('edit-ex-barbell-custom-group');
  barbellSel.addEventListener('change', () => { customGrp.style.display = barbellSel.value === 'custom' ? '' : 'none'; });
  document.getElementById('edit-ex-save').addEventListener('click', async ()=>{
    const newName=document.getElementById('edit-ex-name').value.trim();
    if(!newName){toast('Inserisci un nome!','error');return;}
    const newParam = document.getElementById('edit-ex-param').value;
    const weightMode = document.getElementById('edit-ex-weightmode').value || 'total';
    let barbellWeight = null;
    const bSelVal = document.getElementById('edit-ex-barbell').value;
    if (bSelVal === 'custom') {
      const c = parseFloat(document.getElementById('edit-ex-barbell-custom').value);
      barbellWeight = isFinite(c) && c > 0 ? c : null;
    } else if (bSelVal !== '') {
      barbellWeight = parseFloat(bSelVal) || null;
    }
    const isUnilateral = !!document.getElementById('edit-ex-unilateral').checked;
    const newMuscle = document.getElementById('edit-ex-muscle').value;
    const secondaryMuscles = readLibSecondaryChips('edit-ex-secondary-muscles').filter(m => m && m !== newMuscle);
    lib[idx]={name:newName, muscle:newMuscle, param:newParam, weightMode, barbellWeight, isUnilateral, secondaryMuscles};
    await saveExercisesToServer(lib);
    toast('Esercizio modificato!','success');
    closeModal();
    document.getElementById('modal-delete-btn').style.display='';
    renderExerciseLibrary();
  });
}
window.duplicateExercise = duplicateExercise;
window.editExercise = editExercise;

// Mirror the latest body measurement into Settings, so the static fields under
// "Corpo > Misure > Composizione corporea" reflect the most recent log without
// requiring the user to re-type them. PUT /api/settings is upsert/merge, so
// we only send the fields actually present in the measurement.
async function syncSettingsFromMeasurement(m) {
  if (!m || typeof m !== 'object') return;
  const FIELDS = [
    'circChest','circWaist','circHips','circShoulders','circBicep','circNeck','circThigh','circCalf',
    'bodyFat','skeletalMuscle','subcutaneousFat','visceralFat','bodyWater','muscleMass','boneMass','protein',
  ];
  const patch = {};
  for (const k of FIELDS) {
    if (m[k] != null) patch[k] = m[k];
  }
  if (!Object.keys(patch).length) return;
  settingsCache = { ...settingsCache, ...patch };
  try {
    await api.put('/api/settings', patch);
    populateSettingsUI();
  } catch (e) {
    console.error('syncSettingsFromMeasurement failed:', e);
  }
}

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
    // Composizione corporea (opzionale)
    bodyFat:parseFloat(document.getElementById('set-body-fat')?.value)||null,
    skeletalMuscle:parseFloat(document.getElementById('set-skeletal-muscle')?.value)||null,
    subcutaneousFat:parseFloat(document.getElementById('set-subcutaneous-fat')?.value)||null,
    visceralFat:parseFloat(document.getElementById('set-visceral-fat')?.value)||null,
    bodyWater:parseFloat(document.getElementById('set-body-water')?.value)||null,
    muscleMass:parseFloat(document.getElementById('set-muscle-mass')?.value)||null,
    boneMass:parseFloat(document.getElementById('set-bone-mass')?.value)||null,
    protein:parseFloat(document.getElementById('set-protein')?.value)||null,
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
  // Composizione corporea
  setVal('set-body-fat', s.bodyFat);
  setVal('set-skeletal-muscle', s.skeletalMuscle);
  setVal('set-subcutaneous-fat', s.subcutaneousFat);
  setVal('set-visceral-fat', s.visceralFat);
  setVal('set-body-water', s.bodyWater);
  setVal('set-muscle-mass', s.muscleMass);
  setVal('set-bone-mass', s.boneMass);
  setVal('set-protein', s.protein);
  if(s.activeSports) activeSports = s.activeSports;
  if(s.muscleGroups) muscleGroups = s.muscleGroups;
  populateMuscleSelect();
}

function populateMuscleSelect() {
  const sel = document.getElementById('lib-muscle');
  if (!sel) return;
  sel.innerHTML = muscleGroups.map(m => `<option value="${m}">${m}</option>`).join('');
  renderLibSecondaryChips([]);
  // Re-render secondary chips when primary changes (so we exclude current primary)
  if (!sel.dataset.bound) {
    sel.addEventListener('change', () => renderLibSecondaryChips(readLibSecondaryChips()));
    sel.dataset.bound = '1';
  }
}

function renderLibSecondaryChips(selected, containerId = 'lib-secondary-muscles', primaryId = 'lib-muscle') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const set = new Set(selected || []);
  const primary = document.getElementById(primaryId)?.value;
  const opts = muscleGroups.filter(m => m !== primary);
  el.style.display = 'flex';
  el.style.flexWrap = 'wrap';
  el.style.gap = '6px';
  el.style.marginTop = '6px';
  el.innerHTML = opts.map(m => `<button type="button" class="filter-btn ${set.has(m)?'active':''}" data-secondary-chip="${m}">${m}</button>`).join('');
  el.querySelectorAll('[data-secondary-chip]').forEach(b => {
    b.addEventListener('click', () => b.classList.toggle('active'));
  });
}

function readLibSecondaryChips(containerId = 'lib-secondary-muscles') {
  return Array.from(document.querySelectorAll(`#${containerId} [data-secondary-chip].active`))
    .map(b => b.dataset.secondaryChip);
}

// ==================== SPORTS MANAGER ====================
function renderSportsManager() {
  // Fase 6c: delegated to Preact (src/pages/Setup/Setup.jsx).
  globalThis.Preact?.setup?.mountSports({ activeSports });
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
  // Fase 6c: chip list delegated to Preact. populateMuscleSelect still
  // wires the legacy <select> dropdowns used by the wizard.
  globalThis.Preact?.setup?.mountMuscleGroups({ muscleGroups });
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
  // Default page e' Dashboard (index.html ha #page-dashboard.active hard-coded).
  // Senza questo attributo, i token v2 scoped a :root[data-active-page] non si
  // attivano al primo paint -> bug: refresh mostra stile legacy finche' l'utente
  // non clicca una tab (showPage lo setta).
  document.documentElement.dataset.activePage = 'dashboard';
  updateSyncStatus();
  renderDashboard();
  liveCheckDraft();
  // Persist wizard form fields on change
  ['wiz-date', 'wiz-notes', 'wiz-gym-duration', 'wiz-gym-rpe'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.draftBound) {
      el.addEventListener('change', () => wizSaveDraft());
      el.dataset.draftBound = '1';
    }
  });
  // Sport-specific fields are rendered dynamically; bind on change at render time via delegate
  document.addEventListener('change', (e) => {
    if (e.target?.id?.startsWith('wiz-field-')) wizSaveDraft();
  });
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

async function handleExportProfilePdf() {
  try {
    toast('Generazione PDF in corso…');
    const fitness = getFitnessAssessment(workoutsCache, settingsCache, weightsCache, muscleGroups);
    let aiSummary = null;
    try {
      aiSummary = await api.post('/api/profile/coach-summary', {});
    } catch (e) {
      console.warn('AI summary skipped:', e);
    }
    await exportProfilePdf({
      user: currentUser,
      settings: settingsCache,
      workouts: workoutsCache,
      weights: weightsCache,
      measurements: getMeasurements(),
      muscleGroups,
      fitness,
      aiSummary,
    });
    toast('PDF esportato!', 'success');
  } catch (e) {
    console.error('Export PDF error:', e);
    toast('Errore export PDF: ' + (e.message || 'imprevisto'), 'error');
  }
}
window.handleExportProfilePdf = handleExportProfilePdf;

async function deleteAccount() {
  if (!confirm("Eliminare definitivamente l'account?\n\nVerranno cancellati: tutti gli allenamenti, esercizi della libreria, misurazioni corporee, log peso, impostazioni e relazioni con altri utenti.\n\nL'azione è IRREVERSIBILE.")) return;
  const typed = prompt('Per confermare, scrivi ELIMINA in maiuscolo:');
  if (typed !== 'ELIMINA') { toast('Eliminazione annullata', 'error'); return; }
  try {
    await api.del('/api/users/me');
    try { await logout(); } catch (e) { /* token già invalido lato server */ }
    showScreen('login');
    setupLoginUI();
    toast('Account eliminato', 'success');
  } catch (e) {
    toast('Errore: ' + (e.message || 'eliminazione fallita'), 'error');
  }
}
window.deleteAccount = deleteAccount;
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
  // Navigation: click on any element with data-page (delegated → works for dynamic content too)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    const page = btn.dataset.page;
    if (page) showPage(page);
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
    deleteAccount: () => deleteAccount(),
    exportProfilePdf: () => handleExportProfilePdf(),
    saveNutritionLog: () => saveNutritionLog(),
    saveSleepLog: () => saveSleepLog(),
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
    liveCancel: () => liveCancel(),
    liveOpenSheet: () => liveOpenSheet(),
    liveRestDismiss: () => liveRestDismiss(),
    liveResumeDraft: () => liveResumeDraft(),
    liveDiscardDraft: () => liveDiscardDraft(),
    wizResumeDraft: () => wizResumeDraft(),
    wizDiscardDraft: () => wizDiscardDraft(),
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    // Special handling for rest adjust (needs data-adj parameter)
    if (btn.dataset.action === 'liveRestAdjust') {
      liveRestAdjust(parseInt(btn.dataset.adj) || 0);
      return;
    }
    // Special handling for rest preset (needs data-rest parameter)
    if (btn.dataset.action === 'liveRestPreset') {
      liveRestPreset(parseInt(btn.dataset.rest) || 90);
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

  // Generic tab switcher (data-tab-group + data-tab)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab-group][data-tab]');
    if (!btn) return;
    showTab(btn.dataset.tabGroup, btn.dataset.tab);
  });

  // Body avatar — click on a silhouette part opens detail modal
  document.addEventListener('click', (e) => {
    const part = e.target.closest('.body-avatar-svg [data-body-part]');
    if (!part) return;
    openBodyPartModal(part.dataset.bodyPart);
  });

  // Log-tab switcher on body/quicklog (Peso / Misurazione completa) — nested tabs
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bm-logtab]');
    if (!btn) return;
    const tab = btn.dataset.bmLogtab;
    document.querySelectorAll('[data-bm-logtab]').forEach(b => b.classList.toggle('active', b === btn));
    const wrapW = document.getElementById('bm-logtab-weight');
    const wrapF = document.getElementById('bm-logtab-full');
    if (wrapW) wrapW.style.display = tab === 'weight' ? '' : 'none';
    if (wrapF) wrapF.style.display = tab === 'full' ? '' : 'none';
  });

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

  // Exercise library weight options: always shown (kg also valid for duration/distance/calories)
  const libBarbell = document.getElementById('lib-barbell');
  const libBarbellCustom = document.getElementById('lib-barbell-custom-group');
  if (libBarbell && libBarbellCustom) {
    libBarbell.addEventListener('change', () => {
      libBarbellCustom.style.display = libBarbell.value === 'custom' ? '' : 'none';
    });
  }

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
    setupAdminGating(user);
    showScreen('app');
    await loadAllData();
  },
  () => {
    showScreen('login');
    setupLoginUI();
  }
);
