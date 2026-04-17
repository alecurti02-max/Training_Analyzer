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
  totalScore += forzaScore;
  details.push({ label: 'Forza', value: `${Math.round(forzaScore)}/25`, pct: Math.round((forzaScore/25)*100), color: forzaScore/25 >= 0.7 ? 'var(--green)' : forzaScore/25 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: gymW30.length ? `${gymW30.length} sessioni palestra` : 'Nessun dato palestra' });

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
  totalScore += cardioScore;
  details.push({ label: 'Cardio', value: `${Math.round(cardioScore)}/25`, pct: Math.round((cardioScore/25)*100), color: cardioScore/25 >= 0.7 ? 'var(--green)' : cardioScore/25 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: vo2max ? `VO2 ${vo2max} ml/kg/min` : 'Inserisci VO2 Max' });

  // 3. ENDURANCE (20%)
  let enduranceScore = 0;
  const trainingDays30 = new Set(last30.map(w => w.date)).size;
  enduranceScore += (Math.min(10, trainingDays30 / 2)/10 * 8);
  const avgDuration = last30.length ? last30.reduce((s,w) => s + (w.duration||30), 0) / last30.length : 0;
  enduranceScore += ((avgDuration >= 60 ? 10 : avgDuration >= 45 ? 8 : avgDuration >= 30 ? 6 : avgDuration >= 15 ? 4 : 2)/10 * 7);
  const totalKm30 = runW30.reduce((s,w) => s + (w.distance||0), 0);
  enduranceScore += ((totalKm30 >= 80 ? 10 : totalKm30 >= 50 ? 8 : totalKm30 >= 25 ? 6 : totalKm30 >= 10 ? 4 : 2)/10 * 5);
  totalScore += enduranceScore;
  details.push({ label: 'Endurance', value: `${Math.round(enduranceScore)}/20`, pct: Math.round((enduranceScore/20)*100), color: enduranceScore/20 >= 0.7 ? 'var(--green)' : enduranceScore/20 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `${trainingDays30} gg attivi, ${totalKm30.toFixed(0)} km` });

  // 4. COMPOSIZIONE CORPOREA (15%)
  let bodyScore = 0;
  if (weight && height) {
    const bmi = weight / ((height/100) ** 2);
    bodyScore += ((bmi >= 18.5 && bmi < 25 ? 10 : bmi >= 17 && bmi < 27 ? 7 : bmi >= 15 && bmi < 30 ? 4 : 2)/10 * 10);
    if (weightsCache && weightsCache.length >= 2) {
      const target = settingsCache.weightTarget || null;
      if (target) {
        const recent = weightsCache[weightsCache.length - 1].value;
        const older = weightsCache[Math.max(0, weightsCache.length - 5)].value;
        bodyScore += Math.abs(recent - target) < Math.abs(older - target) ? 5 : 2;
      } else { bodyScore += 3; }
    } else { bodyScore += 3; }
  } else { bodyScore = 5; }
  totalScore += bodyScore;
  details.push({ label: 'Composizione', value: `${Math.round(bodyScore)}/15`, pct: Math.round((bodyScore/15)*100), color: bodyScore/15 >= 0.7 ? 'var(--green)' : bodyScore/15 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: weight && height ? `${weight} kg, BMI ${(weight/((height/100)**2)).toFixed(1)}` : 'Inserisci peso e altezza' });

  // 5. FLESSIBILITA (10%)
  let flexScore = (flexibility / 10) * 10;
  totalScore += flexScore;
  details.push({ label: 'Flessibilita', value: `${Math.round(flexScore)}/10`, pct: Math.round((flexScore/10)*100), color: flexScore/10 >= 0.7 ? 'var(--green)' : flexScore/10 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `Auto-valutazione: ${flexibility}/10` });

  // 6. ATLETICITA INTEGRATA (5%)
  const sportTypes = new Set(last30.map(w => w.type)).size;
  let athleticScore = Math.min(5, sportTypes * 1.5 + (trainingDays30 >= 12 ? 1 : 0));
  totalScore += athleticScore;
  details.push({ label: 'Atleticita', value: `${Math.round(athleticScore*10)/10}/5`, pct: Math.round((athleticScore/5)*100), color: athleticScore/5 >= 0.7 ? 'var(--green)' : athleticScore/5 >= 0.4 ? 'var(--yellow)' : 'var(--red)', sublabel: `${sportTypes} sport praticati` });

  const finalPct = Math.round(totalScore);
  let level, levelColor;
  if (finalPct >= 85) { level = 'Eccellente'; levelColor = 'var(--green)'; }
  else if (finalPct >= 70) { level = 'Buono'; levelColor = 'var(--blue)'; }
  else if (finalPct >= 50) { level = 'Nella media'; levelColor = 'var(--yellow)'; }
  else if (finalPct >= 30) { level = 'Da migliorare'; levelColor = 'var(--orange)'; }
  else { level = 'Insufficiente'; levelColor = 'var(--red)'; }
  return { score: finalPct, level, levelColor, details };
}
