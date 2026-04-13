// ==================== CHARTS MODULE ====================
// All chart/visualization functions. Chart.js accessed via window.Chart (CDN).

// Module-scoped chart instances
const charts = {};

// ==================== LOCAL HELPERS ====================
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysBetween(d1,d2) { return Math.abs(Math.floor((new Date(d1)-new Date(d2))/86400000)); }
function formatDate(d) { return new Date(d).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}); }
function getWeekStart(d) { const dt=new Date(d),day=dt.getDay(),diff=dt.getDate()-day+(day===0?-6:1); return new Date(dt.setDate(diff)).toISOString().slice(0,10); }
function secondsToPace(s) { if(!s||s<=0)return'--'; const m=Math.floor(s/60),sec=Math.round(s%60); return m+':'+String(sec).padStart(2,'0'); }

// ==================== CORE HELPERS ====================
export function destroyChart(key) {
  if(charts[key]){charts[key].destroy();delete charts[key];}
}

export function getChartTheme() {
  const isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'dark';
  return {
    grid:{color:isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},
    ticks:{color:isLight?'#6E6E73':'#8E8E93'},
    textColor: isLight?'#6E6E73':'#8E8E93'
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
        {label:'Palestra',data:labels.map(l=>weeks[l]?.gym||0),backgroundColor:'rgba(224,32,32,0.7)'},
        {label:'Corsa',data:labels.map(l=>weeks[l]?.running||0),backgroundColor:'rgba(0,184,148,0.7)'},
        {label:'Altro',data:labels.map(l=>weeks[l]?.other||0),backgroundColor:'rgba(9,132,227,0.7)'}
      ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:ct.textColor,font:{family:'Inter'}}}},scales:{x:{stacked:true,...ct},y:{stacked:true,...ct}}}
  });
}

// ==================== PROGRESS CHARTS ====================
export function renderProgress(workoutsCache, settingsCache) {
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
          {label:'Pace (ponderato)',data:paceData,borderColor:'#00b894',pointBackgroundColor:'#00b894',tension:.3,fill:false,yAxisID:'y'},
          {label:'Distanza (km)',data:distData,borderColor:'rgba(9,132,227,0.4)',backgroundColor:'rgba(9,132,227,0.1)',pointRadius:0,tension:.3,fill:true,yAxisID:'y1',type:'bar'}
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
  if(sel) sel.innerHTML=`<select id="orm-exercise-select" onchange="updateORMChart()" style="max-width:250px">${names.map(n=>`<option value="${n}">${n}</option>`).join('')}</select>`;
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
    data:{labels:data.map(d=>formatDate(d.date)),datasets:[{label:'1RM Stimato (kg)',data:data.map(d=>d.orm),borderColor:'#E02020',pointBackgroundColor:'#E02020',tension:.3,fill:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{...ct,ticks:{...ct.ticks,maxTicksLimit:10}},y:ct}}
  });
}

// ==================== HR ZONES ====================
export function renderHRZones(workouts, settingsCache) {
  const container=document.getElementById('hr-zones-container');
  if(!container) return;
  const maxHR=(settingsCache && settingsCache.maxhr)||190;
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
