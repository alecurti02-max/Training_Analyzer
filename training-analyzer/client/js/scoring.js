// ==================== SCORING MODULE ====================
// Pure scoring functions, recovery status, streak, and fitness assessment.
// All functions receive data as parameters — no global state access.

// ==================== LOCAL HELPERS ====================
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysBetween(d1,d2) { return Math.abs(Math.floor((new Date(d1)-new Date(d2))/86400000)); }
function paceToSeconds(p) { if(!p)return 0; const parts=String(p).split(':'); return parts.length===2?parseInt(parts[0])*60+parseInt(parts[1]):parseFloat(p)*60; }
function secondsToPace(s) { if(!s||s<=0)return'--'; const m=Math.floor(s/60),sec=Math.round(s%60); return m+':'+String(sec).padStart(2,'0'); }

// ==================== TONNAGE ====================
// Computes effective tonnage accounting for weightMode (total | per_side),
// barbellWeight, and unilateral exercises (weightLeft + weightRight).
export function calcTonnage(exercises) {
  let tonnage = 0;
  (exercises || []).forEach(ex => {
    const wm = ex.weightMode || 'total';
    const bw = ex.barbellWeight || 0;
    const uni = ex.isUnilateral || false;
    (ex.sets || []).forEach(s => {
      if (uni) {
        const wL = (s.weightLeft || 0) + bw;
        const wR = (s.weightRight || 0) + bw;
        if (wm === 'per_side') {
          tonnage += (s.reps || 0) * (wL + wR) * 2;
        } else {
          tonnage += (s.reps || 0) * (wL + wR);
        }
      } else {
        let ew = s.weight || 0;
        if (wm === 'per_side') ew *= 2;
        ew += bw;
        tonnage += (s.reps || 0) * ew;
      }
    });
  });
  return tonnage;
}

// ==================== SCORING ====================
export function scoreGymWorkout(workout, workoutsCache, settingsCache) {
  const scores = {};
  const tonnage = calcTonnage(workout.exercises);
  workout._tonnage = tonnage;
  const recentGym = workoutsCache.filter(w => w.type==='gym' && w.id!==workout.id).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
  const avgTonnage = recentGym.length ? recentGym.reduce((s,w)=>s+(w._tonnage||0),0)/recentGym.length : tonnage;
  scores.volume = avgTonnage > 0 ? Math.min(10,Math.max(1,Math.round((tonnage/avgTonnage)*7))) : 7;
  scores.intensity = Math.min(10, Math.round(workout.rpe||7));
  const muscles = new Set();
  (workout.exercises||[]).forEach(ex => { if(ex.muscle) muscles.add(ex.muscle); });
  scores.variety = Math.min(10, Math.max(3, muscles.size*2));
  const maxSetWeight = (ex) => {
    if (ex.isUnilateral) return Math.max(...(ex.sets||[]).map(s => Math.max(s.weightLeft||0, s.weightRight||0)), 0);
    return Math.max(...(ex.sets||[]).map(s => s.weight||0), 0);
  };
  let prog=0, tot=0;
  (workout.exercises||[]).forEach(ex => {
    const prev = recentGym.find(w => (w.exercises||[]).some(e => e.name===ex.name));
    if (prev) {
      const prevEx = prev.exercises.find(e => e.name===ex.name);
      if (maxSetWeight(ex) >= maxSetWeight(prevEx)) prog++;
      tot++;
    }
  });
  scores.progression = tot > 0 ? Math.min(10,Math.round(5+(prog/tot)*5)) : 6;
  const dur = workout.duration||60;
  scores.duration = dur>=40&&dur<=90 ? 8 : (dur>=30&&dur<=120 ? 6 : 4);
  scores.overall = Math.round((scores.volume*.25+scores.intensity*.25+scores.progression*.25+scores.variety*.15+scores.duration*.1)*10)/10;
  return scores;
}

export function scoreRunWorkout(workout, workoutsCache, settingsCache) {
  const scores = {};
  const maxHR = (settingsCache && settingsCache.maxhr) || 190;
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

export function scoreKartWorkout(workout, workoutsCache) {
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

export function scoreGenericWorkout(workout) {
  const scores = {};
  scores.effort = Math.min(10, workout.rpe||6);
  const dur = workout.duration||30;
  scores.duration = dur>=20&&dur<=90 ? 7 : (dur>=10&&dur<=120 ? 5 : 3);
  scores.overall = Math.round((scores.effort*.6+scores.duration*.4)*10)/10;
  return scores;
}

export function scoreWorkout(workout, workoutsCache, settingsCache) {
  if (workout.type === 'gym') return scoreGymWorkout(workout, workoutsCache, settingsCache);
  if (workout.type === 'running') return scoreRunWorkout(workout, workoutsCache, settingsCache);
  if (workout.type === 'karting') return scoreKartWorkout(workout, workoutsCache);
  return scoreGenericWorkout(workout);
}

export function getAdvice(workout) {
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
export function getRecoveryStatus(workoutsCache, muscleGroups) {
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
export function calculateStreak(workoutsCache) {
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

// ==================== BODY COMPOSITION SUB-SCORE ====================
// Ritorna sub-score 0-10 + peso dinamico nel punteggio totale (15-35%) in base
// a quanti componenti sono disponibili. Soglie età-continue (Jackson-Pollock
// linearizzato) per massa grassa e massa muscolare. `gender` è obbligatorio.
export function bodyCompositionSubScore(s) {
  const gender = s.gender || null;
  if (!gender) return { score: null, weight: 15, components: [], reason: 'gender-missing' };
  const age = s.age || null;
  const height = s.height || null;
  const weight = s.bodyweight || null;
  const bf = s.bodyFat, vf = s.visceralFat, sm = s.skeletalMuscle;
  const cw = s.circWaist, ch = s.circHips;
  const components = [];

  // 1) Waist-to-height ratio (35%) — fallback BMI se manca la vita
  if (cw && height) {
    const whtr = cw / height;
    let score;
    if (whtr < 0.42) score = 7;
    else if (whtr <= 0.50) score = 10;
    else if (whtr <= 0.55) score = 10 - (whtr - 0.50) / 0.05 * 3;
    else if (whtr <= 0.60) score = 7 - (whtr - 0.55) / 0.05 * 3;
    else score = Math.max(1, 4 - (whtr - 0.60) * 20);
    components.push({ key: 'whtr', label: 'Vita/Altezza', weight: 35, score, value: whtr.toFixed(2) });
  } else if (weight && height) {
    const bmi = weight / ((height / 100) ** 2);
    let score;
    if (bmi < 17) score = 3;
    else if (bmi < 18.5) score = 6;
    else if (bmi < 25) score = 9;
    else if (bmi < 27) score = 7;
    else if (bmi < 30) score = 5;
    else score = Math.max(1, 5 - (bmi - 30) * 0.5);
    components.push({ key: 'bmi', label: 'BMI', weight: 35, score, value: bmi.toFixed(1), fallback: true });
  }

  // 2) Massa grassa % (35%) — soglie lineari con età (J-P)
  if (bf != null && age) {
    const d = age - 25;
    let atl, fit, med, acc;
    if (gender === 'M') {
      atl = 11 + 0.125 * d; fit = 13 + 0.125 * d; med = 17 + 0.125 * d; acc = 22 + 0.100 * d;
    } else {
      atl = 14 + 0.150 * d; fit = 16 + 0.175 * d; med = 19 + 0.200 * d; acc = 23 + 0.175 * d;
    }
    let score;
    if (bf <= atl) score = 10;
    else if (bf <= fit) score = 10 - (bf - atl) / (fit - atl) * 1.5;
    else if (bf <= med) score = 8.5 - (bf - fit) / (med - fit) * 1.5;
    else if (bf <= acc) score = 7 - (bf - med) / (acc - med) * 2;
    else score = Math.max(1, 5 - (bf - acc) * 0.3);
    components.push({ key: 'bf', label: 'Massa grassa', weight: 35, score, value: bf.toFixed(1) + '%' });
  }

  // 3) Grasso viscerale (15%) — indice bilancia impedenziometrica
  if (vf != null) {
    let score;
    if (vf <= 9) score = 10;
    else if (vf <= 12) score = 10 - (vf - 9);
    else if (vf <= 14) score = 7 - (vf - 12) * 1.5;
    else score = Math.max(1, 4 - (vf - 14) * 0.5);
    components.push({ key: 'vf', label: 'Grasso viscerale', weight: 15, score, value: String(vf) });
  }

  // 4) Waist-to-hip ratio (10%)
  if (cw && ch) {
    const whr = cw / ch;
    const lo = gender === 'M' ? 0.90 : 0.80;
    const hi = gender === 'M' ? 0.95 : 0.85;
    let score;
    if (whr <= lo) score = 10;
    else if (whr <= hi) score = 10 - (whr - lo) / (hi - lo) * 5;
    else score = Math.max(1, 5 - (whr - hi) * 30);
    components.push({ key: 'whr', label: 'Vita/Fianchi', weight: 10, score, value: whr.toFixed(2) });
  }

  // 5) Massa muscolare % (5% bonus) — sarcopenia ~-0.05%/anno
  if (sm != null && age) {
    const d = age - 25;
    let low, mid, hi;
    if (gender === 'M') { low = 33 - 0.05 * d; mid = 37 - 0.05 * d; hi = 40 - 0.05 * d; }
    else { low = 24 - 0.05 * d; mid = 28 - 0.05 * d; hi = 31 - 0.05 * d; }
    let score;
    if (sm >= hi) score = 10;
    else if (sm >= mid) score = 7.5 + (sm - mid) / (hi - mid) * 2.5;
    else if (sm >= low) score = 5 + (sm - low) / (mid - low) * 2.5;
    else score = Math.max(2, 5 - (low - sm) * 0.5);
    components.push({ key: 'sm', label: 'Massa muscolare', weight: 5, score, value: sm.toFixed(1) + '%' });
  }

  if (components.length === 0) return { score: null, weight: 15, components: [], reason: 'no-data' };

  const totalW = components.reduce((a, c) => a + c.weight, 0);
  const subScore = components.reduce((a, c) => a + c.score * c.weight, 0) / totalW;

  // Peso dinamico nel totale: più dati = più peso (min 15, max 35)
  const k = new Set(components.map(c => c.key));
  const hasWaist = k.has('whtr');
  const hasBF = k.has('bf');
  const hasVF = k.has('vf');
  const hasMod = k.has('whr') || k.has('sm');
  let dynWeight;
  if (hasWaist && hasBF && hasVF) dynWeight = hasMod ? 35 : 30;
  else if (hasWaist && (hasBF || hasVF)) dynWeight = 25;
  else if (hasWaist || hasBF) dynWeight = 20;
  else dynWeight = 15;

  return { score: subScore, weight: dynWeight, components, reason: null };
}

// ==================== FITNESS ASSESSMENT ====================
export function getFitnessAssessment(workoutsCache, settingsCache, weightsCache, muscleGroups) {
  const gender = settingsCache.gender || null;
  const vo2max = settingsCache.vo2max || null;
  const resthr = settingsCache.resthr || null;
  const weight = settingsCache.bodyweight || null;
  const height = settingsCache.height || null;
  const flexibility = settingsCache.flexibility || 5;
  const now = todayStr();
  const last30 = workoutsCache.filter(w => daysBetween(now, w.date) <= 30);
  const gymW30 = last30.filter(w => w.type === 'gym');
  const runW30 = last30.filter(w => w.type === 'running');
  let totalScore = 0;
  const details = [];

  // Body-comp sub-score: peso dinamico 15-35 in base ai dati inseriti.
  // Gli altri sub-score (forza, cardio, endurance, flex, atleticità) vengono
  // rescalati proporzionalmente in modo che il totale resti 100.
  const bc = bodyCompositionSubScore(settingsCache);
  const WB = bc.weight;
  const scale = (100 - WB) / 85;

  // 1. FORZA MUSCOLARE (25%)
  let forzaScore = 0;
  if (gymW30.length) {
    let relStrength = 5;
    if (weight) {
      let best1RM = 0;
      workoutsCache.filter(w => w.type === 'gym').forEach(w => (w.exercises||[]).forEach(ex => {
        if (['Squat','Panca Piana','Stacco da Terra','Military Press','Stacco Rumeno'].some(n => ex.name.includes(n))) {
          const wm = ex.weightMode || 'total';
          const bw = ex.barbellWeight || 0;
          (ex.sets||[]).forEach(s => {
            let ew = s.weight || 0;
            if (ex.isUnilateral) ew = Math.max(s.weightLeft||0, s.weightRight||0);
            if (wm === 'per_side') ew *= 2;
            ew += bw;
            const orm = ew * (1 + (s.reps || 0) / 30);
            if (orm > best1RM) best1RM = orm;
          });
        }
      }));
      if (best1RM > 0) relStrength = Math.min(10, Math.max(1, Math.round((best1RM / weight) * 5)));
    }
    const recentTonnage = gymW30.reduce((s,w) => s + (w._tonnage||0), 0);
    const gymW60_90 = workoutsCache.filter(w => w.type === 'gym' && daysBetween(now, w.date) > 30 && daysBetween(now, w.date) <= 60);
    const prevTonnage = gymW60_90.reduce((s,w) => s + (w._tonnage||0), 0);
    let volumeTrend = prevTonnage > 0 ? (recentTonnage >= prevTonnage ? Math.min(10, 5 + Math.round((recentTonnage/prevTonnage - 1) * 10)) : Math.max(1, Math.round((recentTonnage/prevTonnage) * 5))) : (recentTonnage > 0 ? 6 : 5);
    const progression = gymW30.reduce((s,w) => s + (w.scores?.progression||5), 0) / gymW30.length;
    forzaScore = (relStrength/10 * 12) + (volumeTrend/10 * 8) + (progression/10 * 5);
  } else { forzaScore = 5; }
  const forzaMax = 25 * scale;
  const forzaContrib = forzaScore * scale;
  totalScore += forzaContrib;
  details.push({ label: 'Forza', value: `${Math.round(forzaContrib)}/${Math.round(forzaMax)}`, pct: Math.round((forzaScore/25)*100), color: forzaScore/25 >= 0.7 ? 'var(--green)' : forzaScore/25 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: gymW30.length ? `${gymW30.length} sessioni palestra` : 'Nessun dato palestra' });

  // 2. RESISTENZA CARDIOVASCOLARE (25%)
  let cardioScore = 0;
  let vo2Score = 5;
  if (vo2max) { vo2Score = gender === 'F' ? (vo2max >= 40 ? 10 : vo2max >= 33 ? 7.5 : vo2max >= 27 ? 5 : 3) : (vo2max >= 50 ? 10 : vo2max >= 42 ? 7.5 : vo2max >= 35 ? 5 : 3); }
  cardioScore += (vo2Score/10 * 12);
  let paceScore = 5;
  if (runW30.length >= 2) {
    const paces = runW30.filter(w => w._pace > 0).map(w => ({ pace: w._pace, dist: w.distance || 1 }));
    if (paces.length >= 2) {
      const td = paces.reduce((s,p) => s + p.dist, 0);
      const wp = paces.reduce((s,p) => s + p.pace * (p.dist/td), 0);
      const oldRuns = workoutsCache.filter(w => w.type === 'running' && w._pace > 0 && daysBetween(now, w.date) > 30 && daysBetween(now, w.date) <= 90);
      if (oldRuns.length) {
        const otd = oldRuns.reduce((s,w) => s + (w.distance||1), 0);
        const owp = oldRuns.reduce((s,w) => s + w._pace * ((w.distance||1)/otd), 0);
        paceScore = wp <= owp ? Math.min(10, 7 + Math.round((1 - wp/owp) * 30)) : Math.max(2, Math.round((owp/wp) * 7));
      } else { paceScore = 6; }
    }
  }
  cardioScore += (paceScore/10 * 8);
  let hrScore = 5;
  if (resthr) { hrScore = resthr <= 50 ? 10 : resthr <= 60 ? 8 : resthr <= 70 ? 6 : resthr <= 80 ? 4 : 2; }
  cardioScore += (hrScore/10 * 5);
  const cardioMax = 25 * scale;
  const cardioContrib = cardioScore * scale;
  totalScore += cardioContrib;
  details.push({ label: 'Cardio', value: `${Math.round(cardioContrib)}/${Math.round(cardioMax)}`, pct: Math.round((cardioScore/25)*100), color: cardioScore/25 >= 0.7 ? 'var(--green)' : cardioScore/25 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: vo2max ? `VO2 ${vo2max} ml/kg/min` : 'Inserisci VO2 Max' });

  // 3. ENDURANCE (20%)
  let enduranceScore = 0;
  const trainingDays30 = new Set(last30.map(w => w.date)).size;
  enduranceScore += (Math.min(10, trainingDays30 / 2)/10 * 8);
  const avgDuration = last30.length ? last30.reduce((s,w) => s + (w.duration||30), 0) / last30.length : 0;
  enduranceScore += ((avgDuration >= 60 ? 10 : avgDuration >= 45 ? 8 : avgDuration >= 30 ? 6 : avgDuration >= 15 ? 4 : 2)/10 * 7);
  const totalKm30 = runW30.reduce((s,w) => s + (w.distance||0), 0);
  enduranceScore += ((totalKm30 >= 80 ? 10 : totalKm30 >= 50 ? 8 : totalKm30 >= 25 ? 6 : totalKm30 >= 10 ? 4 : 2)/10 * 5);
  const endMax = 20 * scale;
  const endContrib = enduranceScore * scale;
  totalScore += endContrib;
  details.push({ label: 'Endurance', value: `${Math.round(endContrib)}/${Math.round(endMax)}`, pct: Math.round((enduranceScore/20)*100), color: enduranceScore/20 >= 0.7 ? 'var(--green)' : enduranceScore/20 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `${trainingDays30} gg attivi, ${totalKm30.toFixed(0)} km` });

  // 4. COMPOSIZIONE CORPOREA (peso dinamico 15-35%)
  let bodyContrib, bodySub, bodySublabel;
  if (bc.score != null) {
    bodyContrib = (bc.score / 10) * WB;
    bodySub = bc.components.map(c => `${c.label} ${c.value}`).join(', ');
  } else if (bc.reason === 'gender-missing') {
    // Senza sesso non possiamo interpretare le soglie: contributo neutro 5/15
    bodyContrib = 0.5 * WB;
    bodySub = 'Imposta il sesso in Impostazioni per attivare la valutazione';
  } else if (weight && height) {
    // Nessun dato di composizione ma abbiamo peso+altezza: BMI fallback leggero
    const bmi = weight / ((height/100) ** 2);
    const bmiS = bmi >= 18.5 && bmi < 25 ? 9 : bmi >= 17 && bmi < 27 ? 7 : bmi >= 15 && bmi < 30 ? 4 : 2;
    bodyContrib = (bmiS / 10) * WB;
    bodySub = `BMI ${bmi.toFixed(1)} — aggiungi circonferenza vita o massa grassa per una valutazione più accurata`;
  } else {
    bodyContrib = 0.5 * WB;
    bodySub = 'Inserisci peso, altezza e (opzionale) dati bilancia impedenziometrica';
  }
  totalScore += bodyContrib;
  details.push({
    label: 'Composizione',
    value: `${Math.round(bodyContrib)}/${Math.round(WB)}`,
    pct: Math.round((bodyContrib / WB) * 100),
    color: bodyContrib/WB >= 0.7 ? 'var(--green)' : bodyContrib/WB >= 0.4 ? 'var(--yellow)' : 'var(--red)',
    sublabel: bodySub,
    bodyComponents: bc.components,
  });

  // 5. FLESSIBILITA (10%)
  let flexScore = (flexibility / 10) * 10;
  const flexMax = 10 * scale;
  const flexContrib = flexScore * scale;
  totalScore += flexContrib;
  details.push({ label: 'Flessibilita', value: `${Math.round(flexContrib)}/${Math.round(flexMax)}`, pct: Math.round((flexScore/10)*100), color: flexScore/10 >= 0.7 ? 'var(--green)' : flexScore/10 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `Auto-valutazione: ${flexibility}/10` });

  // 6. ATLETICITA INTEGRATA (5%)
  const sportTypes = new Set(last30.map(w => w.type)).size;
  let athleticScore = Math.min(5, sportTypes * 1.5 + (trainingDays30 >= 12 ? 1 : 0));
  const atlMax = 5 * scale;
  const atlContrib = athleticScore * scale;
  totalScore += atlContrib;
  details.push({ label: 'Atleticita', value: `${Math.round(atlContrib*10)/10}/${Math.round(atlMax*10)/10}`, pct: Math.round((athleticScore/5)*100), color: athleticScore/5 >= 0.7 ? 'var(--green)' : athleticScore/5 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `${sportTypes} sport praticati` });

  const finalPct = Math.round(totalScore);
  let level, levelColor;
  if (finalPct >= 85) { level = 'Eccellente'; levelColor = 'var(--green)'; }
  else if (finalPct >= 70) { level = 'Buono'; levelColor = 'var(--blue)'; }
  else if (finalPct >= 50) { level = 'Nella media'; levelColor = 'var(--yellow)'; }
  else if (finalPct >= 30) { level = 'Da migliorare'; levelColor = 'var(--orange)'; }
  else { level = 'Insufficiente'; levelColor = 'var(--red)'; }
  return { score: finalPct, level, levelColor, details, bodyComp: bc };
}
