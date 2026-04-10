// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyBJR0Z5sUWl5vmsisWXO3juBwKcd2aBr98",
  authDomain: "training-analyzer-deb1f.firebaseapp.com",
  databaseURL: "https://training-analyzer-deb1f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "training-analyzer-deb1f",
  storageBucket: "training-analyzer-deb1f.firebasestorage.app",
  messagingSenderId: "599496272601",
  appId: "1:599496272601:web:b7c38d04b04273d9a86cc8"
};

// ==================== SPORT TEMPLATES ====================
const SPORT_TEMPLATES = {
  gym: { name:'Palestra', icon:'\u{1F3CB}', fixed:true, hasExercises:true,
    fields:['duration','rpe'] },
  running: { name:'Corsa', icon:'\u{1F3C3}', fixed:true,
    fields:['distance','duration','pace','avghr','maxhr','elevation','cadence','rpe','runType'] },
  karting: { name:'Karting', icon:'\u{1F3C1}',
    fields:['track','duration','laps','bestLap','avgLap','rpe'] },
  cycling: { name:'Ciclismo', icon:'\u{1F6B4}',
    fields:['distance','duration','avgSpeed','elevation','avghr','maxhr','rpe'] },
  swimming: { name:'Nuoto', icon:'\u{1F3CA}',
    fields:['distance','duration','laps','strokeType','rpe'] },
  hiking: { name:'Escursionismo', icon:'\u{1F97E}',
    fields:['distance','duration','elevation','avghr','rpe'] },
  boxing: { name:'Boxe', icon:'\u{1F94A}',
    fields:['rounds','duration','rpe'] },
  tennis: { name:'Tennis', icon:'\u{1F3BE}',
    fields:['sets','duration','rpe'] },
  padel: { name:'Padel', icon:'\u{1F3D3}',
    fields:['sets','duration','rpe'] },
  football: { name:'Calcio', icon:'\u26BD',
    fields:['duration','rpe'] },
  basketball: { name:'Basket', icon:'\u{1F3C0}',
    fields:['duration','rpe'] },
  crossfit: { name:'CrossFit', icon:'\u{1F4AA}',
    fields:['wodName','duration','rpe'] },
  yoga: { name:'Yoga', icon:'\u{1F9D8}',
    fields:['duration','yogaType','rpe'] },
  climbing: { name:'Arrampicata', icon:'\u{1F9D7}',
    fields:['routes','maxGrade','duration','rpe'] },
  skiing: { name:'Sci', icon:'\u26F7',
    fields:['runs','duration','verticalDrop','rpe'] },
  martial_arts: { name:'Arti Marziali', icon:'\u{1F94B}',
    fields:['rounds','duration','rpe'] },
  volleyball: { name:'Pallavolo', icon:'\u{1F3D0}',
    fields:['sets','duration','rpe'] },
  skateboard: { name:'Skateboard', icon:'\u{1F6F9}',
    fields:['duration','rpe'] },
  surf: { name:'Surf', icon:'\u{1F3C4}',
    fields:['duration','rpe'] },
  dance: { name:'Danza', icon:'\u{1F483}',
    fields:['duration','rpe'] }
};

const FIELD_DEFS = {
  distance: { label:'Distanza (km)', type:'number', step:'0.01', ph:'5.0' },
  duration: { label:'Durata (min)', type:'number', ph:'30' },
  pace: { label:'Pace (min/km)', type:'text', ph:'5:30' },
  avghr: { label:'FC Media (bpm)', type:'number', ph:'155' },
  maxhr: { label:'FC Max (bpm)', type:'number', ph:'180' },
  elevation: { label:'Dislivello (m)', type:'number', ph:'50' },
  cadence: { label:'Cadenza (spm)', type:'number', ph:'170' },
  rpe: { label:'RPE (1-10)', type:'number', min:1, max:10, ph:'6' },
  runType: { label:'Tipo corsa', type:'select', options:[
    {v:'easy',t:'Easy Run'},{v:'tempo',t:'Tempo Run'},{v:'interval',t:'Intervalli'},
    {v:'long',t:'Lunga'},{v:'recovery',t:'Recovery'},{v:'race',t:'Gara'}] },
  track: { label:'Circuito', type:'text', ph:'Nome circuito' },
  laps: { label:'Giri', type:'number', ph:'15' },
  bestLap: { label:'Miglior Giro (sec)', type:'number', step:'0.001', ph:'42.500' },
  avgLap: { label:'Giro Medio (sec)', type:'number', step:'0.001', ph:'44.200' },
  avgSpeed: { label:'Velocita Media (km/h)', type:'number', step:'0.1', ph:'25' },
  strokeType: { label:'Stile', type:'select', options:[
    {v:'freestyle',t:'Stile Libero'},{v:'backstroke',t:'Dorso'},{v:'breaststroke',t:'Rana'},{v:'butterfly',t:'Farfalla'},{v:'mixed',t:'Misto'}] },
  sets: { label:'Set giocati', type:'number', ph:'3' },
  rounds: { label:'Round', type:'number', ph:'5' },
  wodName: { label:'Nome WOD', type:'text', ph:'Fran' },
  yogaType: { label:'Tipo', type:'select', options:[
    {v:'vinyasa',t:'Vinyasa'},{v:'hatha',t:'Hatha'},{v:'ashtanga',t:'Ashtanga'},{v:'yin',t:'Yin'},{v:'other',t:'Altro'}] },
  routes: { label:'Vie completate', type:'number', ph:'5' },
  maxGrade: { label:'Grado max', type:'text', ph:'6a+' },
  runs: { label:'Discese', type:'number', ph:'8' },
  verticalDrop: { label:'Dislivello totale (m)', type:'number', ph:'3000' }
};

const DEFAULT_MUSCLES = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Quadricipiti','Femorali','Glutei','Polpacci','Addominali','Avambracci','Trapezio','Full Body'];

// ==================== STATE ====================
let db = null, currentUser = null;
let workoutsCache = [], settingsCache = {}, exercisesCache = null, weightsCache = [];
let followingCache = {}, publicUsersCache = {};
let activeSports = ['gym','running'];
let muscleGroups = [...DEFAULT_MUSCLES];
let isOnline = navigator.onLine;

window.addEventListener('online', () => { isOnline = true; updateSyncStatus(); });
window.addEventListener('offline', () => { isOnline = false; updateSyncStatus(); });

function updateSyncStatus() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (isOnline) { el.textContent = 'Sync OK'; el.className = 'sync-indicator sync-ok'; }
  else { el.textContent = 'Offline'; el.className = 'sync-indicator sync-offline'; }
}

// ==================== INIT FIREBASE ====================
function initFirebase() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebase.database().goOnline();
    showScreen('login');
    setupAuth();
  } catch(e) {
    console.error('Firebase init error:', e);
    document.getElementById('login-status').textContent = 'Errore connessione: ' + e.message;
  }
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

function setupAuth() {
  const loginBtn = document.getElementById('btn-google-login');
  const statusEl = document.getElementById('login-status');

  // Handle redirect result first (for mobile)
  firebase.auth().getRedirectResult().then(result => {
    if (result.user) {
      // User signed in via redirect
    }
  }).catch(err => {
    console.warn('Redirect result error (ignorable):', err.code);
  });

  loginBtn.onclick = () => {
    statusEl.textContent = 'Connessione in corso...';
    const provider = new firebase.auth.GoogleAuthProvider();
    if (isMobile()) {
      // Use redirect on mobile to avoid popup blockers
      firebase.auth().signInWithRedirect(provider);
    } else {
      firebase.auth().signInWithPopup(provider).catch(err => {
        // Fallback to redirect if popup fails
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
          firebase.auth().signInWithRedirect(provider);
        } else {
          statusEl.textContent = 'Errore: ' + err.message;
        }
      });
    }
  };

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      document.getElementById('nav-user').textContent = user.displayName || user.email;
      if (user.photoURL) {
        const avatar = document.getElementById('nav-avatar');
        avatar.src = user.photoURL;
        avatar.style.display = 'block';
      }
      showScreen('app');
      createUserProfile(user);
      subscribeToData();
    } else {
      currentUser = null;
      showScreen('login');
    }
  });
}

function createUserProfile(user) {
  const profileRef = db.ref('users/' + user.uid + '/profile');
  profileRef.once('value', snap => {
    if (!snap.exists()) {
      profileRef.set({
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString()
      });
    } else {
      profileRef.update({
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      });
    }
  });
  // Write to public directory for search
  db.ref('publicUsers/' + user.uid).set({
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    uid: user.uid
  });
  updatePublicStats();
}

function signOut() { firebase.auth().signOut(); }

function showScreen(name) {
  document.getElementById('screen-login').style.display = name === 'login' ? '' : 'none';
  document.getElementById('screen-app').style.display = name === 'app' ? '' : 'none';
  if (name === 'app') initApp();
}

// ==================== FIREBASE DATA LAYER ====================
function userRef(path) { return db.ref('users/' + currentUser.uid + '/' + path); }

function subscribeToData() {
  userRef('workouts').on('value', snap => {
    const data = snap.val();
    workoutsCache = data ? Object.values(data) : [];
    workoutsCache.forEach(w => {
      if (w.type === 'gym' && !w._tonnage) {
        let t = 0;
        (w.exercises||[]).forEach(ex => (ex.sets||[]).forEach(s => t += (s.reps||0)*(s.weight||0)));
        w._tonnage = t;
      }
    });
    onDataChanged();
  });

  userRef('settings').on('value', snap => {
    settingsCache = snap.val() || {};
    if (settingsCache.activeSports) activeSports = settingsCache.activeSports;
    if (settingsCache.muscleGroups) muscleGroups = settingsCache.muscleGroups;
    populateSettingsUI();
  });

  userRef('exercises').on('value', snap => {
    exercisesCache = snap.val();
    if (!exercisesCache) { exercisesCache = getDefaultExercises(); userRef('exercises').set(exercisesCache); }
    renderExerciseLibrary();
  });

  userRef('weights').on('value', snap => {
    const data = snap.val();
    weightsCache = data ? Object.values(data) : [];
    weightsCache.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (document.querySelector('#page-weight.active')) renderWeightPage();
  });

  userRef('weightTarget').on('value', snap => {
    const v = snap.val(); if (v) document.getElementById('weight-target').value = v;
  });
  userRef('heightCm').on('value', snap => {
    const v = snap.val(); if (v) document.getElementById('weight-height').value = v;
  });

  // Following
  userRef('following').on('value', snap => {
    followingCache = snap.val() || {};
    if (document.querySelector('#page-friends.active')) renderFriendsPage();
  });

  // Load public users for search (paginated, once)
  loadPublicUsers();
}

function saveWorkout(workout) {
  return userRef('workouts/' + workout.id).set(workout).then(() => updatePublicStats());
}
function deleteWorkout(id) {
  return userRef('workouts/' + id).remove().then(() => updatePublicStats());
}
function saveSettingsToFirebase(s) {
  settingsCache = s; return userRef('settings').set(s);
}
function saveExercisesToFirebase(lib) {
  exercisesCache = lib; return userRef('exercises').set(lib);
}

function updatePublicStats() {
  if (!currentUser) return;
  const now = todayStr();
  const last7 = workoutsCache.filter(w => daysBetween(now, w.date) <= 7);
  const avgScore = workoutsCache.length ? (workoutsCache.reduce((s,w) => s + (w.scores?.overall||0), 0) / workoutsCache.length).toFixed(1) : 0;
  const weekKm = last7.filter(w => w.type === 'running').reduce((s,w) => s + (w.distance||0), 0).toFixed(1);
  const weekTonnage = last7.filter(w => w.type === 'gym').reduce((s,w) => s + (w._tonnage||0), 0);
  userRef('publicStats').set({
    displayName: currentUser.displayName || '',
    photoURL: currentUser.photoURL || '',
    avgScore: parseFloat(avgScore), weekWorkouts: last7.length,
    weekKm: parseFloat(weekKm), weekTonnage: Math.round(weekTonnage),
    totalWorkouts: workoutsCache.length, updatedAt: new Date().toISOString()
  });
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

// ==================== HELPERS ====================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function toast(msg, type='') {
  const t = document.getElementById('toast');
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

function getUserActiveSports() {
  const sports = ['gym','running'];
  (settingsCache.activeSports || []).forEach(s => { if (!sports.includes(s)) sports.push(s); });
  return sports;
}

// ==================== SCORING ====================
function scoreGymWorkout(workout) {
  const scores = {};
  let tonnage = 0;
  (workout.exercises||[]).forEach(ex => (ex.sets||[]).forEach(s => { tonnage += (s.reps||0)*(s.weight||0); }));
  workout._tonnage = tonnage;
  const recentGym = workoutsCache.filter(w => w.type==='gym' && w.id!==workout.id).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
  const avgTonnage = recentGym.length ? recentGym.reduce((s,w)=>s+(w._tonnage||0),0)/recentGym.length : tonnage;
  scores.volume = avgTonnage > 0 ? Math.min(10,Math.max(1,Math.round((tonnage/avgTonnage)*7))) : 7;
  scores.intensity = Math.min(10, Math.round(workout.rpe||7));
  const muscles = new Set();
  (workout.exercises||[]).forEach(ex => { if(ex.muscle) muscles.add(ex.muscle); });
  scores.variety = Math.min(10, Math.max(3, muscles.size*2));
  let prog=0, tot=0;
  (workout.exercises||[]).forEach(ex => {
    const prev = recentGym.find(w => (w.exercises||[]).some(e => e.name===ex.name));
    if (prev) {
      const prevEx = prev.exercises.find(e => e.name===ex.name);
      if (Math.max(...(ex.sets||[]).map(s=>s.weight||0)) >= Math.max(...(prevEx.sets||[]).map(s=>s.weight||0))) prog++;
      tot++;
    }
  });
  scores.progression = tot > 0 ? Math.min(10,Math.round(5+(prog/tot)*5)) : 6;
  const dur = workout.duration||60;
  scores.duration = dur>=40&&dur<=90 ? 8 : (dur>=30&&dur<=120 ? 6 : 4);
  scores.overall = Math.round((scores.volume*.25+scores.intensity*.25+scores.progression*.25+scores.variety*.15+scores.duration*.1)*10)/10;
  return scores;
}

function scoreRunWorkout(workout) {
  const scores = {};
  const maxHR = settingsCache.maxhr || 190;
  const dist = workout.distance||0, dur = workout.duration||0;
  const pace = dur>0&&dist>0 ? (dur*60)/dist : 0;
  workout._pace = pace;
  const recentRuns = workoutsCache.filter(w=>w.type==='running'&&w.id!==workout.id).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
  const avgDist = recentRuns.length ? recentRuns.reduce((s,w)=>s+(w.distance||0),0)/recentRuns.length : dist;
  scores.distance = avgDist>0 ? Math.min(10,Math.max(3,Math.round((dist/avgDist)*7))) : 7;
  const avgPace = recentRuns.length ? recentRuns.reduce((s,w)=>s+(w._pace||0),0)/recentRuns.length : pace;
  scores.pace = (avgPace>0&&pace>0) ? Math.min(10,Math.max(3,Math.round((avgPace/pace)*7))) : 6;
  if (workout.avghr && pace>0) {
    const hrPct = workout.avghr/maxHR;
    scores.hrEfficiency = hrPct<.7?9 : hrPct<.8?7 : hrPct<.88?6 : 4;
  } else scores.hrEfficiency = 6;
  scores.effort = Math.min(10, workout.rpe||6);
  scores.overall = Math.round((scores.distance*.25+scores.pace*.3+scores.hrEfficiency*.25+scores.effort*.2)*10)/10;
  return scores;
}

function scoreKartWorkout(workout) {
  const scores = {};
  const recentKart = workoutsCache.filter(w=>w.type==='karting'&&w.id!==workout.id&&w.track===workout.track).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  if (workout.bestLap && workout.avgLap && workout.bestLap>0) {
    scores.consistency = Math.min(10,Math.max(3,Math.round((workout.bestLap/workout.avgLap)*10)));
  } else scores.consistency = 6;
  if (recentKart.length && workout.bestLap) {
    const prevBest = Math.min(...recentKart.map(w=>w.bestLap||999));
    scores.improvement = workout.bestLap<=prevBest ? 9 : Math.max(4,Math.round(9*(prevBest/workout.bestLap)));
  } else scores.improvement = 6;
  scores.effort = Math.min(10, workout.rpe||6);
  scores.overall = Math.round((scores.consistency*.35+scores.improvement*.4+scores.effort*.25)*10)/10;
  return scores;
}

function scoreGenericWorkout(workout) {
  const scores = {};
  scores.effort = Math.min(10, workout.rpe||6);
  const dur = workout.duration||30;
  scores.duration = dur>=20&&dur<=90 ? 7 : (dur>=10&&dur<=120 ? 5 : 3);
  scores.overall = Math.round((scores.effort*.6+scores.duration*.4)*10)/10;
  return scores;
}

function scoreWorkout(workout) {
  if (workout.type === 'gym') return scoreGymWorkout(workout);
  if (workout.type === 'running') return scoreRunWorkout(workout);
  if (workout.type === 'karting') return scoreKartWorkout(workout);
  return scoreGenericWorkout(workout);
}

function getAdvice(workout) {
  const advice = [], s = workout.scores||{};
  if (workout.type==='gym') {
    if(s.volume<5)advice.push("Volume basso. Prova ad aggiungere serie o peso.");
    if(s.volume>9)advice.push("Volume molto alto! Recupera adeguatamente.");
    if(s.intensity>=9)advice.push("Intensita molto alta. Non spingere cosi forte ogni sessione.");
    if(s.variety<=4)advice.push("Pochi gruppi muscolari. Bilancia meglio l'allenamento.");
    if(s.progression>=8)advice.push("Ottima progressione nei carichi!");
  }
  if (workout.type==='running') {
    if(s.hrEfficiency<5)advice.push("FC alta per il ritmo. Corri piu piano per efficienza aerobica.");
    if(s.pace>=8)advice.push("Ritmo eccellente!");
    if(s.distance>8&&s.effort>=8)advice.push("Corsa lunga e intensa. Prevedi recupero.");
  }
  if (workout.type==='karting') {
    if(s.consistency>=8)advice.push("Ottima costanza tra i giri!");
    if(s.consistency<5)advice.push("Grande differenza tra giri. Lavora sulla costanza.");
    if(s.improvement>=8)advice.push("Nuovo record sulla pista!");
  }
  if(!advice.length) advice.push("Buon allenamento! Continua con costanza.");
  return advice;
}

// ==================== RECOVERY ====================
function getRecoveryStatus() {
  const workouts = [...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const now = todayStr();
  const muscleRecovery = {};
  muscleGroups.filter(m=>m!=='Full Body').forEach(m => {
    let lastWorked=null, intensity=5;
    for(const w of workouts) {
      if(w.type!=='gym') continue;
      if((w.exercises||[]).some(e=>e.muscle===m)) { lastWorked=w.date; intensity=w.rpe||w.scores?.intensity||5; break; }
    }
    if(lastWorked) {
      const daysAgo=daysBetween(now,lastWorked);
      const recoveryDays=intensity>=8?3:intensity>=6?2:1.5;
      muscleRecovery[m]={daysAgo, pct:Math.min(100,Math.round((daysAgo/recoveryDays)*100)), lastWorked};
    } else muscleRecovery[m]={daysAgo:99, pct:100, lastWorked:null};
  });
  const last7=workouts.filter(w=>daysBetween(now,w.date)<=7);
  const totalLoad=last7.reduce((s,w)=>s+(w.rpe||w.scores?.overall||5),0);
  const generalFatigue=Math.min(100,Math.round(totalLoad*5));
  return { muscleRecovery, generalFatigue, suggestedRestDays:generalFatigue>80?2:generalFatigue>50?1:0, workoutsLast7:last7.length };
}

// ==================== STREAK ====================
function calculateStreak() {
  const dates = [...new Set(workoutsCache.map(w => w.date))].sort().reverse();
  if (!dates.length) return { current: 0, record: 0 };
  let current = 0, checkDate = new Date(todayStr());
  for (let i = 0; i < 400; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (dates.includes(dateStr)) current++;
    else if (i > 0) break;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  let record = 0, streak = 0;
  const allDates = [...new Set(workoutsCache.map(w => w.date))].sort();
  for (let i = 0; i < allDates.length; i++) {
    streak = (i === 0) ? 1 : (daysBetween(allDates[i], allDates[i-1]) === 1 ? streak + 1 : 1);
    if (streak > record) record = streak;
  }
  return { current, record };
}

// ==================== NAVIGATION ====================
const pageMap = {dashboard:'Dashboard',log:'Log',history:'Storico',progress:'Progressi',weight:'Peso',import:'Import',friends:'Amici',settings:'Impostazioni',profile:'Profilo'};

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
  if(page==='settings') { populateSettingsUI(); renderExerciseLibrary(); renderSportsManager(); renderMuscleGroupsManager(); }
  if(page==='profile') renderProfile();
  if(page==='log') initLogWizard();
  if(page==='friends') renderFriendsPage();
}

// ==================== LOG WIZARD ====================
let wizStep = 1, wizType = '', wizExercises = [];

function initLogWizard() {
  wizStep = 1; wizType = ''; wizExercises = [];
  document.getElementById('wiz-date').value = todayStr();
  document.getElementById('wiz-exercises').innerHTML = '';
  document.getElementById('wiz-notes').value = '';
  renderSportTypeGrid();
  updateWizStep();
}

function renderSportTypeGrid() {
  const sports = getUserActiveSports();
  const grid = document.getElementById('sport-type-grid');
  grid.innerHTML = sports.map(key => {
    const s = SPORT_TEMPLATES[key];
    if (!s) return '';
    return `<div class="type-card" onclick="selectWorkoutType('${key}',this)"><div class="type-icon">${s.icon}</div><div class="type-name">${s.name}</div></div>`;
  }).join('');
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
function openExerciseSheet() {
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
  document.getElementById('exercise-sheet-list').innerHTML = filtered.map(e =>
    `<div class="bs-exercise-item" onclick="addWizExercise('${e.name.replace(/'/g,"\\'")}','${e.muscle}')"><span class="bs-ex-name">${e.name}</span><span class="bs-ex-muscle">${e.muscle}</span></div>`
  ).join('');
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
  document.getElementById('wiz-exercises').innerHTML = wizExercises.map((ex, idx) => {
    const lastStr = ex.lastPerf ? `Ultima volta: ${ex.lastPerf.sets.length}x${ex.lastPerf.sets[0]?.reps||'?'} @ ${ex.lastPerf.sets[0]?.weight||'?'}kg` : '';
    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><button class="btn-icon" onclick="removeWizExercise(${idx})">&times;</button></div>
      <div class="exercise-card-muscle">${ex.muscle}</div>
      ${lastStr ? `<div class="exercise-card-last">${lastStr}</div>` : ''}
    </div>`;
  }).join('');
}

function removeWizExercise(idx) { wizExercises.splice(idx, 1); renderWizExerciseList(); }

function renderWizSets() {
  document.getElementById('wiz-sets-container').innerHTML = wizExercises.map((ex, exIdx) => {
    let setsHTML = ex.sets.map((s, sIdx) =>
      `<div class="set-inline">
        <div class="set-num">${sIdx+1}</div>
        <input type="number" placeholder="Reps" value="${s.reps||''}" onchange="wizUpdateSet(${exIdx},${sIdx},'reps',this.value)">
        <input type="number" step="0.5" placeholder="Kg" value="${s.weight||''}" onchange="wizUpdateSet(${exIdx},${sIdx},'weight',this.value)">
        <select onchange="wizUpdateSet(${exIdx},${sIdx},'rpe',this.value)"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${s.rpe==n?'selected':''}>${n}</option>`).join('')}</select>
        <button class="btn-icon" onclick="wizRemoveSet(${exIdx},${sIdx})">&#128465;</button>
      </div>`
    ).join('');
    return `<div class="exercise-card">
      <div class="exercise-card-header"><span class="exercise-card-name">${ex.name}</span><span class="exercise-card-muscle">${ex.muscle}</span></div>
      ${setsHTML}
      <div style="display:flex;gap:6px;margin-top:4px">
        <button class="btn btn-sm btn-secondary" onclick="wizAddSet(${exIdx})">+ Serie</button>
        ${ex.lastPerf ? `<button class="copy-set-btn" onclick="wizCopyLastSets(${exIdx})">Copia precedente</button>` : ''}
      </div>
    </div>`;
  }).join('');
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

function wizSaveWorkout() {
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
    workout.scores = scoreWorkout(workout);
    workout.advice = getAdvice(workout);
    saveWorkout(workout);
    toast('Palestra salvata! Score: ' + workout.scores.overall, 'success');
    fetchPubMedForWorkout(workout);
  } else {
    // Generic sport save
    const tmpl = SPORT_TEMPLATES[wizType];
    const workout = { id: uid(), type: wizType, date, notes };
    (tmpl?.fields || []).forEach(fKey => {
      const el = document.getElementById('wiz-field-' + fKey);
      if (!el) return;
      const f = FIELD_DEFS[fKey];
      if (f?.type === 'number') workout[fKey] = parseFloat(el.value) || null;
      else workout[fKey] = el.value || null;
    });
    // Calculate pace for running
    if (wizType === 'running') {
      const paceStr = workout.pace;
      workout.paceInput = paceStr;
      workout._pace = paceToSeconds(paceStr) || (workout.duration && workout.distance ? (workout.duration*60)/workout.distance : 0);
      delete workout.pace;
    }
    workout.scores = scoreWorkout(workout);
    workout.advice = getAdvice(workout);
    saveWorkout(workout);
    const sportName = tmpl?.name || wizType;
    toast(sportName + ' salvato! Score: ' + workout.scores.overall, 'success');
    if (wizType === 'running') fetchPubMedForWorkout(workout);
  }
  showPage('dashboard');
}

// ==================== PUBMED API ====================
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

  const streak = calculateStreak();
  document.getElementById('dash-streak').innerHTML = `
    <div style="text-align:center"><div class="streak-num">${streak.current}</div><div class="streak-info"><div class="streak-label">giorni consecutivi</div></div></div>
    <div style="text-align:center"><div class="streak-num" style="color:var(--yellow)">${streak.record}</div><div class="streak-info"><div class="streak-label">record storico</div></div></div>`;

  renderHeatmap(workouts);

  const recovery=getRecoveryStatus();
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

// ==================== HEATMAP ====================
function renderHeatmap(workouts) {
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cellSize=13, cellGap=3, weeksToShow=52;
  const totalWidth = weeksToShow*(cellSize+cellGap)+40;
  const totalHeight = 7*(cellSize+cellGap)+20;
  canvas.width=totalWidth; canvas.height=totalHeight;
  canvas.style.width=totalWidth+'px'; canvas.style.height=totalHeight+'px';
  ctx.clearRect(0,0,totalWidth,totalHeight);
  const dateScores={};
  workouts.forEach(w=>{ const d=w.date; if(!dateScores[d])dateScores[d]=0; dateScores[d]=Math.max(dateScores[d],w.scores?.overall||5); });
  const today=new Date();
  const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'dark';
  const emptyColor = isLight ? '#E5E5EA' : '#1C1C1E';
  const labelColor = isLight ? '#6E6E73' : '#8E8E93';
  const dayLabels=['L','M','M','G','V','S','D'];
  ctx.fillStyle=labelColor; ctx.font='10px Inter, sans-serif';
  for(let d=0;d<7;d++){if(d%2===0) ctx.fillText(dayLabels[d],0,d*(cellSize+cellGap)+cellSize+12);}
  for(let week=0;week<weeksToShow;week++){
    for(let day=0;day<7;day++){
      const correctedDate=new Date(today);
      correctedDate.setDate(today.getDate()-((weeksToShow-1-week)*7+(today.getDay()===0?6:today.getDay()-1)-day));
      if(correctedDate>today) continue;
      const dateStr=correctedDate.toISOString().slice(0,10);
      const score=dateScores[dateStr]||0;
      const x=20+week*(cellSize+cellGap), y=12+day*(cellSize+cellGap);
      ctx.fillStyle = score===0?emptyColor:score<5?'rgba(224,32,32,0.25)':score<7?'rgba(224,32,32,0.5)':score<8.5?'rgba(224,32,32,0.75)':'rgba(224,32,32,1)';
      ctx.beginPath(); ctx.roundRect(x,y,cellSize,cellSize,2); ctx.fill();
    }
  }
}

// ==================== RADAR CHART ====================
function renderRadarChart(workouts) {
  destroyChart('radar');
  const now=todayStr();
  const last30=workouts.filter(w=>daysBetween(now,w.date)<=30);
  if(!last30.length) return;
  const gymW=last30.filter(w=>w.type==='gym'), runW=last30.filter(w=>w.type==='running');
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
  const ctx=document.getElementById('chart-radar')?.getContext('2d');
  if(!ctx) return;
  const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isLight ? '#1D1D1F' : '#F5F5F7';
  const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  charts.radar=new Chart(ctx,{type:'radar',
    data:{labels:['Forza','Resistenza','Consistenza','Recupero','Progressione','Varieta'],
      datasets:[{label:'Profilo',data:[forza,resistenza,consistenza,recupero,progressione,varieta].map(v=>Math.round(v*10)/10),
        backgroundColor:'rgba(224,32,32,0.15)',borderColor:'#E02020',pointBackgroundColor:'#E02020',pointBorderColor:'#fff',borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:10,ticks:{stepSize:2,color:textColor,backdropColor:'transparent'},grid:{color:gridColor},pointLabels:{color:textColor,font:{size:12,family:'Inter'}}}},plugins:{legend:{display:false}}}
  });
}

function workoutItemHTML(w) {
  const tmpl = SPORT_TEMPLATES[w.type];
  const typeName = tmpl?.name || w.type;
  const score=w.scores?.overall||'--';
  let detail = '';
  if (w.type==='gym') detail = `${(w.exercises||[]).length} esercizi \u00b7 ${Math.round((w._tonnage||0)/1000*10)/10}t`;
  else if (w.type==='running') detail = `${w.distance||0} km \u00b7 ${secondsToPace(w._pace)}`;
  else if (w.type==='karting') detail = `${w.track||''} \u00b7 Best: ${w.bestLap||'--'}s`;
  else if (w.duration) detail = `${w.duration} min`;
  const typeClass = SPORT_TEMPLATES[w.type] ? 'type-'+w.type : 'type-custom';
  return `<div class="workout-item" onclick="showWorkoutDetail('${w.id}')">
    <div class="score-sm" style="background:${scoreColor(score)};color:#fff">${typeof score==='number'?score.toFixed(1):score}</div>
    <div class="workout-info"><h4>${formatDate(w.date)} <span class="workout-type-badge ${typeClass}">${typeName}</span></h4><p>${detail}</p></div>
  </div>`;
}

// ==================== HISTORY ====================
let historyFilter='all';
function filterHistory(f,btn) {
  historyFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderHistory();
}
function renderHistory() {
  // Render filter buttons dynamically
  const types = [...new Set(workoutsCache.map(w=>w.type))];
  const filtersEl = document.getElementById('history-filters');
  let filtersHTML = `<button class="filter-btn ${historyFilter==='all'?'active':''}" onclick="filterHistory('all',this)">Tutti</button>`;
  types.forEach(t => {
    const name = SPORT_TEMPLATES[t]?.name || t;
    filtersHTML += `<button class="filter-btn ${historyFilter===t?'active':''}" onclick="filterHistory('${t}',this)">${name}</button>`;
  });
  filtersEl.innerHTML = filtersHTML;

  let workouts=[...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(historyFilter!=='all') workouts=workouts.filter(w=>w.type===historyFilter);
  document.getElementById('history-list').innerHTML=workouts.length?workouts.map(w=>workoutItemHTML(w)).join(''):'<div class="empty-state"><p>Nessun allenamento trovato</p></div>';
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
    if(w.duration) html+=`<p style="font-size:.85rem;color:var(--text2)">Durata: ${w.duration} min | RPE: ${w.rpe||'--'} | Tonnellaggio: ${Math.round(w._tonnage||0)} kg</p>`;
    (w.exercises||[]).forEach(ex=>{
      html+=`<div style="margin-top:10px"><strong style="font-size:.9rem">${ex.name}</strong> <span style="font-size:.75rem;color:var(--accent)">${ex.muscle||''}</span>`;
      html+='<table style="width:100%;font-size:.82rem;margin-top:4px;border-collapse:collapse"><tr style="color:var(--text2)"><td>Serie</td><td>Reps</td><td>Peso</td><td>RPE</td></tr>';
      ex.sets.forEach((s,i)=>{html+=`<tr><td>${i+1}</td><td>${s.reps}</td><td>${s.weight} kg</td><td>${s.rpe||'--'}</td></tr>`;});
      html+='</table></div>';
    });
  }
  if(w.type==='running') html+=`<p style="font-size:.85rem;color:var(--text2)">Distanza: ${w.distance} km | Durata: ${w.duration||'--'} min | Pace: ${secondsToPace(w._pace)}/km<br>FC Media: ${w.avghr||'--'} bpm | FC Max: ${w.maxhr||'--'} bpm | Dislivello: ${w.elevation||'--'} m<br>Tipo: ${w.runType||'--'} | RPE: ${w.rpe||'--'}</p>`;
  if(w.type==='karting') html+=`<p style="font-size:.85rem;color:var(--text2)">Circuito: ${w.track||'--'} | Durata: ${w.duration||'--'} min | Giri: ${w.laps||'--'}<br>Miglior Giro: ${w.bestLap||'--'}s | Giro Medio: ${w.avgLap||'--'}s | RPE: ${w.rpe||'--'}</p>`;
  // Generic sport fields
  if (w.type !== 'gym' && w.type !== 'running' && w.type !== 'karting') {
    let details = [];
    if (w.duration) details.push('Durata: ' + w.duration + ' min');
    if (w.distance) details.push('Distanza: ' + w.distance + ' km');
    if (w.rpe) details.push('RPE: ' + w.rpe);
    if (w.rounds) details.push('Round: ' + w.rounds);
    if (w.sets) details.push('Set: ' + w.sets);
    if (w.avghr) details.push('FC Media: ' + w.avghr + ' bpm');
    if (details.length) html += `<p style="font-size:.85rem;color:var(--text2)">${details.join(' | ')}</p>`;
  }
  if(w.notes) html+=`<p style="margin-top:10px;font-size:.85rem;font-style:italic;color:var(--text2)">"${w.notes}"</p>`;
  html+='</div><div id="modal-pubmed"></div>';
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-delete-btn').onclick=()=>{
    if(confirm('Eliminare questo allenamento?')){deleteWorkout(id);closeModal();toast('Allenamento eliminato');}
  };
  document.getElementById('workout-modal').classList.add('show');
  fetchPubMedForWorkout(w).then(articles=>{
    const el=document.getElementById('modal-pubmed');
    if(el) el.innerHTML=renderPubMedBox(articles);
  });
}
function closeModal(){document.getElementById('workout-modal').classList.remove('show');}
document.getElementById('workout-modal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ==================== CHARTS ====================
let charts={};
function destroyChart(key){if(charts[key]){charts[key].destroy();delete charts[key];}}
function getChartTheme() {
  const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'dark';
  return {
    grid:{color:isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},
    ticks:{color:isLight?'#6E6E73':'#8E8E93'},
    textColor: isLight?'#6E6E73':'#8E8E93'
  };
}

function renderWeeklyChart(workouts) {
  destroyChart('weekly');
  const ct = getChartTheme();
  const weeks={};
  workouts.forEach(w=>{const wk=getWeekStart(w.date);if(!weeks[wk])weeks[wk]={gym:0,running:0,other:0};if(w.type==='gym')weeks[wk].gym++;else if(w.type==='running')weeks[wk].running++;else weeks[wk].other++;});
  const labels=Object.keys(weeks).sort().slice(-12);
  const ctx=document.getElementById('chart-weekly')?.getContext('2d');
  if(!ctx)return;
  charts.weekly=new Chart(ctx,{type:'bar',
    data:{labels:labels.map(l=>{const d=new Date(l);return d.getDate()+'/'+(d.getMonth()+1);}),
      datasets:[
        {label:'Palestra',data:labels.map(l=>weeks[l]?.gym||0),backgroundColor:'rgba(224,32,32,0.7)'},
        {label:'Corsa',data:labels.map(l=>weeks[l]?.running||0),backgroundColor:'rgba(0,184,148,0.7)'},
        {label:'Altro',data:labels.map(l=>weeks[l]?.other||0),backgroundColor:'rgba(9,132,227,0.7)'}
      ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor,font:{family:'Inter'}}}},scales:{x:{stacked:true,...ct},y:{stacked:true,...ct}}}
  });
}

function renderProgress() {
  const ct = getChartTheme();
  const workouts=[...workoutsCache].sort((a,b)=>new Date(a.date)-new Date(b.date));

  destroyChart('scores');
  const scored=workouts.filter(w=>w.scores?.overall);
  if(scored.length){
    const ctx=document.getElementById('chart-scores')?.getContext('2d');
    if(ctx) charts.scores=new Chart(ctx,{type:'line',
      data:{labels:scored.map(w=>formatDate(w.date)),datasets:[
        {label:'Palestra',data:scored.map(w=>w.type==='gym'?w.scores.overall:null),borderColor:'#E02020',pointBackgroundColor:'#E02020',spanGaps:false,tension:.3},
        {label:'Corsa',data:scored.map(w=>w.type==='running'?w.scores.overall:null),borderColor:'#00b894',pointBackgroundColor:'#00b894',spanGaps:false,tension:.3},
        {label:'Altro',data:scored.map(w=>w.type!=='gym'&&w.type!=='running'?w.scores.overall:null),borderColor:'#0984e3',pointBackgroundColor:'#0984e3',spanGaps:false,tension:.3}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor}}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:{min:0,max:10,...ct}}}
    });
  }

  destroyChart('gymVolume');
  const gymW=workouts.filter(w=>w.type==='gym');
  if(gymW.length){
    const ctx=document.getElementById('chart-gym-volume')?.getContext('2d');
    if(ctx) charts.gymVolume=new Chart(ctx,{type:'bar',
      data:{labels:gymW.map(w=>formatDate(w.date)),datasets:[{label:'Tonnellaggio (kg)',data:gymW.map(w=>w._tonnage||0),backgroundColor:'rgba(224,32,32,0.6)'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
    });
  }

  destroyChart('runPace');
  const runW=workouts.filter(w=>w.type==='running'&&w._pace>0);
  if(runW.length){
    const ctx=document.getElementById('chart-run-pace')?.getContext('2d');
    if(ctx) charts.runPace=new Chart(ctx,{type:'line',
      data:{labels:runW.map(w=>formatDate(w.date)),datasets:[{label:'Pace',data:runW.map(w=>w._pace),borderColor:'#00b894',pointBackgroundColor:'#00b894',tension:.3,fill:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'Pace: '+secondsToPace(ctx.raw)+'/km'}}},
        scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:{reverse:true,ticks:{...ct.ticks,callback:v=>secondsToPace(v)},grid:ct.grid}}}
    });
  }

  render1RMChart(workouts);
  renderHRZones(workouts);

  destroyChart('muscles');
  const fourWeeksAgo=new Date();fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const recentGym=workouts.filter(w=>w.type==='gym'&&new Date(w.date)>=fourWeeksAgo);
  const muscleCount={};
  recentGym.forEach(w=>(w.exercises||[]).forEach(e=>{if(e.muscle)muscleCount[e.muscle]=(muscleCount[e.muscle]||0)+e.sets.length;}));
  if(Object.keys(muscleCount).length){
    const ctx=document.getElementById('chart-muscles')?.getContext('2d');
    const lbls=Object.keys(muscleCount);
    const colors=['#E02020','#00b894','#0984e3','#fdcb6e','#e17055','#FF4444','#55efc4','#74b9ff','#ffeaa7','#fab1a0','#dfe6e9','#b2bec3','#636e72'];
    if(ctx) charts.muscles=new Chart(ctx,{type:'doughnut',
      data:{labels:lbls,datasets:[{data:Object.values(muscleCount),backgroundColor:colors.slice(0,lbls.length)}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:ct.textColor,font:{size:11,family:'Inter'}}}}}
    });
  }

  destroyChart('frequency');
  const freqWeeks={};
  workouts.forEach(w=>{const wk=getWeekStart(w.date);freqWeeks[wk]=(freqWeeks[wk]||0)+1;});
  const freqLabels=Object.keys(freqWeeks).sort().slice(-16);
  if(freqLabels.length){
    const ctx=document.getElementById('chart-frequency')?.getContext('2d');
    const goal=settingsCache.weekgoal||4;
    if(ctx) charts.frequency=new Chart(ctx,{type:'bar',
      data:{labels:freqLabels.map(l=>{const d=new Date(l);return d.getDate()+'/'+(d.getMonth()+1);}),
        datasets:[{label:'Allenamenti',data:freqLabels.map(l=>freqWeeks[l]||0),backgroundColor:freqLabels.map(l=>(freqWeeks[l]||0)>=goal?'rgba(0,184,148,0.7)':'rgba(253,203,110,0.7)')}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:ct,y:{...ct,ticks:{...ct.ticks,stepSize:1}}}}
    });
  }
}

// ==================== 1RM CHART ====================
function render1RMChart(workouts) {
  destroyChart('orm');
  const gymW=workouts.filter(w=>w.type==='gym');
  const exerciseData={};
  gymW.forEach(w=>{
    (w.exercises||[]).forEach(ex=>{
      if(!exerciseData[ex.name]) exerciseData[ex.name]=[];
      const maxSet=ex.sets.reduce((best,s)=>{const orm=s.weight*(1+s.reps/30);return orm>best.orm?{orm,date:w.date}:best;},{orm:0,date:w.date});
      if(maxSet.orm>0) exerciseData[ex.name].push({date:w.date,orm:Math.round(maxSet.orm*10)/10});
    });
  });
  const names=Object.keys(exerciseData).filter(n=>exerciseData[n].length>=2);
  const sel=document.getElementById('orm-select-container');
  if(!names.length){sel.innerHTML='<p style="font-size:.85rem;color:var(--text2)">Servono almeno 2 sessioni per il 1RM stimato.</p>';return;}
  sel.innerHTML=`<select id="orm-exercise-select" onchange="updateORMChart()" style="max-width:250px">${names.map(n=>`<option value="${n}">${n}</option>`).join('')}</select>`;
  window._ormData=exerciseData;
  updateORMChart();
}

function updateORMChart() {
  destroyChart('orm');
  const ct = getChartTheme();
  const name=document.getElementById('orm-exercise-select')?.value;
  if(!name||!window._ormData?.[name]) return;
  const data=window._ormData[name].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const ctx=document.getElementById('chart-1rm')?.getContext('2d');
  if(!ctx) return;
  charts.orm=new Chart(ctx,{type:'line',
    data:{labels:data.map(d=>formatDate(d.date)),datasets:[{label:'1RM Stimato (kg)',data:data.map(d=>d.orm),borderColor:'#E02020',pointBackgroundColor:'#E02020',tension:.3,fill:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
  });
}

// ==================== HR ZONES ====================
function renderHRZones(workouts) {
  const container=document.getElementById('hr-zones-container');
  const maxHR=settingsCache.maxhr||190;
  const runW=workouts.filter(w=>w.type==='running'&&w.avghr&&w.duration).slice(-10).reverse();
  if(!runW.length){container.innerHTML='<p style="font-size:.85rem;color:var(--text2)">Nessuna corsa con dati FC disponibile.</p>';return;}
  const zones=[{name:'Z1 Recupero',min:.5,max:.6,color:'#8E8E93'},{name:'Z2 Base',min:.6,max:.7,color:'#0984e3'},{name:'Z3 Aerobica',min:.7,max:.8,color:'#00b894'},{name:'Z4 Soglia',min:.8,max:.9,color:'#fdcb6e'},{name:'Z5 Max',min:.9,max:1,color:'#E02020'}];
  let html='';
  runW.forEach(w=>{
    const hrPct=w.avghr/maxHR;
    const zonePcts=zones.map(z=>{const center=(z.min+z.max)/2;return Math.max(0,1-Math.abs(hrPct-center)*5);});
    const total=zonePcts.reduce((s,v)=>s+v,0)||1;
    const norm=zonePcts.map(v=>Math.round((v/total)*100));
    html+=`<div style="margin-bottom:12px"><div style="font-size:.85rem;font-weight:600;margin-bottom:4px">${formatDate(w.date)} - ${w.distance}km (FC ${w.avghr}bpm)</div>
      <div class="hr-zones-bar">${zones.map((z,i)=>norm[i]>0?`<div class="hr-zone" style="width:${norm[i]}%;background:${z.color}">${norm[i]}%</div>`:'').join('')}</div></div>`;
  });
  html+='<div class="hr-zone-legend">';
  zones.forEach(z=>{html+=`<span style="color:${z.color}">${z.name}</span>`;});
  html+='</div>';
  container.innerHTML=html;
}

// ==================== WEIGHT & BODY ====================
function renderWeightPage() {
  document.getElementById('weight-date').value=todayStr();
  const weights=weightsCache;
  const statsEl=document.getElementById('weight-stats'), bmiEl=document.getElementById('weight-bmi-section');
  if(!weights.length){statsEl.innerHTML='';bmiEl.innerHTML='';renderWeightChart();return;}
  const latest=weights[weights.length-1];
  const weekAgo=weights.filter(w=>daysBetween(todayStr(),w.date)>=6&&daysBetween(todayStr(),w.date)<=8);
  const monthAgo=weights.filter(w=>daysBetween(todayStr(),w.date)>=28&&daysBetween(todayStr(),w.date)<=32);
  const weekDiff=weekAgo.length?(latest.value-weekAgo[0].value).toFixed(1):'--';
  const monthDiff=monthAgo.length?(latest.value-monthAgo[0].value).toFixed(1):'--';
  statsEl.innerHTML=`
    <div class="weight-stat"><div class="ws-value">${latest.value} kg</div><div class="ws-label">Peso attuale</div></div>
    <div class="weight-stat"><div class="ws-value" style="color:${weekDiff>0?'var(--red)':weekDiff<0?'var(--green)':'var(--text2)'}">${weekDiff!=='--'?(weekDiff>0?'+':'')+weekDiff:'--'}</div><div class="ws-label">vs settimana scorsa</div></div>
    <div class="weight-stat"><div class="ws-value" style="color:${monthDiff>0?'var(--red)':monthDiff<0?'var(--green)':'var(--text2)'}">${monthDiff!=='--'?(monthDiff>0?'+':'')+monthDiff:'--'}</div><div class="ws-label">vs mese scorso</div></div>`;
  const height=settingsCache.height||parseInt(document.getElementById('weight-height')?.value);
  if(height){
    const heightM=height/100, bmi=(latest.value/(heightM*heightM)).toFixed(1);
    let cat,cls;
    if(bmi<18.5){cat='Sottopeso';cls='bmi-underweight';}
    else if(bmi<25){cat='Normopeso';cls='bmi-normal';}
    else if(bmi<30){cat='Sovrappeso';cls='bmi-overweight';}
    else{cat='Obeso';cls='bmi-obese';}
    bmiEl.innerHTML=`<div style="margin-bottom:16px"><span class="bmi-badge ${cls}">BMI ${bmi} - ${cat}</span></div>`;
  } else bmiEl.innerHTML='<p style="font-size:.8rem;color:var(--text2);margin-bottom:12px">Inserisci l\'altezza per il BMI.</p>';
  renderWeightChart();
}

function renderWeightChart() {
  destroyChart('weight');
  const ct = getChartTheme();
  const now=new Date(), ninetyDaysAgo=new Date(now); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate()-90);
  const data=weightsCache.filter(w=>new Date(w.date)>=ninetyDaysAgo);
  if(!data.length) return;
  const target=parseFloat(document.getElementById('weight-target')?.value);
  const xVals=data.map(d=>(new Date(d.date)-ninetyDaysAgo)/86400000);
  const yVals=data.map(d=>d.value);
  const n=xVals.length, sumX=xVals.reduce((s,v)=>s+v,0), sumY=yVals.reduce((s,v)=>s+v,0);
  const sumXY=xVals.reduce((s,v,i)=>s+v*yVals[i],0), sumX2=xVals.reduce((s,v)=>s+v*v,0);
  const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX)||0;
  const intercept=(sumY-slope*sumX)/n;
  const trendData=xVals.map(x=>Math.round((slope*x+intercept)*10)/10);
  const datasets=[
    {label:'Peso',data:yVals,borderColor:'#E02020',pointBackgroundColor:'#E02020',tension:.3,fill:false},
    {label:'Tendenza',data:trendData,borderColor:'#FF4444',borderDash:[5,5],pointRadius:0,tension:.3,fill:false}
  ];
  if(target) datasets.push({label:'Obiettivo',data:data.map(()=>target),borderColor:'#00b894',borderDash:[10,5],pointRadius:0,fill:false});
  const ctx=document.getElementById('chart-weight')?.getContext('2d');
  if(!ctx) return;
  charts.weight=new Chart(ctx,{type:'line',data:{labels:data.map(d=>formatDate(d.date)),datasets},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor}}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
  });
}

function saveWeight() {
  const date=document.getElementById('weight-date').value||todayStr();
  const value=parseFloat(document.getElementById('weight-value').value);
  if(!value){toast('Inserisci il peso!','error');return;}
  userRef('weights/'+uid()).set({id:uid(),date,value});
  document.getElementById('weight-value').value='';
  toast('Peso registrato!','success');
}
function saveWeightTarget(){const v=parseFloat(document.getElementById('weight-target').value);if(v){userRef('weightTarget').set(v);renderWeightChart();}}
function saveWeightHeight(){
  const v=parseInt(document.getElementById('weight-height').value);
  if(v){userRef('heightCm').set(v);saveSettingsToFirebase({...settingsCache,height:v});}
}

// ==================== FITNESS ASSESSMENT ====================
function getFitnessAssessment() {
  const age = settingsCache.age || null;
  const gender = settingsCache.gender || null;
  const vo2max = settingsCache.vo2max || null;
  const resthr = settingsCache.resthr || null;
  const weight = settingsCache.bodyweight || null;
  const height = settingsCache.height || null;

  let score = 0, maxScore = 0, details = [];

  // VO2 Max assessment
  if (vo2max) {
    maxScore += 30;
    // VO2 max norms (male, approximate)
    let vo2score;
    if (gender === 'F') {
      vo2score = vo2max >= 40 ? 30 : vo2max >= 33 ? 22 : vo2max >= 27 ? 15 : 8;
    } else {
      vo2score = vo2max >= 50 ? 30 : vo2max >= 42 ? 22 : vo2max >= 35 ? 15 : 8;
    }
    score += vo2score;
    details.push({ label: 'VO2 Max', value: vo2max + ' ml/kg/min', pct: Math.round((vo2score/30)*100), color: vo2score >= 22 ? 'var(--green)' : vo2score >= 15 ? 'var(--yellow)' : 'var(--red)' });
  }

  // Resting HR
  if (resthr) {
    maxScore += 20;
    const hrScore = resthr <= 50 ? 20 : resthr <= 60 ? 16 : resthr <= 70 ? 12 : resthr <= 80 ? 8 : 4;
    score += hrScore;
    details.push({ label: 'FC Riposo', value: resthr + ' bpm', pct: Math.round((hrScore/20)*100), color: hrScore >= 16 ? 'var(--green)' : hrScore >= 12 ? 'var(--yellow)' : 'var(--red)' });
  }

  // BMI
  if (weight && height) {
    maxScore += 15;
    const bmi = weight / ((height/100) ** 2);
    const bmiScore = bmi >= 18.5 && bmi < 25 ? 15 : bmi >= 17 && bmi < 30 ? 10 : 5;
    score += bmiScore;
    details.push({ label: 'BMI', value: bmi.toFixed(1), pct: Math.round((bmiScore/15)*100), color: bmiScore >= 12 ? 'var(--green)' : bmiScore >= 8 ? 'var(--yellow)' : 'var(--red)' });
  }

  // Training consistency (last 30 days)
  const now = todayStr();
  const last30 = workoutsCache.filter(w => daysBetween(now, w.date) <= 30);
  const trainingDays = new Set(last30.map(w => w.date)).size;
  maxScore += 20;
  const consScore = trainingDays >= 16 ? 20 : trainingDays >= 12 ? 16 : trainingDays >= 8 ? 12 : trainingDays >= 4 ? 8 : 4;
  score += consScore;
  details.push({ label: 'Consistenza', value: trainingDays + ' gg/30', pct: Math.round((consScore/20)*100), color: consScore >= 16 ? 'var(--green)' : consScore >= 12 ? 'var(--yellow)' : 'var(--red)' });

  // Average score
  const avgScore = workoutsCache.length ? workoutsCache.reduce((s,w) => s + (w.scores?.overall||0), 0) / workoutsCache.length : 0;
  maxScore += 15;
  const perfScore = avgScore >= 8 ? 15 : avgScore >= 6.5 ? 12 : avgScore >= 5 ? 8 : 4;
  score += perfScore;
  details.push({ label: 'Performance', value: avgScore.toFixed(1) + '/10', pct: Math.round((perfScore/15)*100), color: perfScore >= 12 ? 'var(--green)' : perfScore >= 8 ? 'var(--yellow)' : 'var(--red)' });

  const finalPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  let level, levelColor;
  if (finalPct >= 85) { level = 'Eccellente'; levelColor = 'var(--green)'; }
  else if (finalPct >= 70) { level = 'Buono'; levelColor = 'var(--blue)'; }
  else if (finalPct >= 50) { level = 'Nella media'; levelColor = 'var(--yellow)'; }
  else if (finalPct >= 30) { level = 'Da migliorare'; levelColor = 'var(--orange)'; }
  else { level = 'Insufficiente'; levelColor = 'var(--red)'; }

  return { score: finalPct, level, levelColor, details };
}

function renderFitnessAssessment() {
  const fa = getFitnessAssessment();
  const el = document.getElementById('fitness-assessment');
  if (!el) return;
  let html = `<div class="fitness-card">
    <div class="fitness-score" style="color:${fa.levelColor}">${fa.score}%</div>
    <div class="fitness-label" style="color:${fa.levelColor}">${fa.level}</div>
    <div class="fitness-detail">Valutazione basata su VO2 Max, FC riposo, BMI, consistenza e performance</div>
    <div class="fitness-bars">`;
  fa.details.forEach(d => {
    html += `<div class="fitness-bar-row"><span class="fb-label">${d.label}</span><div class="fb-track"><div class="fb-fill" style="width:${d.pct}%;background:${d.color}"></div></div><span style="font-size:.78rem;width:70px;text-align:right;color:var(--text2)">${d.value}</span></div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

// ==================== PROFILE ====================
function renderProfile() {
  if(!currentUser) return;
  document.getElementById('profile-avatar').src=currentUser.photoURL||'';
  document.getElementById('profile-name').textContent=currentUser.displayName||'Utente';
  document.getElementById('profile-email').textContent=currentUser.email||'';
  document.getElementById('profile-link').value=window.location.href;
  userRef('profile/createdAt').once('value',snap=>{
    const val=snap.val();
    if(val) document.getElementById('profile-since').textContent='Registrato dal '+formatDate(val);
  });
  renderFitnessAssessment();
}
function copyAppLink(){navigator.clipboard.writeText(window.location.href).then(()=>toast('Link copiato!')).catch(()=>toast('Errore copia','error'));}

// ==================== FRIENDS ====================
function renderFriendsPage() {
  renderFollowingList();
  renderCompareCheckboxes();
}

function loadPublicUsers() {
  db.ref('publicUsers').once('value', snap => {
    publicUsersCache = snap.val() || {};
  }).catch(() => { publicUsersCache = {}; });
}

let _searchTimeout = null;
function searchUsers(query) {
  const resultsEl = document.getElementById('friend-search-results');
  if (!query || query.length < 2) { resultsEl.className = 'search-results'; resultsEl.innerHTML = ''; return; }

  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(() => {
    // First try local cache
    const q = query.toLowerCase();
    let results = Object.values(publicUsersCache).filter(u =>
      u.uid !== currentUser.uid && (u.displayName||'').toLowerCase().includes(q)
    ).slice(0, 8);

    if (results.length) {
      renderSearchResults(results);
    } else {
      // Fallback: query Firebase directly
      db.ref('publicUsers').orderByChild('displayName').once('value', snap => {
        const all = snap.val() || {};
        publicUsersCache = all; // refresh cache
        results = Object.values(all).filter(u =>
          u.uid !== currentUser.uid && (u.displayName||'').toLowerCase().includes(q)
        ).slice(0, 8);
        if (results.length) {
          renderSearchResults(results);
        } else {
          resultsEl.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:.85rem">Nessun utente trovato</div>';
          resultsEl.className = 'search-results show';
        }
      }).catch(() => {
        resultsEl.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:.85rem">Nessun utente trovato</div>';
        resultsEl.className = 'search-results show';
      });
    }
  }, 300);
}

function renderSearchResults(results) {
  const resultsEl = document.getElementById('friend-search-results');
  resultsEl.innerHTML = results.map(u => {
    const isFollowing = followingCache[u.uid];
    return `<div class="search-result-item">
      <img src="${u.photoURL||''}" alt="" onerror="this.style.display='none'">
      <div style="flex:1"><strong>${u.displayName||'Utente'}</strong></div>
      <button class="btn-follow ${isFollowing?'following':''}" onclick="toggleFollow('${u.uid}','${(u.displayName||'').replace(/'/g,"\\'")}','${u.photoURL||''}')">
        ${isFollowing ? 'Segui gia' : 'Segui'}
      </button>
    </div>`;
  }).join('');
  resultsEl.className = 'search-results show';
}

function toggleFollow(uid, name, photo) {
  if (followingCache[uid]) {
    userRef('following/' + uid).remove();
  } else {
    userRef('following/' + uid).set({ displayName: name, photoURL: photo, uid: uid, followedAt: new Date().toISOString() });
  }
}

function renderFollowingList() {
  const el = document.getElementById('following-list');
  const following = Object.values(followingCache);
  if (!following.length) { el.innerHTML = '<p style="color:var(--text2);font-size:.85rem">Non segui nessuno. Cerca persone qui sopra!</p>'; return; }
  el.innerHTML = following.map(f =>
    `<div class="friend-card">
      <img class="friend-avatar" src="${f.photoURL||''}" alt="" onerror="this.style.display='none'">
      <div class="friend-info"><h4>${f.displayName||'Utente'}</h4><p>Seguito</p></div>
      <button class="btn-follow following" onclick="toggleFollow('${f.uid}','${(f.displayName||'').replace(/'/g,"\\'")}','${f.photoURL||''}')">Non seguire</button>
    </div>`
  ).join('');
}

function renderCompareCheckboxes() {
  const el = document.getElementById('compare-checkboxes');
  const following = Object.values(followingCache);
  if (!following.length) { el.innerHTML = ''; return; }
  el.innerHTML = following.map(f =>
    `<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 8px 4px 0;font-size:.85rem;cursor:pointer">
      <input type="checkbox" class="import-checkbox compare-check" value="${f.uid}" data-name="${f.displayName||'Utente'}"> ${f.displayName||'Utente'}
    </label>`
  ).join('');
}

function compareSelected() {
  const checked = document.querySelectorAll('.compare-check:checked');
  if (!checked.length) { toast('Seleziona almeno una persona!', 'error'); return; }
  const resultEl = document.getElementById('friend-compare-result');
  resultEl.innerHTML = '<p style="color:var(--text2);font-size:.85rem">Caricamento...</p>';

  const promises = Array.from(checked).map(cb => {
    return new Promise((resolve) => {
      db.ref('users/' + cb.value + '/publicStats').once('value', snap => {
        resolve({ uid: cb.value, name: cb.dataset.name, stats: snap.val() });
      }).catch(() => resolve({ uid: cb.value, name: cb.dataset.name, stats: null }));
    });
  });

  Promise.all(promises).then(friends => {
    const validFriends = friends.filter(f => f.stats);
    if (!validFriends.length) { resultEl.innerHTML = '<p style="color:var(--red);font-size:.85rem">Nessun dato disponibile.</p>'; return; }

    // My stats
    const now = todayStr();
    const myL7 = workoutsCache.filter(w => daysBetween(now, w.date) <= 7);
    const myAvg = workoutsCache.length ? workoutsCache.reduce((s,w) => s + (w.scores?.overall||0), 0) / workoutsCache.length : 0;
    const myKm = myL7.filter(w => w.type === 'running').reduce((s,w) => s + (w.distance||0), 0);
    const myTon = myL7.filter(w => w.type === 'gym').reduce((s,w) => s + (w._tonnage||0), 0);

    const metrics = [
      { label: 'Score Medio', myVal: myAvg, key: 'avgScore', unit: '' },
      { label: 'Allenamenti/Sett', myVal: myL7.length, key: 'weekWorkouts', unit: '' },
      { label: 'Km Corsa/Sett', myVal: myKm, key: 'weekKm', unit: ' km' },
      { label: 'Tonnellaggio/Sett', myVal: myTon, key: 'weekTonnage', unit: ' kg' },
      { label: 'Totale Allenamenti', myVal: workoutsCache.length, key: 'totalWorkouts', unit: '' }
    ];

    const colors = ['var(--accent)', 'var(--green)', 'var(--blue)', '#fdcb6e', '#e17055'];
    const participants = [{ name: currentUser.displayName || 'Tu', color: colors[0] }, ...validFriends.map((f, i) => ({ name: f.name, color: colors[(i+1) % colors.length] }))];

    let html = '<div class="compare-grid">';
    metrics.forEach(m => {
      const allVals = [m.myVal, ...validFriends.map(f => f.stats[m.key] || 0)];
      const maxVal = Math.max(...allVals, 1);
      html += `<div class="compare-card"><h4>${m.label}</h4>`;
      html += `<div class="compare-bar"><span class="compare-bar-label" style="color:${colors[0]}">Tu</span><div class="compare-bar-track"><div class="compare-bar-fill" style="width:${(m.myVal/maxVal)*100}%;background:${colors[0]}"></div></div><span class="compare-value">${Number(m.myVal).toFixed(1)}${m.unit}</span></div>`;
      validFriends.forEach((f, i) => {
        const val = f.stats[m.key] || 0;
        html += `<div class="compare-bar"><span class="compare-bar-label" style="color:${colors[(i+1)%colors.length]}">${f.name.split(' ')[0]}</span><div class="compare-bar-track"><div class="compare-bar-fill" style="width:${(val/maxVal)*100}%;background:${colors[(i+1)%colors.length]}"></div></div><span class="compare-value">${Number(val).toFixed(1)}${m.unit}</span></div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    resultEl.innerHTML = html;
  });
}

// ==================== GPX IMPORT ====================
function handleGPXFiles(files) {
  const preview=document.getElementById('gpx-preview');preview.innerHTML='';
  Array.from(files).forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const xml=new DOMParser().parseFromString(e.target.result,'text/xml');
        const data=parseGPX(xml);
        if(data){
          const card=document.createElement('div');card.className='card';
          card.innerHTML=`<div class="card-title">${file.name}</div><p style="font-size:.85rem;color:var(--text2)">Distanza: ${data.distance.toFixed(2)} km | Durata: ${data.duration} min | Pace: ${secondsToPace(data.pace)}/km<br>${data.avghr?'FC Media: '+data.avghr+' bpm | ':''}Dislivello: ${data.elevation} m | Data: ${data.date}</p>
            <button class="btn btn-primary btn-sm" onclick='importGPXWorkout(${JSON.stringify(data).replace(/'/g,"\\'")});this.disabled=true;this.textContent="Importato!"'>Importa</button>`;
          preview.appendChild(card);
        }
      }catch(err){toast('Errore parsing '+file.name,'error');}
    };
    reader.readAsText(file);
  });
}

function parseGPX(xml) {
  const trkpts=xml.querySelectorAll('trkpt');
  if(!trkpts.length) return null;
  let totalDist=0,totalElevGain=0,prevLat=null,prevLon=null,prevEle=null,maxHR=0,sumHR=0,hrCount=0,startTime=null,endTime=null;
  trkpts.forEach((pt,i)=>{
    const lat=parseFloat(pt.getAttribute('lat')),lon=parseFloat(pt.getAttribute('lon'));
    const eleEl=pt.querySelector('ele'),ele=eleEl?parseFloat(eleEl.textContent):null;
    const timeEl=pt.querySelector('time'),time=timeEl?new Date(timeEl.textContent):null;
    const hrEl=pt.querySelector('hr')||pt.querySelector('*|hr');
    if(hrEl){const hr=parseInt(hrEl.textContent);if(hr>0){sumHR+=hr;hrCount++;if(hr>maxHR)maxHR=hr;}}
    const nsHR=pt.getElementsByTagNameNS('*','hr');
    if(nsHR.length&&!hrEl){const hr=parseInt(nsHR[0].textContent);if(hr>0){sumHR+=hr;hrCount++;if(hr>maxHR)maxHR=hr;}}
    if(i===0&&time)startTime=time;if(time)endTime=time;
    if(prevLat!==null){totalDist+=haversine(prevLat,prevLon,lat,lon);if(ele!==null&&prevEle!==null&&ele>prevEle)totalElevGain+=ele-prevEle;}
    prevLat=lat;prevLon=lon;if(ele!==null)prevEle=ele;
  });
  const durationMin=startTime&&endTime?Math.round((endTime-startTime)/60000):0;
  return{date:startTime?startTime.toISOString().slice(0,10):todayStr(),distance:Math.round(totalDist*100)/100,duration:durationMin,
    pace:totalDist>0&&durationMin>0?(durationMin*60)/totalDist:0,avghr:hrCount>0?Math.round(sumHR/hrCount):null,maxhr:maxHR>0?maxHR:null,elevation:Math.round(totalElevGain)};
}

function haversine(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

function importGPXWorkout(data) {
  const workout={id:uid(),type:'running',date:data.date,distance:data.distance,duration:data.duration,_pace:data.pace,paceInput:secondsToPace(data.pace),
    avghr:data.avghr,maxhr:data.maxhr,elevation:data.elevation,runType:'easy',notes:'Importato da GPX',imported:true};
  workout.scores=scoreWorkout(workout);workout.advice=getAdvice(workout);saveWorkout(workout);
  toast('Corsa importata!','success');
}

// ==================== CSV IMPORT ====================
function handleCSVFile(file) {
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const lines=e.target.result.trim().split('\n').filter(l=>l.trim());
      const start=lines[0].toLowerCase().includes('data')||lines[0].toLowerCase().includes('date')?1:0;
      const byDate={};
      for(let i=start;i<lines.length;i++){
        const cols=lines[i].split(',').map(c=>c.trim());if(cols.length<4)continue;
        const[date,exercise,setsStr,reps,weight,rpe]=cols;
        if(!byDate[date])byDate[date]=[];
        const numSets=parseInt(setsStr)||1,sets=[];
        for(let s=0;s<numSets;s++)sets.push({reps:parseInt(reps)||0,weight:parseFloat(weight)||0,rpe:parseInt(rpe)||null});
        const lib=exercisesCache||getDefaultExercises();
        const libEntry=lib.find(l=>l.name.toLowerCase()===exercise.toLowerCase());
        byDate[date].push({name:exercise,muscle:libEntry?.muscle||'Full Body',sets});
      }
      const preview=document.getElementById('csv-preview');
      let html=`<div class="card"><div class="card-title">Anteprima</div><p style="font-size:.85rem;color:var(--text2);margin-bottom:8px">${Object.keys(byDate).length} sessioni</p>`;
      Object.entries(byDate).forEach(([date,exercises])=>{html+=`<p style="font-size:.82rem"><strong>${date}</strong>: ${exercises.map(e=>e.name).join(', ')}</p>`;});
      html+=`<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="confirmCSVImport()">Importa</button></div>`;
      preview.innerHTML=html;window._csvImportData=byDate;
    }catch(err){toast('Errore parsing CSV','error');}
  };reader.readAsText(file);
}
function confirmCSVImport(){
  const byDate=window._csvImportData;if(!byDate)return;let count=0;
  Object.entries(byDate).forEach(([date,exercises])=>{
    let tonnage=0;exercises.forEach(ex=>ex.sets.forEach(s=>tonnage+=s.reps*s.weight));
    const workout={id:uid(),type:'gym',date,exercises,_tonnage:tonnage,notes:'Importato da CSV',imported:true};
    workout.scores=scoreWorkout(workout);workout.advice=getAdvice(workout);saveWorkout(workout);count++;
  });
  toast(`${count} sessioni importate!`,'success');document.getElementById('csv-preview').innerHTML='';
}

// ==================== APPLE HEALTH IMPORT ====================
function handleAppleHealthFile(file) {
  if(!file) return;
  const progressBar=document.getElementById('health-progress'),progressFill=document.getElementById('health-progress-fill'),preview=document.getElementById('health-preview');
  progressBar.style.display='';
  preview.innerHTML='<p style="color:var(--text2);font-size:.85rem">Parsing...</p>';
  const chunkSize=1024*1024,fileSize=file.size;let offset=0,textBuffer='';
  const workouts=[];const reader=new FileReader();
  function readNextChunk(){reader.readAsText(file.slice(offset,Math.min(offset+chunkSize,fileSize)));}
  reader.onload=function(e){
    textBuffer+=e.target.result;offset+=chunkSize;
    progressFill.style.width=Math.min(100,Math.round((offset/fileSize)*100))+'%';
    const re=/<Workout\s[^>]*?workoutActivityType="([^"]*)"[^>]*?startDate="([^"]*)"[^>]*?duration="([^"]*)"[^>]*?(?:totalDistance="([^"]*)")?[^>]*?(?:totalEnergyBurned="([^"]*)")?[^>]*?\/?>/g;
    let m;
    while((m=re.exec(textBuffer))!==null){
      let type='other';const actType=m[1];
      if(actType.includes('Running'))type='running';else if(actType.includes('Walking'))type='walking';
      else if(actType.includes('Cycling'))type='cycling';else if(actType.includes('Swimming'))type='swimming';
      else if(actType.includes('StrengthTraining')||actType.includes('FunctionalStrength'))type='gym';
      workouts.push({type,actType,date:m[2].slice(0,10),duration:Math.round(parseFloat(m[3])||0),
        distance:Math.round((parseFloat(m[4])||0)*100)/100,calories:Math.round(parseFloat(m[5])||0),selected:true});
    }
    if(textBuffer.length>chunkSize*2) textBuffer=textBuffer.slice(-chunkSize);
    if(offset<fileSize){readNextChunk();return;}
    progressFill.style.width='100%';
    const unique=[],seen=new Set();
    workouts.forEach(w=>{const key=`${w.date}_${w.type}_${w.duration}`;if(!seen.has(key)){seen.add(key);unique.push(w);}});
    const toShow=unique.slice(-50).reverse();window._healthImportData=toShow;
    if(!toShow.length){preview.innerHTML='<p style="color:var(--text2)">Nessun allenamento trovato.</p>';return;}
    const typeNames={running:'Corsa',walking:'Camminata',cycling:'Ciclismo',swimming:'Nuoto',gym:'Palestra',other:'Altro'};
    let html=`<div class="card"><div class="card-title">Trovati ${unique.length} allenamenti</div><div style="max-height:400px;overflow-y:auto">`;
    toShow.forEach((w,i)=>{
      html+=`<div class="import-preview-item"><input type="checkbox" class="import-checkbox" ${w.selected?'checked':''} onchange="window._healthImportData[${i}].selected=this.checked">
        <span style="flex:1"><strong>${formatDate(w.date)}</strong> - ${typeNames[w.type]||w.type} - ${w.duration} min${w.distance?' - '+w.distance+' km':''}</span></div>`;
    });
    html+=`</div><button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="importHealthWorkouts()">Importa selezionati</button></div>`;
    preview.innerHTML=html;
  };
  reader.onerror=()=>toast('Errore lettura file','error');
  readNextChunk();
}

function importHealthWorkouts(){
  const data=window._healthImportData;if(!data)return;let count=0;
  data.filter(w=>w.selected).forEach(w=>{
    if(w.type==='running'||w.type==='walking'||w.type==='cycling'){
      const workout={id:uid(),type:'running',date:w.date,distance:w.distance||0,duration:w.duration,
        _pace:w.distance>0&&w.duration>0?(w.duration*60)/w.distance:0,runType:'easy',notes:`Importato da Apple Health`,imported:true};
      workout.scores=scoreWorkout(workout);workout.advice=getAdvice(workout);saveWorkout(workout);count++;
    } else if(w.type==='gym'){
      const workout={id:uid(),type:'gym',date:w.date,duration:w.duration,exercises:[],_tonnage:0,notes:`Importato da Apple Health`,imported:true};
      workout.scores=scoreWorkout(workout);workout.advice=getAdvice(workout);saveWorkout(workout);count++;
    }
  });
  toast(`${count} allenamenti importati!`,'success');
  document.getElementById('health-preview').innerHTML='';
}

// ==================== FIT FILE ====================
function handleFITFile(file) {
  if(!file) return;
  const preview=document.getElementById('fit-preview');
  preview.innerHTML='<p style="color:var(--text2);font-size:.85rem">Lettura file FIT...</p>';
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=parseFITMinimal(new Uint8Array(e.target.result));
      if(!data){preview.innerHTML='<p style="color:var(--red)">File FIT non valido.</p>';return;}
      preview.innerHTML=`<div class="card"><div class="card-title">File FIT</div><p style="font-size:.85rem;color:var(--text2)">Data: ${data.date} | Durata: ${data.duration||'--'} min</p>
        <button class="btn btn-primary btn-sm" onclick='importFITWorkout(${JSON.stringify(data)});this.disabled=true;this.textContent="Importato!"'>Importa</button></div>`;
    }catch(err){preview.innerHTML='<p style="color:var(--red)">Errore FIT: '+err.message+'</p>';}
  };
  reader.readAsArrayBuffer(file);
}

function parseFITMinimal(bytes) {
  if(bytes.length<14) return null;
  const signature=String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11]);
  if(signature!=='.FIT') return null;
  const result={date:todayStr(),duration:0};
  const FIT_EPOCH=631065600;
  const view=new DataView(bytes.buffer);
  let offset=bytes[0];
  try{
    const timestamps=[];
    while(offset<bytes.length-4){
      const val=view.getUint32(offset,true);
      if(val>900000000&&val<1200000000){
        const date=new Date((val+FIT_EPOCH)*1000);
        if(date.getFullYear()>=2015&&date.getFullYear()<=2030) timestamps.push(date);
      }
      offset++;
    }
    if(timestamps.length>1){
      result.date=timestamps[0].toISOString().slice(0,10);
      const dur=(timestamps[timestamps.length-1]-timestamps[0])/1000;
      if(dur>0&&dur<86400) result.duration=Math.round(dur/60);
    }
  }catch(e){}
  return result.duration>0?result:null;
}

function importFITWorkout(data){
  const workout={id:uid(),type:'gym',date:data.date,duration:data.duration,exercises:[],_tonnage:0,notes:'Importato da FIT',imported:true};
  workout.scores=scoreWorkout(workout);workout.advice=getAdvice(workout);saveWorkout(workout);
  toast('Importato da FIT!','success');
}

// ==================== EXPORT / IMPORT ====================
function exportAllData(){
  const data={workouts:workoutsCache,settings:settingsCache,exercises:exercisesCache,weights:weightsCache,exportDate:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='training_analyzer_backup_'+todayStr()+'.json';a.click();
  toast('Backup esportato!','success');
}

function importJSONBackup(file){
  if(!file)return;const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.workouts)data.workouts.forEach(w=>saveWorkout(w));
      if(data.settings)saveSettingsToFirebase(data.settings);
      if(data.exercises)saveExercisesToFirebase(data.exercises);
      if(data.weights)data.weights.forEach(w=>userRef('weights/'+(w.id||uid())).set(w));
      toast('Backup importato!','success');
    }catch(err){toast('Errore nel file JSON','error');}
  };reader.readAsText(file);
}

// ==================== SETTINGS ====================
function saveSettings(){
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
    activeSports: activeSports,
    muscleGroups: muscleGroups
  };
  saveSettingsToFirebase(s);
}

function populateSettingsUI(){
  const s=settingsCache;
  if(s.maxhr)document.getElementById('set-maxhr').value=s.maxhr;
  if(s.resthr)document.getElementById('set-resthr').value=s.resthr;
  if(s.bodyweight)document.getElementById('set-bodyweight').value=s.bodyweight;
  if(s.height){document.getElementById('set-height').value=s.height;document.getElementById('weight-height').value=s.height;}
  if(s.vo2max)document.getElementById('set-vo2max').value=s.vo2max;
  if(s.age)document.getElementById('set-age').value=s.age;
  if(s.gender)document.getElementById('set-gender').value=s.gender;
  if(s.weekgoal)document.getElementById('set-weekgoal').value=s.weekgoal;
  if(s.kmgoal)document.getElementById('set-kmgoal').value=s.kmgoal;
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
  // Active sports
  const activeEl = document.getElementById('active-sports-list');
  activeEl.innerHTML = activeSports.map(key => {
    const s = SPORT_TEMPLATES[key];
    if (!s) return '';
    const isFixed = s.fixed;
    return `<span class="sport-chip active">${s.icon} ${s.name}${isFixed?'':` <span class="remove-sport" onclick="removeSport('${key}')">&times;</span>`}</span>`;
  }).join('');

  // Available pool
  const poolEl = document.getElementById('available-sports-pool');
  const available = Object.keys(SPORT_TEMPLATES).filter(k => !activeSports.includes(k));
  poolEl.innerHTML = available.map(key => {
    const s = SPORT_TEMPLATES[key];
    return `<span class="sport-chip" onclick="addSport('${key}')">${s.icon} ${s.name}</span>`;
  }).join('');
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
  el.innerHTML = muscleGroups.map(m => {
    const isDefault = DEFAULT_MUSCLES.includes(m);
    return `<span class="muscle-chip">${m}${isDefault?'':`<span class="remove-muscle" onclick="removeMuscleGroup('${m.replace(/'/g,"\\'")}')">&times;</span>`}</span>`;
  }).join('');
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

// ==================== EXERCISE LIBRARY ====================
function renderExerciseLibrary(){
  const lib=exercisesCache||[];
  const container=document.getElementById('exercise-library-list');if(!container)return;
  container.innerHTML=lib.map((e,i)=>`<div class="lib-item"><span>${e.name}</span><div style="display:flex;align-items:center;gap:8px"><span class="muscle-tag">${e.muscle}</span><button class="btn-icon" onclick="removeExercise(${i})">&times;</button></div></div>`).join('');
}

function addExerciseToLibrary(){
  const name=document.getElementById('lib-name').value.trim(),muscle=document.getElementById('lib-muscle').value;
  if(!name){toast('Inserisci un nome!','error');return;}
  const lib=exercisesCache||[];
  if(lib.some(e=>e.name.toLowerCase()===name.toLowerCase())){toast('Esercizio gia presente!','error');return;}
  lib.push({name,muscle});lib.sort((a,b)=>a.name.localeCompare(b.name));
  saveExercisesToFirebase(lib);document.getElementById('lib-name').value='';toast('Esercizio aggiunto!','success');
}

function removeExercise(idx){
  const lib=[...(exercisesCache||[])];lib.splice(idx,1);saveExercisesToFirebase(lib);
}

// ==================== DRAG & DROP ====================
['gpx-drop','csv-drop','health-drop','fit-drop'].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover');});
  el.addEventListener('dragleave',()=>el.classList.remove('dragover'));
  el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');
    if(id==='gpx-drop')handleGPXFiles(e.dataTransfer.files);
    else if(id==='csv-drop')handleCSVFile(e.dataTransfer.files[0]);
    else if(id==='health-drop')handleAppleHealthFile(e.dataTransfer.files[0]);
    else if(id==='fit-drop')handleFITFile(e.dataTransfer.files[0]);
  });
});

// Close search results on click outside
document.addEventListener('click', e => {
  const searchResults = document.getElementById('friend-search-results');
  const searchInput = document.getElementById('friend-search');
  if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.className = 'search-results';
  }
});

// ==================== INIT ====================
function initApp(){
  document.getElementById('wiz-date').value=todayStr();
  document.getElementById('weight-date').value=todayStr();
  updateSyncStatus();
  renderDashboard();
}

// Boot
(function boot(){
  initFirebase();
})();
