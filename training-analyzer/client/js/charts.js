// ==================== CHARTS MODULE ====================
// All chart/visualization functions. Chart.js accessed via window.Chart (CDN).

import { todayStr, daysBetween, formatDate, getWeekStart, secondsToPace } from '../src/lib/utils.js';

// Module-scoped chart instances
const charts = {};

// hex (#rgb / #rrggbb) → "rgba(r,g,b,a)"; lascia invariati i valori non-hex.
function hexToRgba(h, a){
  h = (h || '').trim().replace('#','');
  if(h.length === 3) h = h.split('').map(c=>c+c).join('');
  const n = parseInt(h, 16);
  if(h.length !== 6 || isNaN(n)) return `rgba(0,0,0,${a})`;
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

// ==================== LOCAL HELPERS ====================
// todayStr, daysBetween, formatDate, getWeekStart, secondsToPace from src/lib/utils.js.

// ==================== CORE HELPERS ====================
export function destroyChart(key) {
  if(charts[key]){charts[key].destroy();delete charts[key];}
}

export function storeChart(key, instance) {
  if(charts[key]){charts[key].destroy();delete charts[key];}
  charts[key] = instance;
}

export function getChartTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = name => cs.getPropertyValue(name).trim();
  const explicitDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const explicitLight = document.documentElement.getAttribute('data-theme') === 'light';
  const isLight = explicitLight || (!explicitDark && !window.matchMedia('(prefers-color-scheme: dark)').matches);
  const pulse = get('--pulse') || (isLight ? '#00B6A2' : '#00E5CE');
  const aqua  = get('--aqua')  || (isLight ? '#0E8FD6' : '#38BDF8');
  const volt  = get('--volt')  || (isLight ? '#15A06E' : '#34E0A1');
  const solar = get('--solar') || (isLight ? '#C98800' : '#FFC53D');
  const crimson = get('--crimson') || (isLight ? '#E11D3A' : '#FF2D46');
  const amber = get('--amber') || (isLight ? '#C98800' : '#FFC53D');
  const ink   = get('--text')  || (isLight ? '#0E1014' : '#EAF2F1');
  const ink2  = get('--text2') || (isLight ? '#5A5F6C' : '#9AADAB');
  const rule  = isLight ? 'rgba(14,16,20,0.08)' : 'rgba(234,242,241,0.08)';
  return {
    isLight,
    pulse, aqua, volt, solar, crimson, amber, ink, ink2,
    pulseAlpha15: hexToRgba(pulse, 0.15),
    voltAlpha40: hexToRgba(volt, 0.4),
    aquaAlpha40: hexToRgba(aqua, 0.4),
    aquaAlpha10: hexToRgba(aqua, 0.10),
    solarAlpha60: hexToRgba(solar, 0.6),
    font: "'Manrope', system-ui, sans-serif",
    fontDisplay: "'Big Shoulders Display', 'BasementGrotesque', sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    grid:{color: rule},
    ticks:{color: ink2, font:{family:"Manrope, sans-serif", size:11}},
    textColor: ink2
  };
}

// ==================== HEATMAP ====================
export function renderHeatmap(workouts) {
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
  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue('--pulse').trim() || '#00E5CE';
  const emptyColor = cs.getPropertyValue('--bg3').trim() || '#161B20';
  const labelColor = cs.getPropertyValue('--text2').trim() || '#9AADAB';
  const dayLabels=['L','M','M','G','V','S','D'];
  ctx.fillStyle=labelColor; ctx.font='10px Manrope, sans-serif';
  for(let d=0;d<7;d++){if(d%2===0) ctx.fillText(dayLabels[d],0,d*(cellSize+cellGap)+cellSize+12);}
  for(let week=0;week<weeksToShow;week++){
    for(let day=0;day<7;day++){
      const correctedDate=new Date(today);
      correctedDate.setDate(today.getDate()-((weeksToShow-1-week)*7+(today.getDay()===0?6:today.getDay()-1)-day));
      if(correctedDate>today) continue;
      const dateStr=correctedDate.toISOString().slice(0,10);
      const score=dateScores[dateStr]||0;
      const x=20+week*(cellSize+cellGap), y=12+day*(cellSize+cellGap);
      ctx.fillStyle = score===0?emptyColor:score<5?hexToRgba(accent,0.25):score<7?hexToRgba(accent,0.5):score<8.5?hexToRgba(accent,0.75):accent;
      ctx.beginPath(); ctx.roundRect(x,y,cellSize,cellSize,2); ctx.fill();
    }
  }
}

// ==================== RADAR CHART ====================
export function renderRadarChart(workouts) {
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
  const ct = getChartTheme();
  const textColor = ct.ink;
  const gridColor = ct.grid.color;
  charts.radar=new Chart(ctx,{type:'radar',
    data:{labels:['Forza','Resistenza','Consistenza','Recupero','Progressione','Varieta'],
      datasets:[{label:'Profilo',data:[forza,resistenza,consistenza,recupero,progressione,varieta].map(v=>Math.round(v*10)/10),
        backgroundColor:ct.pulseAlpha15,borderColor:ct.pulse,pointBackgroundColor:ct.pulse,pointBorderColor:ct.isLight?'#fff':'#0A0C0E',borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:10,ticks:{stepSize:2,color:textColor,backdropColor:'transparent'},grid:{color:gridColor},pointLabels:{color:textColor,font:{size:12,family:'Manrope'}}}},plugins:{legend:{display:false}}}
  });
}

// ==================== WEEKLY CHART ====================
export function renderWeeklyChart(workouts) {
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
        {label:'Palestra',data:labels.map(l=>weeks[l]?.gym||0),backgroundColor:hexToRgba(ct.pulse,0.7)},
        {label:'Corsa',data:labels.map(l=>weeks[l]?.running||0),backgroundColor:hexToRgba(ct.volt,0.7)},
        {label:'Altro',data:labels.map(l=>weeks[l]?.other||0),backgroundColor:hexToRgba(ct.aqua,0.7)}
      ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor,font:{family:'Manrope'}}}},scales:{x:{stacked:true,...ct},y:{stacked:true,...ct}}}
  });
}

// ==================== PROGRESS CHARTS ====================
export function renderProgress(workoutsCache, settingsCache) {
  const ct = getChartTheme();
  const workouts=[...workoutsCache].sort((a,b)=>new Date(a.date)-new Date(b.date));

  destroyChart('gymVolume');
  const gymW=workouts.filter(w=>w.type==='gym');
  if(gymW.length){
    const ctx=document.getElementById('chart-gym-volume')?.getContext('2d');
    if(ctx) charts.gymVolume=new Chart(ctx,{type:'bar',
      data:{labels:gymW.map(w=>formatDate(w.date)),datasets:[{label:'Tonnellaggio (kg)',data:gymW.map(w=>w._tonnage||0),backgroundColor:hexToRgba(ct.pulse,0.6)}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
    });
  }

  destroyChart('runPace');
  const runW=workouts.filter(w=>w.type==='running'&&w._pace>0&&w.distance>0);
  if(runW.length){
    const byDate={};
    runW.forEach(w=>{const d=w.date;if(!byDate[d])byDate[d]={totalDist:0,weightedPace:0};byDate[d].totalDist+=w.distance;byDate[d].weightedPace+=w._pace*w.distance;});
    const dates=Object.keys(byDate).sort();
    const paceData=dates.map(d=>byDate[d].weightedPace/byDate[d].totalDist);
    const distData=dates.map(d=>byDate[d].totalDist);
    const ctx=document.getElementById('chart-run-pace')?.getContext('2d');
    if(ctx) charts.runPace=new Chart(ctx,{type:'line',
      data:{labels:dates.map(d=>formatDate(d)),
        datasets:[
          {label:'Pace (ponderato)',data:paceData,borderColor:ct.volt,pointBackgroundColor:ct.volt,tension:.3,fill:false,yAxisID:'y'},
          {label:'Distanza (km)',data:distData,borderColor:ct.aquaAlpha40,backgroundColor:ct.aquaAlpha10,pointRadius:0,tension:.3,fill:true,yAxisID:'y1',type:'bar'}
        ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:ct.textColor}},tooltip:{callbacks:{label:c=>{if(c.datasetIndex===0)return'Pace: '+secondsToPace(c.raw)+'/km';return'Distanza: '+c.raw.toFixed(1)+' km';}}}},
        scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:{reverse:true,position:'left',ticks:{...ct.ticks,callback:v=>secondsToPace(v)},grid:ct.grid},y1:{position:'right',ticks:{...ct.ticks},grid:{display:false}}}}
    });
  }

  render1RMChart(workouts);
  renderHRZones(workouts, settingsCache);

  destroyChart('muscles');
  const fourWeeksAgo=new Date();fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const recentGym=workouts.filter(w=>w.type==='gym'&&new Date(w.date)>=fourWeeksAgo);
  const muscleCount={};
  recentGym.forEach(w=>(w.exercises||[]).forEach(e=>{if(e.muscle)muscleCount[e.muscle]=(muscleCount[e.muscle]||0)+e.sets.length;}));
  if(Object.keys(muscleCount).length){
    const ctx=document.getElementById('chart-muscles')?.getContext('2d');
    const lbls=Object.keys(muscleCount);
    const colors=['#00E5CE','#34E0A1','#38BDF8','#FFC53D','#5FF3DF','#A78BFA','#FF2D46','#7FF7E6','#0E8FD6','#C98800','#9AADAB','#6E7E7C','#5C6B69'];
    if(ctx) charts.muscles=new Chart(ctx,{type:'doughnut',
      data:{labels:lbls,datasets:[{data:Object.values(muscleCount),backgroundColor:colors.slice(0,lbls.length)}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:ct.textColor,font:{size:11,family:'Manrope'}}}}}
    });
  }

}

// ==================== 1RM CHART ====================
export function render1RMChart(workouts, exercisesCache) {
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
  if(!names.length){if(sel)sel.innerHTML='<p style="font-size:.85rem;color:var(--text2)">Servono almeno 2 sessioni per il 1RM stimato.</p>';return;}
  if(sel) {
    sel.innerHTML=`<select id="orm-exercise-select" style="max-width:250px">${names.map(n=>`<option value="${n}">${n}</option>`).join('')}</select>`;
    document.getElementById('orm-exercise-select').addEventListener('change', updateORMChart);
  }
  window._ormData=exerciseData;
  updateORMChart();
}

export function updateORMChart() {
  destroyChart('orm');
  const ct = getChartTheme();
  const name=document.getElementById('orm-exercise-select')?.value;
  if(!name||!window._ormData?.[name]) return;
  const data=window._ormData[name].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const ctx=document.getElementById('chart-1rm')?.getContext('2d');
  if(!ctx) return;
  charts.orm=new Chart(ctx,{type:'line',
    data:{labels:data.map(d=>formatDate(d.date)),datasets:[{label:'1RM Stimato (kg)',data:data.map(d=>d.orm),borderColor:ct.pulse,pointBackgroundColor:ct.pulse,tension:.3,fill:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
  });
}

// ==================== HR ZONES ====================
const HR_ZONES_DEF = [
  {name:'Z1 Recupero', color:'#B0B4BE'},
  {name:'Z2 Base',     color:'#22D3EE'},
  {name:'Z3 Aerobica', color:'#10B981'},
  {name:'Z4 Soglia',   color:'#FFC53D'},
  {name:'Z5 Max',      color:'#FF2D46'},
];
const HR_PERIOD_PRESETS = [
  {key:'7',   label:'7g',     days:7},
  {key:'30',  label:'30g',    days:30},
  {key:'90',  label:'90g',    days:90},
  {key:'365', label:'1 anno', days:365},
  {key:'all', label:'Tutto',  days:null},
];
const HR_COUNT_PRESETS = [5, 10, 20, 50];
const HR_FILTER_KEY = 'ta_hrzones_filter';

let hrZonesFilter = (function(){
  try{
    const v = JSON.parse(localStorage.getItem(HR_FILTER_KEY) || 'null');
    if(v && (v.mode==='period' || v.mode==='count') && v.value!=null) return v;
  }catch(e){}
  return { mode:'period', value:'all' };
})();
function saveHRFilter(){ try{ localStorage.setItem(HR_FILTER_KEY, JSON.stringify(hrZonesFilter)); }catch(e){} }

function applyHRZonesFilter(runWDesc, filter){
  if(filter.mode==='period'){
    if(filter.value==='all') return runWDesc.slice();
    const preset = HR_PERIOD_PRESETS.find(p=>p.key===String(filter.value));
    if(!preset || !preset.days) return runWDesc.slice();
    const cutoff = Date.now() - preset.days*86400000;
    return runWDesc.filter(w => new Date(w.date).getTime() >= cutoff);
  }
  // count
  const n = parseInt(filter.value)||10;
  return runWDesc.slice(0, n);
}

function computeZoneBoundsBpm(settings){
  const max = (settings && settings.maxhr) || 190;
  const rest = settings && settings.resthr;
  const usingKarvonen = rest && rest > 30 && rest < max;
  const pcts = [.5,.6,.7,.8,.9,1];
  const bounds = usingKarvonen
    ? pcts.map(p => Math.round(rest + p*(max-rest)))
    : pcts.map(p => Math.round(max*p));
  return { bounds, usingKarvonen, max, rest };
}

function zoneIndexForBpm(bpm, b){
  if(bpm < b[0]) return -1;
  if(bpm >= b[5]) return 4;
  for(let i=0;i<5;i++) if(bpm < b[i+1]) return i;
  return 4;
}

function timeInZonesFromSeries(hrSeries, bounds, durationSec){
  const z = [0,0,0,0,0];
  for(let i=0; i<hrSeries.length; i++){
    const cur = hrSeries[i], next = hrSeries[i+1];
    const dt = next ? Math.max(0, next.t - cur.t) : Math.max(0, durationSec - cur.t);
    if(dt <= 0) continue;
    const idx = zoneIndexForBpm(cur.hr, bounds);
    if(idx >= 0) z[idx] += dt;
  }
  return z;
}

function timeInZonesFromAvgHR(w, bounds){
  // Bell-curve estimate centered on the zone matching w.avghr.
  const zoneCenters = [];
  for(let i=0;i<5;i++) zoneCenters.push((bounds[i]+bounds[i+1])/2);
  const span = Math.max(1, bounds[5]-bounds[0]);
  const weights = zoneCenters.map(c => Math.max(0, 1 - Math.abs(w.avghr - c)/(span*0.2)));
  const total = weights.reduce((s,v)=>s+v,0) || 1;
  const durSec = (w.duration||0)*60;
  return weights.map(v => (v/total)*durSec);
}

export function renderHRZones(workouts, settingsCache) {
  const container = document.getElementById('hr-zones-container');
  if(!container) return;

  const runW = workouts
    .filter(w => w.type==='running' && (w.avghr || (w.hrSeries && w.hrSeries.length>1)) && w.duration)
    .slice()
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  if(!runW.length){
    container.innerHTML = '<p style="font-size:.85rem;color:var(--text2)">Nessuna corsa con dati FC disponibile.</p>';
    return;
  }

  const selected = applyHRZonesFilter(runW, hrZonesFilter);
  const { bounds, usingKarvonen, max:maxHR, rest:restHR } = computeZoneBoundsBpm(settingsCache);

  // Toolbar: mode tabs + preset pills
  const modeTab = (m, label) =>
    `<button class="filter-btn ${hrZonesFilter.mode===m?'active':''}" data-hrz-mode="${m}">${label}</button>`;
  const periodPill = p =>
    `<button class="filter-btn ${String(hrZonesFilter.value)===p.key?'active':''}" data-hrz-val="${p.key}">${p.label}</button>`;
  const countPill = n =>
    `<button class="filter-btn ${parseInt(hrZonesFilter.value)===n?'active':''}" data-hrz-val="${n}">${n}</button>`;

  let toolbar = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${modeTab('period','Per periodo')}${modeTab('count','Per numero')}</div>`;
  toolbar += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">`;
  toolbar += hrZonesFilter.mode==='period'
    ? HR_PERIOD_PRESETS.map(periodPill).join('')
    : HR_COUNT_PRESETS.map(countPill).join('');
  toolbar += `</div>`;

  if(!selected.length){
    container.innerHTML = toolbar +
      `<p style="font-size:.85rem;color:var(--text2)">Nessuna corsa nel filtro selezionato.</p>`;
    attachHRZonesListeners(container, workouts, settingsCache);
    return;
  }

  // Aggregate seconds in zones
  const aggSec = [0,0,0,0,0];
  let nReal = 0, nEst = 0;
  selected.forEach(w => {
    const durSec = (w.duration||0)*60;
    if(w.hrSeries && w.hrSeries.length > 1){
      const z = timeInZonesFromSeries(w.hrSeries, bounds, durSec);
      for(let i=0;i<5;i++) aggSec[i] += z[i];
      nReal++;
    } else if(w.avghr){
      const z = timeInZonesFromAvgHR(w, bounds);
      for(let i=0;i<5;i++) aggSec[i] += z[i];
      nEst++;
    }
  });
  const aggTot = aggSec.reduce((s,v)=>s+v,0) || 1;
  const aggPcts = aggSec.map(v => Math.round((v/aggTot)*100));
  const totalMin = Math.round(aggTot/60);

  // Header
  let parts = [`Distribuzione su ${selected.length} cors${selected.length===1?'a':'e'}`];
  if(nReal && nEst) parts.push(`${nReal} con traccia FC, ${nEst} stimate`);
  else if(nEst) parts.push(`${nEst} stimate da FC media`);
  else if(nReal) parts.push(`traccia FC reale`);
  parts.push(`${totalMin} min totali`);
  const methodNote = usingKarvonen
    ? `Zone: Karvonen (HRR ${maxHR-restHR}, max ${maxHR}, riposo ${restHR})`
    : `Zone: % FC max (${maxHR})`;

  let html = toolbar;
  html += `<p style="font-size:.85rem;color:var(--text2);margin-bottom:4px">${parts.join(' — ')}</p>`;
  html += `<p style="font-size:.72rem;color:var(--text2);margin-bottom:12px;opacity:.8">${methodNote}</p>`;

  // Bar
  html += `<div class="hr-zones-bar" style="height:36px;font-size:.8rem;border-radius:8px;overflow:hidden;margin-bottom:16px">`;
  HR_ZONES_DEF.forEach((z,i) => {
    if(aggPcts[i]>0)
      html += `<div class="hr-zone" style="width:${aggPcts[i]}%;background:${z.color};display:flex;align-items:center;justify-content:center">${aggPcts[i]}%</div>`;
  });
  html += `</div>`;

  // Cards
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">`;
  HR_ZONES_DEF.forEach((z,i) => {
    const mins = Math.round(aggSec[i]/60);
    const bpmMin = bounds[i];
    const bpmMax = bounds[i+1];
    html += `<div style="background:var(--bg2);border-radius:8px;padding:10px;border-left:4px solid ${z.color}">
      <div style="font-size:.8rem;font-weight:700;color:${z.color}">${z.name}</div>
      <div style="font-size:1.1rem;font-weight:800;margin:2px 0">${aggPcts[i]}%</div>
      <div style="font-size:.75rem;color:var(--text2)">~${mins} min | ${bpmMin}-${bpmMax} bpm</div>
    </div>`;
  });
  html += `</div>`;

  html += '<div class="hr-zone-legend">';
  HR_ZONES_DEF.forEach(z => { html += `<span style="color:${z.color}">${z.name}</span>`; });
  html += '</div>';

  container.innerHTML = html;
  attachHRZonesListeners(container, workouts, settingsCache);
}

function attachHRZonesListeners(container, workouts, settingsCache){
  container.querySelectorAll('[data-hrz-mode]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.hrzMode;
    if(m === hrZonesFilter.mode) return;
    hrZonesFilter = { mode:m, value: m==='period' ? 'all' : 10 };
    saveHRFilter();
    renderHRZones(workouts, settingsCache);
  }));
  container.querySelectorAll('[data-hrz-val]').forEach(b => b.addEventListener('click', () => {
    const raw = b.dataset.hrzVal;
    hrZonesFilter.value = hrZonesFilter.mode==='count' ? parseInt(raw) : raw;
    saveHRFilter();
    renderHRZones(workouts, settingsCache);
  }));
}

// ==================== WEIGHT CHART ====================
export function renderWeightChart(weightsCache, settingsCache) {
  destroyChart('weight');
  const ct = getChartTheme();
  const now=new Date(), ninetyDaysAgo=new Date(now); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate()-90);
  const data=(weightsCache||[]).filter(w=>new Date(w.date)>=ninetyDaysAgo);
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
    {label:'Peso',data:yVals,borderColor:ct.pulse,pointBackgroundColor:ct.pulse,tension:.3,fill:false},
    {label:'Tendenza',data:trendData,borderColor:ct.aqua,borderDash:[5,5],pointRadius:0,tension:.3,fill:false}
  ];
  if(target) datasets.push({label:'Obiettivo',data:data.map(()=>target),borderColor:ct.volt,borderDash:[10,5],pointRadius:0,fill:false});
  const ctx=document.getElementById('chart-weight')?.getContext('2d');
  if(!ctx) return;
  charts.weight=new Chart(ctx,{type:'line',data:{labels:data.map(d=>formatDate(d.date)),datasets},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor}}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
  });
}
