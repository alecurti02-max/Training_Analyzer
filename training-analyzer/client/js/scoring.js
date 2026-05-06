// ==================== SCORING MODULE ====================
// Pure scoring functions, recovery status, streak, and fitness assessment.
// All functions receive data as parameters — no global state access.

// ==================== LOCAL HELPERS ====================
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysBetween(d1,d2) { return Math.abs(Math.floor((new Date(d1)-new Date(d2))/86400000)); }
function paceToSeconds(p) { if(!p)return 0; const parts=String(p).split(':'); return parts.length===2?parseInt(parts[0])*60+parseInt(parts[1]):parseFloat(p)*60; }
function secondsToPace(s) { if(!s||s<=0)return'--'; let m=Math.floor(s/60),sec=Math.round(s%60); if(sec===60){m+=1;sec=0;} return m+':'+String(sec).padStart(2,'0'); }

// ==================== TONNAGE ====================
// Computes effective tonnage accounting for weightMode (total | per_side),
// barbellWeight, unilateral exercises (weightLeft + weightRight),
// bodyweight sets (weight = added load on top of userBodyweight) and drop sets.
export function calcTonnage(exercises, userBodyweight = 0) {
  let tonnage = 0;
  (exercises || []).forEach(ex => {
    const wm = ex.weightMode || 'total';
    const bw = ex.barbellWeight || 0;
    const uni = ex.isUnilateral || false;
    (ex.sets || []).forEach(s => {
      const bodyAdd = s.bodyweight ? (userBodyweight || 0) : 0;
      if (uni) {
        const wL = (s.weightLeft || 0) + bw + bodyAdd;
        const wR = (s.weightRight || 0) + bw + bodyAdd;
        if (wm === 'per_side') {
          tonnage += (s.reps || 0) * (wL + wR) * 2;
        } else {
          tonnage += (s.reps || 0) * (wL + wR);
        }
      } else {
        let ew = (s.weight || 0) + bodyAdd;
        if (wm === 'per_side') ew *= 2;
        ew += bw;
        tonnage += (s.reps || 0) * ew;
        (s.drops || []).forEach(d => {
          let dw = (d.weight || 0) + bodyAdd;
          if (wm === 'per_side') dw *= 2;
          dw += bw;
          tonnage += (d.reps || 0) * dw;
        });
      }
    });
  });
  return tonnage;
}

// ==================== SCORING ====================
export function scoreGymWorkout(workout, workoutsCache, settingsCache) {
  const scores = {};
  const tonnage = calcTonnage(workout.exercises, settingsCache?.bodyweight || 0);
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

// ==================== ADVICE: regole espanse, output strutturato ====================
// Output uniforme con quello dell'analisi AI lato server:
// { summary, type_classification, highlights[{kind,text}], suggestions[{priority,text}],
//   comparison_to_history{trend,notes}, confidence, source: 'rules' }
// Mantiene firma estesa: workoutsCache e settingsCache opzionali per fallback retrocompat.

function _hrZone(pct) {
  if (pct == null) return null;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

function _stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = arr.reduce((a,b)=>a+b,0) / arr.length;
  const v = arr.reduce((a,b)=>a+(b-m)**2,0) / arr.length;
  return Math.sqrt(v);
}

function _classifyRun(workout, settings) {
  const maxHR = (settings && settings.maxhr) || 190;
  const dist = workout.distance || 0;
  const dur = workout.duration || 0;
  const pace = workout._pace || (dur > 0 && dist > 0 ? (dur * 60) / dist : 0);
  const hrPct = workout.avghr ? workout.avghr / maxHR : null;
  const splits = (workout.splits || []).map(s => s.pace).filter(v => v > 0);
  const cv = splits.length >= 3 ? _stdDev(splits) / (splits.reduce((a,b)=>a+b,0)/splits.length) : 0;

  if (dur > 0 && dur < 15 && (hrPct == null || hrPct >= 0.85)) return 'sprint / breve intenso';
  if (cv >= 0.12) return 'ritmi / intervalli';
  if (hrPct != null && hrPct < 0.7 && dist < 6) return 'recupero attivo';
  if (hrPct != null && hrPct < 0.78 && dist >= 8) return 'lungo lento';
  if (dist >= 12) return 'lungo';
  if (dist <= 4 && dur <= 25) return 'corsa breve';
  return 'ritmo medio';
}

function _hrDriftPct(hrSeries) {
  if (!Array.isArray(hrSeries) || hrSeries.length < 6) return null;
  const hrs = hrSeries.map(p => p.hr || 0).filter(v => v > 0);
  if (hrs.length < 6) return null;
  const half = Math.floor(hrs.length / 2);
  const a1 = hrs.slice(0, half).reduce((a,b)=>a+b,0) / half;
  const a2 = hrs.slice(half).reduce((a,b)=>a+b,0) / (hrs.length - half);
  return a1 > 0 ? Math.round(((a2 - a1) / a1) * 1000) / 10 : null;
}

function _formatPace(secs) { return secondsToPace(secs); }

function _runningHistoryStats(workout, cache) {
  const now = todayStr();
  const others = (cache || []).filter(w => w.type === 'running' && w.id !== workout.id);
  const last30 = others.filter(w => daysBetween(now, w.date) <= 30);
  const last7 = others.filter(w => daysBetween(now, w.date) <= 7);
  const km30 = last30.reduce((s,w) => s + (w.distance || 0), 0);
  const km7 = last7.reduce((s,w) => s + (w.distance || 0), 0);
  const paces30 = last30.map(w => w._pace || 0).filter(v => v > 0);
  const avgPace30 = paces30.length ? paces30.reduce((a,b)=>a+b,0) / paces30.length : null;
  const sameDist = others.filter(w => Math.abs((w.distance||0) - (workout.distance||0)) < 1.5);
  const bestPaceSameDist = sameDist.length ? Math.min(...sameDist.map(w => w._pace||9999)) : null;
  return { count30: last30.length, km30, km7, avgPace30, bestPaceSameDist };
}

function adviceRunning(workout, workoutsCache, settingsCache) {
  const highlights = [], suggestions = [];
  const dist = workout.distance || 0;
  const dur = workout.duration || 0;
  const pace = workout._pace || (dur > 0 && dist > 0 ? (dur * 60) / dist : 0);
  const maxHR = (settingsCache && settingsCache.maxhr) || 190;
  const hrPct = workout.avghr ? workout.avghr / maxHR : null;
  const zone = _hrZone(hrPct);
  const classification = _classifyRun(workout, settingsCache);
  const drift = _hrDriftPct(workout.hrSeries);
  const stats = _runningHistoryStats(workout, workoutsCache);

  let summary = `${classification.charAt(0).toUpperCase() + classification.slice(1)}`;
  if (dist) summary += ` · ${dist.toFixed(2)} km`;
  if (pace > 0) summary += ` · pace ${_formatPace(pace)}/km`;
  if (hrPct != null) summary += ` · FC ${workout.avghr} (${Math.round(hrPct*100)}% max, Z${zone})`;

  if (zone === 2 && (classification === 'lungo lento' || classification === 'recupero attivo')) {
    highlights.push({ kind: 'positive', text: `Sessione tenuta in zona ${zone}: stimolo aerobico pulito.` });
  } else if (zone === 5) {
    highlights.push({ kind: 'concern', text: `FC media in zona 5 (${Math.round(hrPct*100)}% max): sessione molto stressante.` });
  } else if (zone) {
    highlights.push({ kind: 'neutral', text: `Intensità in zona ${zone} (${Math.round(hrPct*100)}% FC max).` });
  }

  if (workout.splits && workout.splits.length >= 3) {
    const ps = workout.splits.map(s => s.pace).filter(v => v > 0);
    const cv = _stdDev(ps) / (ps.reduce((a,b)=>a+b,0)/ps.length);
    const third = Math.ceil(ps.length / 3);
    const firstAvg = ps.slice(0, third).reduce((a,b)=>a+b,0) / third;
    const lastAvg = ps.slice(-third).reduce((a,b)=>a+b,0) / third;
    if (lastAvg < firstAvg - 5) {
      highlights.push({ kind: 'positive', text: `Negative split: finale a ${_formatPace(lastAvg)}/km vs avvio ${_formatPace(firstAvg)}/km.` });
    } else if (lastAvg > firstAvg + 10) {
      highlights.push({ kind: 'concern', text: `Positive split: ultimo terzo ${_formatPace(lastAvg)}/km, prima parte ${_formatPace(firstAvg)}/km. Hai pagato il finale.` });
      suggestions.push({ priority: 'high', text: 'Parti più conservativo nei prossimi lavori sulla stessa distanza: i primi 2 km a 5-10 sec/km più lenti del target.' });
    }
    if (cv >= 0.12 && classification.includes('intervalli')) {
      highlights.push({ kind: 'neutral', text: `Variabilità split alta (CV ${Math.round(cv*100)}%), coerente con un lavoro a intervalli.` });
    }
  }

  if (drift != null) {
    if (drift >= 7) {
      highlights.push({ kind: 'concern', text: `Cardiac drift +${drift}% (FC seconda metà più alta a parità di sforzo): segno di affaticamento o disidratazione.` });
      suggestions.push({ priority: 'med', text: 'Idratati prima e durante; se il drift è ricorrente, riduci di 5-10s/km il pace dei lunghi per 1-2 settimane.' });
    } else if (drift <= 1) {
      highlights.push({ kind: 'positive', text: `FC stabile per tutta la sessione (drift ${drift}%): buon adattamento aerobico.` });
    }
  }

  let trend = 'n/a', notes = '';
  if (stats.avgPace30 && pace > 0) {
    const diff = stats.avgPace30 - pace;
    if (Math.abs(diff) < 5) { trend = 'flat'; notes = `Pace in linea con la media 30gg (${_formatPace(stats.avgPace30)}/km).`; }
    else if (diff > 0) { trend = 'up'; notes = `Pace ${Math.round(diff)}s/km più veloce della media 30gg (${_formatPace(stats.avgPace30)}/km).`; highlights.push({ kind: 'positive', text: notes }); }
    else { trend = 'down'; notes = `Pace ${Math.round(-diff)}s/km più lento della media 30gg (${_formatPace(stats.avgPace30)}/km).`; }
  } else if (!stats.count30) {
    notes = 'Storico running insufficiente per un confronto attendibile.';
  }
  if (stats.bestPaceSameDist && pace > 0 && pace <= stats.bestPaceSameDist) {
    highlights.unshift({ kind: 'positive', text: `Nuovo personal best su ~${dist.toFixed(0)}km a ${_formatPace(pace)}/km.` });
  }

  if (stats.km7 + dist >= 60) {
    highlights.push({ kind: 'concern', text: `Volume settimanale alto: ${(stats.km7 + dist).toFixed(0)} km in 7gg (incluso oggi).` });
    suggestions.push({ priority: 'high', text: 'Inserisci almeno un giorno di scarico nella settimana prossima per evitare overreaching.' });
  } else if (stats.km7 + dist > 0) {
    highlights.push({ kind: 'neutral', text: `Volume 7gg: ${(stats.km7 + dist).toFixed(1)} km.` });
  }

  if (classification === 'lungo lento' && dist >= 12 && (workout.rpe || 0) >= 8) {
    suggestions.push({ priority: 'high', text: 'Domani recupero o riposo: lungo intenso richiede 24-48h prima di un altro lavoro qualitativo.' });
  }
  if (classification === 'ritmi / intervalli') {
    suggestions.push({ priority: 'med', text: 'Prossima sessione qualità a 48h di distanza: nel mezzo solo fondo lento o riposo.' });
  }
  if (zone && zone <= 2 && classification !== 'lungo lento' && classification !== 'recupero attivo' && dist < 8) {
    suggestions.push({ priority: 'low', text: 'Hai corso piano: la prossima alterna 4-6 allunghi finali da 80m per stimolare le gambe.' });
  }
  if (!suggestions.length) suggestions.push({ priority: 'low', text: 'Mantieni la consistenza settimanale: 3-4 sessioni con un solo lavoro intenso.' });

  return {
    source: 'rules',
    summary,
    type_classification: classification,
    highlights: highlights.slice(0, 6),
    suggestions: suggestions.slice(0, 4),
    comparison_to_history: { trend, notes },
    confidence: stats.count30 >= 3 ? 0.7 : (stats.count30 ? 0.5 : 0.3),
  };
}

const PUSH_MUSCLES = new Set(['Petto','Spalle','Tricipiti']);
const PULL_MUSCLES = new Set(['Schiena','Bicipiti','Trapezio']);
const LEGS_MUSCLES = new Set(['Quadricipiti','Femorali','Glutei','Polpacci']);
const CORE_MUSCLES = new Set(['Addominali']);

function _categoryOf(muscle) {
  if (PUSH_MUSCLES.has(muscle)) return 'push';
  if (PULL_MUSCLES.has(muscle)) return 'pull';
  if (LEGS_MUSCLES.has(muscle)) return 'legs';
  if (CORE_MUSCLES.has(muscle)) return 'core';
  return 'other';
}

function _epley1RM(reps, weight) {
  if (!reps || !weight) return 0;
  return weight * (1 + reps / 30);
}

function _gymHistoryStats(workout, cache, userBodyweight = 0) {
  const now = todayStr();
  const others = (cache || []).filter(w => w.type === 'gym' && w.id !== workout.id);
  const last7 = others.filter(w => daysBetween(now, w.date) <= 7);
  const last28 = others.filter(w => daysBetween(now, w.date) <= 28);
  const tonnages28 = last28.map(w => w._tonnage || calcTonnage(w.exercises || [], userBodyweight));
  const avgTonnage = tonnages28.length ? tonnages28.reduce((a,b)=>a+b,0) / tonnages28.length : null;
  const cats = { push: 0, pull: 0, legs: 0, core: 0, other: 0 };
  last7.forEach(w => (w.exercises || []).forEach(ex => { cats[_categoryOf(ex.muscle)] += 1; }));
  return { count28: last28.length, avgTonnage, cats, last7Count: last7.length, allOthers: others };
}

function _detectPRs(workout, cache) {
  const prs = [];
  const others = (cache || []).filter(w => w.type === 'gym' && w.id !== workout.id);
  (workout.exercises || []).forEach(ex => {
    if (!ex.name) return;
    const sets = ex.sets || [];
    const cur1RM = Math.max(0, ...sets.map(s => {
      const w = ex.isUnilateral ? Math.max(s.weightLeft || 0, s.weightRight || 0) : (s.weight || 0);
      const eff = (ex.weightMode === 'per_side' ? w * 2 : w) + (ex.barbellWeight || 0);
      return _epley1RM(s.reps || 0, eff);
    }));
    if (!cur1RM) return;
    let prev1RM = 0;
    others.forEach(w => (w.exercises || []).forEach(e => {
      if (e.name !== ex.name) return;
      (e.sets || []).forEach(s => {
        const wt = e.isUnilateral ? Math.max(s.weightLeft || 0, s.weightRight || 0) : (s.weight || 0);
        const eff = (e.weightMode === 'per_side' ? wt * 2 : wt) + (e.barbellWeight || 0);
        const o = _epley1RM(s.reps || 0, eff);
        if (o > prev1RM) prev1RM = o;
      });
    }));
    if (prev1RM > 0 && cur1RM > prev1RM * 1.02) {
      prs.push({ name: ex.name, prev: Math.round(prev1RM), now: Math.round(cur1RM) });
    } else if (prev1RM === 0 && cur1RM > 0) {
      prs.push({ name: ex.name, prev: null, now: Math.round(cur1RM), first: true });
    }
  });
  return prs;
}

function adviceGym(workout, workoutsCache, userBodyweight = 0) {
  const highlights = [], suggestions = [];
  const tonnage = workout._tonnage || calcTonnage(workout.exercises || [], userBodyweight);
  const stats = _gymHistoryStats(workout, workoutsCache, userBodyweight);
  const exs = workout.exercises || [];
  const muscles = [...new Set(exs.map(e => e.muscle).filter(Boolean))];
  const cats = exs.reduce((acc, ex) => { acc[_categoryOf(ex.muscle)] = (acc[_categoryOf(ex.muscle)] || 0) + 1; return acc; }, {});
  const dominant = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  const sessionType = dominant ? dominant[0] : 'misto';
  const sessionTypeIt = { push: 'push (petto/spalle/tricipiti)', pull: 'pull (schiena/bicipiti)', legs: 'gambe', core: 'core', other: 'misto', misto: 'misto' }[sessionType] || 'misto';

  let summary = `Seduta ${sessionTypeIt}: ${exs.length} esercizi, ${Math.round(tonnage)} kg di tonnage`;
  if (workout.duration) summary += ` in ${workout.duration} min`;
  if (workout.rpe) summary += ` · RPE ${workout.rpe}/10`;

  let trend = 'n/a', notes = '';
  if (stats.avgTonnage) {
    const ratio = stats.avgTonnage > 0 ? tonnage / stats.avgTonnage : 1;
    if (ratio >= 1.15) {
      trend = 'up';
      notes = `Tonnage +${Math.round((ratio-1)*100)}% rispetto alla media 4 settimane (${Math.round(stats.avgTonnage)} kg).`;
      highlights.push({ kind: 'positive', text: notes });
    } else if (ratio <= 0.7) {
      trend = 'down';
      notes = `Tonnage -${Math.round((1-ratio)*100)}% rispetto alla media (${Math.round(stats.avgTonnage)} kg).`;
      highlights.push({ kind: 'neutral', text: notes });
    } else {
      trend = 'flat';
      notes = `Tonnage in linea con la media 4 settimane (${Math.round(stats.avgTonnage)} kg).`;
    }
  } else {
    notes = 'Storico palestra ridotto: il confronto sarà più utile dopo qualche sessione.';
  }

  const prs = _detectPRs(workout, workoutsCache);
  prs.slice(0, 3).forEach(pr => {
    if (pr.first) {
      highlights.push({ kind: 'neutral', text: `${pr.name}: prima sessione tracciata, 1RM stimato ${pr.now} kg.` });
    } else {
      highlights.push({ kind: 'positive', text: `${pr.name}: 1RM stimato ${pr.now} kg (era ${pr.prev}). Ottima progressione.` });
    }
  });

  if (workout.rpe && workout.rpe >= 9) {
    highlights.push({ kind: 'concern', text: `RPE ${workout.rpe}/10: sessione molto stressante.` });
    suggestions.push({ priority: 'high', text: 'Programma 1-2 giorni di scarico prima di un altro RPE 9+.' });
  }
  if (muscles.length <= 2) {
    highlights.push({ kind: 'neutral', text: `Solo ${muscles.length} gruppo${muscles.length===1?'':'i'} muscolare${muscles.length===1?'':'i'} (${muscles.join(', ') || '—'}): focus mirato.` });
  }
  if (stats.cats.push >= 3 && stats.cats.pull <= 1) {
    highlights.push({ kind: 'concern', text: `Negli ultimi 7gg molto push (${stats.cats.push}) e poco pull (${stats.cats.pull}): squilibrio.` });
    suggestions.push({ priority: 'high', text: 'Nella prossima sessione inserisci trazioni o rematori per riequilibrare push/pull.' });
  }
  if (stats.cats.legs === 0 && stats.last7Count >= 2) {
    suggestions.push({ priority: 'med', text: 'Nessun allenamento gambe negli ultimi 7gg: pianificane uno entro 3 giorni.' });
  }

  if (workout.duration && workout.duration < 25) {
    highlights.push({ kind: 'neutral', text: `Sessione corta (${workout.duration} min): allenamento mirato o limitato dal tempo.` });
  } else if (workout.duration && workout.duration > 110) {
    suggestions.push({ priority: 'low', text: 'Sessioni >110min: la qualità degli ultimi set può calare. Prova a comprimere i tempi di recupero.' });
  }

  if (!suggestions.length) suggestions.push({ priority: 'low', text: 'Mantieni 3-4 sedute settimanali con focus su progressione (set, reps o peso).' });

  return {
    source: 'rules',
    summary,
    type_classification: `${sessionTypeIt} day`,
    highlights: highlights.slice(0, 6),
    suggestions: suggestions.slice(0, 4),
    comparison_to_history: { trend, notes },
    confidence: stats.count28 >= 3 ? 0.7 : (stats.count28 ? 0.5 : 0.3),
  };
}

function adviceKarting(workout, workoutsCache) {
  const highlights = [], suggestions = [];
  const others = (workoutsCache || []).filter(w => w.type === 'karting' && w.id !== workout.id);
  const sameTrack = others.filter(w => w.track === workout.track);
  const cv = workout.bestLap && workout.avgLap ? (workout.avgLap - workout.bestLap) / workout.bestLap : null;

  let summary = 'Sessione karting';
  if (workout.track) summary += ` a ${workout.track}`;
  if (workout.bestLap) summary += ` · best ${workout.bestLap.toFixed(3)}s`;
  if (workout.avgLap) summary += ` · avg ${workout.avgLap.toFixed(3)}s`;

  if (cv != null) {
    if (cv <= 0.015) highlights.push({ kind: 'positive', text: `Costanza eccellente: avg solo ${(cv*100).toFixed(1)}% sopra il best.` });
    else if (cv <= 0.03) highlights.push({ kind: 'neutral', text: `Costanza buona: avg ${(cv*100).toFixed(1)}% sopra il best.` });
    else { highlights.push({ kind: 'concern', text: `Differenza alta tra avg e best (${(cv*100).toFixed(1)}%): margine di costanza.` }); suggestions.push({ priority: 'high', text: 'Prossima sessione: 5 giri continui senza spingere il best, focus solo sulla costanza.' }); }
  }

  let trend = 'n/a', notes = '';
  if (sameTrack.length && workout.bestLap) {
    const prevBest = Math.min(...sameTrack.map(w => w.bestLap || 999));
    if (workout.bestLap < prevBest) {
      trend = 'up';
      notes = `Nuovo record sulla pista: ${workout.bestLap.toFixed(3)}s (precedente ${prevBest.toFixed(3)}s).`;
      highlights.push({ kind: 'positive', text: notes });
    } else if (workout.bestLap < prevBest * 1.005) {
      trend = 'flat';
      notes = `Best vicinissimo al record (${prevBest.toFixed(3)}s): conferma del livello.`;
    } else {
      trend = 'down';
      notes = `Best ${(((workout.bestLap-prevBest)/prevBest)*100).toFixed(1)}% sopra il record (${prevBest.toFixed(3)}s).`;
    }
  } else {
    notes = sameTrack.length ? 'Mancano i tempi sul giro per confrontare.' : 'Prima sessione tracciata su questa pista.';
  }

  if (!suggestions.length) suggestions.push({ priority: 'low', text: 'Annota condizioni meteo e gomma: ti aiuteranno a contestualizzare i tempi nei prossimi confronti.' });

  return {
    source: 'rules',
    summary,
    type_classification: sameTrack.length ? 'sessione su pista nota' : 'nuova pista',
    highlights: highlights.slice(0, 5),
    suggestions: suggestions.slice(0, 3),
    comparison_to_history: { trend, notes },
    confidence: sameTrack.length >= 2 ? 0.7 : 0.4,
  };
}

function adviceGeneric(workout, workoutsCache) {
  const highlights = [], suggestions = [];
  const now = todayStr();
  const others = (workoutsCache || []).filter(w => w.id !== workout.id);
  const last7 = others.filter(w => daysBetween(now, w.date) <= 7);
  const sameType7 = last7.filter(w => w.type === workout.type);

  let summary = `Sessione ${workout.type}`;
  if (workout.duration) summary += ` · ${workout.duration} min`;
  if (workout.rpe) summary += ` · RPE ${workout.rpe}/10`;
  if (workout.distance) summary += ` · ${workout.distance.toFixed(2)} km`;

  highlights.push({ kind: 'neutral', text: `Frequenza ultimi 7gg: ${last7.length} sessioni totali, ${sameType7.length} dello stesso tipo.` });
  if (workout.rpe && workout.rpe >= 8) highlights.push({ kind: 'concern', text: `RPE alto (${workout.rpe}/10): considera il recupero.` });
  if (workout.duration && workout.duration < 15) highlights.push({ kind: 'neutral', text: `Durata corta (${workout.duration} min): mini-sessione o blocco di recupero.` });
  if (workout.muscles && workout.muscles.length) highlights.push({ kind: 'neutral', text: `Gruppi coinvolti: ${workout.muscles.join(', ')}.` });

  if (last7.length >= 6) suggestions.push({ priority: 'high', text: 'Hai accumulato 6+ sessioni in 7gg: pianifica almeno un giorno di riposo nei prossimi 2.' });
  else if (last7.length === 0) suggestions.push({ priority: 'med', text: 'Costruisci una routine: 3-4 sessioni a settimana danno i risultati migliori.' });
  else suggestions.push({ priority: 'low', text: 'Continua con la cadenza attuale e tieni traccia di RPE/durata per individuare il livello sostenibile.' });

  return {
    source: 'rules',
    summary,
    type_classification: `${workout.type}`,
    highlights: highlights.slice(0, 5),
    suggestions: suggestions.slice(0, 3),
    comparison_to_history: { trend: 'n/a', notes: last7.length ? `${last7.length} sessioni nei 7gg precedenti.` : 'Storico recente vuoto.' },
    confidence: 0.5,
  };
}

export function getAdvice(workout, workoutsCache, settingsCache) {
  if (workout.type === 'running') return adviceRunning(workout, workoutsCache, settingsCache);
  if (workout.type === 'gym') return adviceGym(workout, workoutsCache, settingsCache?.bodyweight || 0);
  if (workout.type === 'karting') return adviceKarting(workout, workoutsCache);
  return adviceGeneric(workout, workoutsCache);
}

// ==================== RENDERING ANALISI (regole + AI) ====================
function _escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

const KIND_META = {
  positive: { cls: 'ana-hl-positive', icon: '✓', label: 'Punto di forza' },
  neutral:  { cls: 'ana-hl-neutral',  icon: '•', label: 'Da notare' },
  concern:  { cls: 'ana-hl-concern',  icon: '!', label: 'Attenzione' },
};
const PRIORITY_META = {
  high: { cls: 'ana-sug-high', label: 'Priorità alta' },
  med:  { cls: 'ana-sug-med',  label: 'Da considerare' },
  low:  { cls: 'ana-sug-low',  label: 'Spunto' },
};
const TREND_META = {
  up:   { cls: 'ana-trend-up',   arrow: '↗', label: 'In miglioramento' },
  flat: { cls: 'ana-trend-flat', arrow: '→', label: 'In linea' },
  down: { cls: 'ana-trend-down', arrow: '↘', label: 'In calo' },
  'n/a':{ cls: 'ana-trend-na',   arrow: '–', label: 'Senza confronto' },
};

export function renderAiAnalysis(analysis, opts) {
  if (!analysis) return '';
  const { title = 'Analisi', badge = null, variant = 'rules', actions = '' } = opts || {};
  const summary = analysis.summary || '';
  const cls = analysis.type_classification || '';
  const highlights = Array.isArray(analysis.highlights) ? analysis.highlights : [];
  const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
  const cmp = analysis.comparison_to_history || { trend: 'n/a', notes: '' };
  const trend = TREND_META[cmp.trend] || TREND_META['n/a'];

  const priOrder = { high: 0, med: 1, low: 2 };
  const sugSorted = [...suggestions].sort((a,b) => (priOrder[a.priority]||9) - (priOrder[b.priority]||9));

  const variantCls = variant === 'ai' ? 'ana-card-ai' : 'ana-card-rules';
  let html = `<div class="ana-card ${variantCls}">`;

  // Header
  html += '<div class="ana-head">';
  html += '<div class="ana-head-left">';
  html += `<span class="ana-title">${_escapeHtml(title)}</span>`;
  if (badge) html += `<span class="ana-badge">${_escapeHtml(badge)}</span>`;
  if (cls) html += `<span class="ana-chip">${_escapeHtml(cls)}</span>`;
  html += '</div>';
  if (actions) html += `<div class="ana-head-right">${actions}</div>`;
  html += '</div>';

  if (summary) html += `<p class="ana-summary">${_escapeHtml(summary)}</p>`;

  if (highlights.length) {
    html += '<div class="ana-highlights">';
    highlights.forEach(h => {
      const meta = KIND_META[h.kind] || KIND_META.neutral;
      html += `<div class="ana-hl ${meta.cls}">
        <span class="ana-hl-icon" aria-hidden="true">${meta.icon}</span>
        <span class="ana-hl-text">${_escapeHtml(h.text)}</span>
      </div>`;
    });
    html += '</div>';
  }

  if (sugSorted.length) {
    html += '<div class="ana-section"><div class="ana-section-title">Cosa fare adesso</div><div class="ana-suggestions">';
    sugSorted.forEach(s => {
      const meta = PRIORITY_META[s.priority] || PRIORITY_META.low;
      html += `<div class="ana-sug ${meta.cls}">
        <span class="ana-sug-pri">${meta.label}</span>
        <span class="ana-sug-text">${_escapeHtml(s.text)}</span>
      </div>`;
    });
    html += '</div></div>';
  }

  if (cmp.notes || cmp.trend !== 'n/a') {
    html += `<div class="ana-trend ${trend.cls}">
      <span class="ana-trend-arrow" aria-hidden="true">${trend.arrow}</span>
      <div class="ana-trend-body">
        <div class="ana-trend-label">${_escapeHtml(trend.label)}</div>
        ${cmp.notes ? `<div class="ana-trend-notes">${_escapeHtml(cmp.notes)}</div>` : ''}
      </div>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ==================== RECOVERY ====================
export function getRecoveryStatus(workoutsCache, muscleGroups) {
  const workouts = [...workoutsCache].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const now = todayStr();
  const muscleRecovery = {};
  muscleGroups.filter(m=>m!=='Full Body').forEach(m => {
    let lastWorked=null, intensity=5;
    for(const w of workouts) {
      let hits = false;
      if (w.type === 'gym') hits = (w.exercises||[]).some(e=>e.muscle===m);
      else if (Array.isArray(w.muscles)) hits = w.muscles.includes(m) || w.muscles.includes('Full Body');
      if (hits) { lastWorked=w.date; intensity=w.rpe||w.scores?.intensity||5; break; }
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
