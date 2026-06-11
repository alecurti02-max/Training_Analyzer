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
import { syncFromLegacy } from '../src/lib/dataSync';
import { initialSegment, syncUrl, initRouter } from '../src/lib/router';

// ==================== GLOBAL STATE ====================
let currentUser = null;
let workoutsCache = [], settingsCache = {}, exercisesCache = null, weightsCache = [];
const EXERCISES_LOAD_FAILED = Symbol('exercises_load_failed');
let followingCache = {};
let activeSports = ['gym','running'];
let muscleGroups = [...DEFAULT_MUSCLES];
let isOnline = navigator.onLine;

// Il Train (wizard + live) è interamente Preact (src/pages/Train/): il vecchio
// blocco legacy (stato, wizard, live session) è stato rimosso.

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

// N1/N2: niente più pagine Progressi (→ Dashboard·Analisi + Profilo·Atletica)
// e Recupero (→ tab di Corpo). Ordine = nav per frequenza d'uso (N3).
const pageMap = {dashboard:'Dashboard',train:'Allenamento',history:'Storico',body:'Corpo',profile:'Profilo',setup:'Setup',clienti:'Clienti',admin:'Admin'};

// Old slugs → new page + tab (for backward compat with internal data-page="X" links and bookmarks)
const PAGE_ALIAS = {
  log:      { page: 'train',     tab: 'manual' },
  live:     { page: 'train',     tab: 'live' },
  athletic: { page: 'profile',   tab: 'athletic' },   // N2: era progress
  weight:   { page: 'body',      tab: 'quicklog' },
  library:  { page: 'setup',     tab: 'library' },
  import:   { page: 'setup',     tab: 'import' },
  settings: { page: 'setup',     tab: 'settings' },
  friends:  { page: 'profile',   tab: 'friends' },
  analisi:  { page: 'dashboard', tab: 'analisi' },
  // Pagine rimosse → destinazioni nuove (vecchi URL/bookmark continuano a funzionare)
  progress: { page: 'dashboard', tab: 'analisi' },    // N2
  recovery: { page: 'body',      tab: 'nutrition' },  // N1
};

// Default tab per consolidated page (used when no localStorage value)
const PAGE_DEFAULT_TAB = {
  dashboard: 'overview',
  train:     'manual',
  body:      'quicklog',
  profile:   'me',
  setup:     'library',
};

function showPage(page) {
  // Redirect old slugs to consolidated page+tab
  if (PAGE_ALIAS[page]) {
    const a = PAGE_ALIAS[page];
    showPage(a.page);
    if (a.tab) showTab(a.page, a.tab);
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
  // Router: allinea l'URL al path canonico della pagina (pushState solo se
  // cambia; i popstate arrivano già col path giusto → niente entry doppi).
  syncUrl(page);
  // Stato active su top-nav e bottom-nav mobile (entrambe usano data-page).
  document.querySelectorAll('.nav-btn, .lay-bottomnav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.page === page);
  });
  if(page==='dashboard') renderDashboard();
  if(page==='history') renderHistory();
  if(page==='body') {
    // Corpo (BodyPage .tsx, wrap) — ingloba anche Alimentazione/Sonno (N1, ex
    // Recupero): recovery.js popola i suoi id dentro i tab. Dopo il primo mount
    // il DOM è nuovo: riaggancia i listener diretti.
    if (mountPageHost('body')) wireDirectInputListeners();
    renderWeightPage(); populateSettingsUI();
    renderRecoveryPage({ settings: settingsCache, toast });
  }
  if(page==='profile') {
    // Profilo (ProfilePage .tsx, wrap) — ingloba anche l'Atletica (N2, ex
    // Progressi): renderAthleticDetail popola avatar/radar/card nel tab.
    if (mountPageHost('profile')) wireDirectInputListeners();
    renderProfile(); renderFriendsPageLocal();
    renderAthleticDetail();
  }
  if(page==='train') {
    // Train è solo Preact (il fallback legacy è stato rimosso). Early-return:
    // la pagina possiede i propri tab, salta il restore PAGE_DEFAULT_TAB.
    mountTrainPreactIfEnabled();
    return;
  }
  if(page==='setup') {
    // Setup migrato a route .tsx (SetupPage, wrap). Riaggancia drop zone, file
    // input, lib-filter, lib-barbell, import-json e data-settings sul DOM nuovo.
    if (mountPageHost('setup')) wireDirectInputListeners();
    renderExerciseLibrary(); renderMuscleGroupsManager(); populateMuscleSelect();
    populateSettingsUI(); renderSportsManager(); renderNotifications();
  }
  if(page==='clienti') {
    // Area PT (CRM) — Preact-only, route .tsx (ClientiPage). Nav gated al boot
    // su trainerProfile; chi arriva via URL senza ruolo vede l'empty-state.
    mountPageHost('clienti');
  }
  if(page==='admin') {
    // Admin migrato a route .tsx (AdminPage, wrap): scheletro in Preact, dati
    // popolati da admin.js::renderAdmin dopo il mount. Markup legacy rimosso una
    // volta per evitare id duplicati.
    if (globalThis.Preact?.admin) {
      const adminPageEl = document.getElementById('page-admin');
      let adminHost = document.getElementById('admin-host');
      if (!adminHost && adminPageEl) {
        adminPageEl.innerHTML = '';
        adminHost = document.createElement('div');
        adminHost.id = 'admin-host';
        adminPageEl.appendChild(adminHost);
      }
      globalThis.Preact.admin.mount({ host: adminHost });
    }
    renderAdmin();
  }
  // Restore last-active sub-tab (if any)
  if (PAGE_DEFAULT_TAB[page]) {
    let savedTab;
    try { savedTab = localStorage.getItem('ta_tab_' + page); } catch(e) {}
    showTab(page, savedTab || PAGE_DEFAULT_TAB[page]);
  }
}

// Monta una pagina migrata a route .tsx nel suo host (#<page>-host), rimuovendo
// il markup legacy di #page-<page> una volta (evita id duplicati). Ritorna true
// se Preact ha preso la pagina; false (fallback legacy intatto) se il bundle
// Preact non è caricato.
function mountPageHost(page) {
  const bridge = globalThis.Preact?.[page];
  if (!bridge || typeof bridge.mount !== 'function') return false;
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return false;
  let host = document.getElementById(page + '-host');
  if (!host) {
    pageEl.innerHTML = '';
    host = document.createElement('div');
    host.id = page + '-host';
    pageEl.appendChild(host);
  }
  bridge.mount({ host });
  return true;
}

// ==================== DIRECT INPUT WIRING (ri-eseguibile) ====================
// Listener DIRETTI (non delegati su document) su elementi dentro le pagine.
// Storicamente cablati una volta al DOMContentLoaded sul markup statico di
// index.html; le pagine migrate a Preact ricreano il proprio DOM al primo
// mount, quindi questa funzione viene richiamata dopo ogni mount. Idempotente:
// ogni elemento cablato viene marcato con data-ta-wired.
function wireDirectInputListeners() {
  const fresh = (id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.taWired) return null;
    el.dataset.taWired = '1';
    return el;
  };

  // Import JSON file input (Setup → Export/Backup)
  const importJsonInput = fresh('import-json');
  if (importJsonInput) {
    importJsonInput.addEventListener('change', (e) => {
      if (e.target.files[0]) window.importJSONBackup(e.target.files[0]);
    });
  }

  // Settings auto-save on change (Setup → Profilo Atletico, Body → Misure)
  document.querySelectorAll('[data-settings]').forEach(input => {
    if (input.dataset.taWired) return;
    input.dataset.taWired = '1';
    input.addEventListener('change', () => saveSettings());
  });

  // Weight target and height inputs (save on change)
  const weightTarget = fresh('weight-target');
  if (weightTarget) weightTarget.addEventListener('change', () => saveWeightTarget());
  const weightHeight = fresh('weight-height');
  if (weightHeight) weightHeight.addEventListener('change', () => saveWeightHeight());

  // Drag & Drop zones + click-to-open file picker (Setup → Import)
  const dropFileMap = { 'gpx-drop': 'gpx-file', 'csv-drop': 'csv-file', 'health-drop': 'health-file', 'fit-drop': 'fit-file' };
  Object.entries(dropFileMap).forEach(([dropId, fileId]) => {
    const el = fresh(dropId); if (!el) return;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      if (dropId === 'gpx-drop') window.handleGPXFiles(e.dataTransfer.files);
      else if (dropId === 'csv-drop') window.handleCSVFile(e.dataTransfer.files[0]);
      else if (dropId === 'health-drop') window.handleAppleHealthFile(e.dataTransfer.files[0]);
      else if (dropId === 'fit-drop') window.handleFITFile(e.dataTransfer.files[0]);
    });
    el.addEventListener('click', () => document.getElementById(fileId)?.click());
  });

  // File inputs
  const gpxInput = fresh('gpx-file');
  if (gpxInput) gpxInput.addEventListener('change', (e) => window.handleGPXFiles(e.target.files));
  const csvInput = fresh('csv-file');
  if (csvInput) csvInput.addEventListener('change', (e) => window.handleCSVFile(e.target.files[0]));
  const healthInput = fresh('health-file');
  if (healthInput) healthInput.addEventListener('change', (e) => window.handleAppleHealthFile(e.target.files[0]));
  const fitInput = fresh('fit-file');
  if (fitInput) fitInput.addEventListener('change', (e) => window.handleFITFile(e.target.files[0]));

  // Friend search input (Profilo → Amici)
  const friendSearch = fresh('friend-search');
  if (friendSearch) friendSearch.addEventListener('input', (e) => searchUsersAPI(e.target.value));

  // Exercise library filter (Setup → Libreria)
  const libFilter = fresh('lib-filter');
  if (libFilter) libFilter.addEventListener('input', () => renderExerciseLibrary());

  // Barbell custom weight toggle (Setup → Libreria)
  const libBarbell = fresh('lib-barbell');
  const libBarbellCustom = document.getElementById('lib-barbell-custom-group');
  if (libBarbell && libBarbellCustom) {
    libBarbell.addEventListener('change', () => {
      libBarbellCustom.style.display = libBarbell.value === 'custom' ? '' : 'none';
    });
  }
}

// ==================== TRAIN (Preact, default-on) ====================
// The Train page is rendered by the Preact tree (src/pages/Train) by default.
// The legacy wizard/live functions remain in this file as a dark-launched
// fallback: set localStorage.ta_train_preact = '0' (kill-switch) to restore the
// vanilla path with no reload. The legacy #page-train markup is hidden (not
// removed) so the switch works both ways. Returns true if Preact took over.
function trainPreactEnabled() {
  try { return localStorage.getItem('ta_train_preact') !== '0' && !!globalThis.Preact?.train; } catch (e) { return !!globalThis.Preact?.train; }
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
  // Render on-demand per i tab fusi (N1/N2): i renderer legacy popolano i
  // container quando il tab diventa visibile (i canvas Chart.js disegnati da
  // nascosti hanno dimensioni nulle).
  if (group === 'dashboard' && tab === 'analisi') renderProgress();
  if (group === 'dashboard' && tab === 'overview') {
    // Tornando alla Panoramica da Analisi i canvas potrebbero essere stati
    // disegnati da nascosti (dimensioni nulle): ridisegna.
    const sortedW = [...workoutsCache].sort((a, b) => new Date(b.date) - new Date(a.date));
    renderHeatmap(sortedW); renderWeeklyChart(sortedW); renderRadarChart(sortedW);
  }
  if (group === 'body' && (tab === 'nutrition' || tab === 'sleep')) {
    renderRecoveryPage({ settings: settingsCache, toast });
  }
  if (group === 'profile' && tab === 'athletic') renderAthleticDetail();
  // Persist
  try { localStorage.setItem('ta_tab_' + group, tab); } catch(e) {}
}

function onDataChanged() {
  // Fase 7a: mirror unidirezionale dei let-cache legacy nei signal store
  // (src/store/*). Additivo — i lettori signal arriveranno nei PR successivi.
  // Eseguito prima dell'early-return così i signal restano sempre in pari.
  syncFromLegacy({
    workouts: workoutsCache, settings: settingsCache, exercises: exercisesCache,
    weights: weightsCache, following: followingCache, activeSports, muscleGroups,
  });
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-dashboard') renderDashboard();
  if (id === 'page-history') renderHistory();
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

// ==================== DASHBOARD ====================
function renderDashboard() {
  if (!globalThis.Preact?.dashboard) return;
  const pageEl = document.getElementById('page-dashboard');
  if (!pageEl) return;
  const workouts = [...workoutsCache].sort((a, b) => new Date(b.date) - new Date(a.date));
  // Dashboard migrata a route .tsx autonoma (DashboardPage): possiede tutto il
  // markup, canvas inclusi. Il markup legacy di #page-dashboard viene rimosso
  // una volta (evita id-canvas duplicati), poi si monta la pagina in un host.
  let host = document.getElementById('dashboard-host');
  if (!host) {
    pageEl.innerHTML = '';
    host = document.createElement('div');
    host.id = 'dashboard-host';
    pageEl.appendChild(host);
  }
  globalThis.Preact.dashboard.mount({ host });
  // I canvas ora vivono dentro DashboardPage: charts.js li trova dopo il mount.
  renderHeatmap(workouts);
  renderWeeklyChart(workouts);
  renderRadarChart(workouts);
  updateTelemetryTicker();
}

// Telemetry ticker (skin Carbon): nastro dati live sotto la nav, agganciato
// alle cache reali. Aggiornato a ogni render della Dashboard.
function updateTelemetryTicker() {
  const track = document.getElementById('app-ticker-track');
  if (!track) return;
  const now = todayStr();
  const l7 = workoutsCache.filter(w => daysBetween(now, w.date) <= 7);
  const l30 = workoutsCache.filter(w => daysBetween(now, w.date) <= 30);
  const seg = [];
  if (!workoutsCache.length) {
    seg.push('<b>●</b> Telemetria', 'Registra il primo allenamento per attivare i dati live');
  } else {
    const streak = calculateStreak(workoutsCache).current;
    const goal = settingsCache?.weekgoal || 4;
    const weekKm = Math.round(l7.filter(w => w.type === 'running').reduce((s, w) => s + (w.distance || 0), 0) * 10) / 10;
    const weekT = Math.round(l7.filter(w => w.type === 'gym').reduce((s, w) => s + (w._tonnage || 0), 0) / 1000 * 10) / 10;
    const scored = l30.filter(w => w.scores?.overall);
    const avg30 = scored.length ? scored.reduce((s, w) => s + w.scores.overall, 0) / scored.length : 0;
    const last = [...workoutsCache].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    seg.push('<b>●</b> Live');
    seg.push(`Streak <b>${streak} gg</b>`);
    seg.push(`Settimana <b>${l7.length}/${goal}</b>`);
    if (avg30) seg.push(`Score 30gg <b>${avg30.toFixed(1)}</b>`);
    if (weekKm) seg.push(`Corsa 7gg <b>${weekKm} km</b>`);
    if (weekT) seg.push(`Tonnellaggio 7gg <b>${weekT} t</b>`);
    if (last) {
      const tn = SPORT_TEMPLATES[last.type]?.name || last.type;
      let d = '';
      if (last.type === 'running' && last.distance) d = `${last.distance} km`;
      else if (last.type === 'gym' && last._tonnage) d = `${Math.round(last._tonnage / 1000 * 10) / 10} t`;
      else if (last.avghr) d = `FC ${last.avghr}`;
      const sc = last.scores?.overall != null ? ` · <b>${last.scores.overall.toFixed(1)}</b>` : '';
      seg.push(`Ultimo · ${tn}${d ? ' · ' + d : ''}${sc}`);
    }
    seg.push(`Totale <b>${workoutsCache.length}</b>`);
    if (settingsCache?.maxhr) seg.push(`<span class="rl">▲ Redline ${settingsCache.maxhr} bpm</span>`);
  }
  const one = '<span class="seq">&nbsp;' + seg.join(' &nbsp;·&nbsp; ') + ' &nbsp;·&nbsp;&nbsp;</span>';
  track.innerHTML = one + one;
  requestAnimationFrame(() => {
    const w = track.scrollWidth / 2;
    if (w > 0) track.style.animationDuration = Math.max(24, Math.round(w / 55)) + 's';
  });
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
  // Storico migrato a pagina .tsx autonoma (HistoryPage): possiede markup,
  // filtro/selezione e legge i workout dal signal store. Montata in un host
  // dedicato; il markup legacy di #page-history viene nascosto (pattern Train).
  if (!globalThis.Preact?.history) return;
  const pageEl = document.getElementById('page-history');
  if (!pageEl) return;
  let host = document.getElementById('history-preact-host');
  if (!host) { host = document.createElement('div'); host.id = 'history-preact-host'; pageEl.appendChild(host); }
  Array.from(pageEl.children).forEach((c) => { c.style.display = c === host ? '' : 'none'; });
  globalThis.Preact.history.mount({ host });
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
    const _hr=getComputedStyle(document.documentElement).getPropertyValue('--redline').trim()||'#FF2D46';
    new Chart(hrCanvas,{type:'line',data:{
      labels:w.hrSeries.map(p=>{const m=Math.floor(p.t/60);return m+'\'';} ),
      datasets:[{data:w.hrSeries.map(p=>p.hr),borderColor:_hr,backgroundColor:_hr+'1A',fill:true,
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
    const _accRadar = getComputedStyle(document.documentElement).getPropertyValue('--pulse').trim() || '#00E5CE';
    storeChart('radarDetail', new Chart(canvasCtx, {
      type: 'radar',
      data: {
        labels: ['Forza', 'Resistenza', 'Consistenza', 'Recupero', 'Progressione', 'Varieta', 'Proporzioni'],
        datasets: [{
          label: 'Profilo',
          data: radarValues.map((v) => Math.round(v * 10) / 10),
          backgroundColor: _accRadar + '26',
          borderColor: _accRadar,
          pointBackgroundColor: _accRadar,
          pointBorderColor: isLight ? '#fff' : '#0A0C0E',
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
  const weightDateEl = document.getElementById('weight-date');
  if(weightDateEl) weightDateEl.value = todayStr();
  // Router: deep-link iniziale + back/forward. Lo slug del path viene validato
  // contro pageMap/PAGE_ALIAS; sconosciuto o '/' → dashboard (il default
  // hard-coded di index.html, con dataset.activePage per i token v2 scoped).
  initRouter(showPage);
  const seg = initialSegment();
  if (seg !== 'dashboard' && (pageMap[seg] || PAGE_ALIAS[seg])) {
    showPage(seg);
  } else {
    document.documentElement.dataset.activePage = 'dashboard';
    renderDashboard();
    syncUrl('dashboard');
  }
  updateSyncStatus();
  // (Draft check + bindings del wizard legacy rimossi: il Train Preact gestisce
  // da sé i draft wizDraft_<uid> / liveSession_<uid>.)
}

// ==================== BACKWARD COMPATIBILITY (window.*) ====================
// Expose key functions on window for any remaining inline onclick handlers
window.showPage = showPage;
window.showWorkoutDetail = showWorkoutDetail;
// Esposto per HistoryPage (.tsx): elimina N workout per id mantenendo in pari la
// cache legacy (workoutsCache) + i signal store (via onDataChanged → mirror).
window.deleteWorkoutsByIds = async (ids) => {
  if (!Array.isArray(ids) || !ids.length) return;
  let deleted = 0;
  for (const id of ids) {
    try { await api.del('/api/workouts/' + id); deleted++; } catch (e) { console.error('Delete error', id, e); }
  }
  workoutsCache = workoutsCache.filter((w) => !ids.includes(w.id));
  toast(deleted + ' allenamenti eliminati', 'success');
  onDataChanged();
};
window.filterHistory = filterHistory;
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
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const handler = actionMap[btn.dataset.action];
    if (handler) handler();
  });

  // Listener diretti su input/drop-zone (estratti in wireDirectInputListeners,
  // ri-eseguita dopo il mount delle pagine Preact che ricreano il DOM).
  wireDirectInputListeners();

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

  // (Drop zone, file input: in wireDirectInputListeners.)

  // Close search results on click outside
  document.addEventListener('click', e => {
    const searchResults = document.getElementById('friend-search-results');
    const searchInput = document.getElementById('friend-search');
    if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.className = 'search-results';
    }
  });

  // (Friend search, lib-filter, lib-barbell: in wireDirectInputListeners.)

  // (Exercise sheet: il bottom-sheet è reso dal Train Preact, niente listener legacy.)
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
    // Nav "Clienti" (area PT) solo per i trainer attivi (CRM F1).
    const navClienti = document.getElementById('nav-clienti');
    if (navClienti) navClienti.style.display = (user && user.trainerProfile && user.trainerProfile.status === 'active') ? '' : 'none';
    showScreen('app');
    await loadAllData();
    // Deep-link: se il router ha aperto una pagina diversa dalla dashboard,
    // ri-renderizzala ora che i dati sono caricati (loadAllData/onDataChanged
    // re-renderizza solo la pagina attiva "classica", e al boot le cache erano vuote).
    const curPage = document.documentElement.dataset.activePage;
    if (curPage && curPage !== 'dashboard') showPage(curPage);
  },
  () => {
    showScreen('login');
    setupLoginUI();
  }
);
