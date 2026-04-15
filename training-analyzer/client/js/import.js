// ==================== IMPORT MODULE ====================
// GPX, CSV, Apple Health, FIT file import/export.
// All Firebase save calls replaced with API calls.

import { api } from './api.js';
import { scoreWorkout, getAdvice } from './scoring.js';

// ==================== LOCAL HELPERS ====================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function _wrapForAPI(workout) { const { type, date, ...rest } = workout; return { type, date, data: rest }; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function secondsToPace(s) { if(!s||s<=0)return'--'; const m=Math.floor(s/60),sec=Math.round(s%60); return m+':'+String(sec).padStart(2,'0'); }
function formatDate(d) { return new Date(d).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}); }
function toast(msg, type='') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.className = 'toast', 3000);
}

// ==================== GPX IMPORT ====================
export function handleGPXFiles(files, callbacks) {
  const preview=document.getElementById('gpx-preview');
  if(preview) preview.innerHTML='';
  Array.from(files).forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const xml=new DOMParser().parseFromString(e.target.result,'text/xml');
        const data=parseGPX(xml);
        if(data){
          const card=document.createElement('div');card.className='card';
          card.innerHTML=`<div class="card-title">${file.name}</div><p style="font-size:.85rem;color:var(--text2)">Distanza: ${data.distance.toFixed(2)} km | Durata: ${data.duration} min | Pace: ${secondsToPace(data.pace)}/km<br>${data.avghr?'FC Media: '+data.avghr+' bpm | ':''}Dislivello: ${data.elevation} m | Data: ${data.date}</p>
            <button class="btn btn-primary btn-sm" data-gpx-import='${JSON.stringify(data)}'>Importa</button>`;
          card.querySelector('[data-gpx-import]').addEventListener('click', async function() {
            await importGPXWorkout(JSON.parse(this.dataset.gpxImport), callbacks?.workoutsCache || [], callbacks?.settingsCache || {});
            this.disabled = true; this.textContent = 'Importato!';
            if (callbacks?.onImported) callbacks.onImported();
          });
          if(preview) preview.appendChild(card);
        }
      }catch(err){toast('Errore parsing '+file.name,'error');}
    };
    reader.readAsText(file);
  });
}

export function parseGPX(xml) {
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

export function haversine(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

export async function importGPXWorkout(data, workoutsCache, settingsCache) {
  const workout={id:uid(),type:'running',date:data.date,distance:data.distance,duration:data.duration,_pace:data.pace,paceInput:secondsToPace(data.pace),
    avghr:data.avghr,maxhr:data.maxhr,elevation:data.elevation,runType:'easy',notes:'Importato da GPX',imported:true};
  workout.scores=scoreWorkout(workout, workoutsCache, settingsCache);
  workout.advice=getAdvice(workout);
  await api.post('/api/workouts', _wrapForAPI(workout));
  toast('Corsa importata!','success');
}

// ==================== CSV IMPORT ====================
export function handleCSVFile(file, exercisesCache, callbacks) {
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
        const lib=exercisesCache||[];
        const libEntry=lib.find(l=>l.name.toLowerCase()===exercise.toLowerCase());
        byDate[date].push({name:exercise,muscle:libEntry?.muscle||'Full Body',sets});
      }
      const preview=document.getElementById('csv-preview');
      let html=`<div class="card"><div class="card-title">Anteprima</div><p style="font-size:.85rem;color:var(--text2);margin-bottom:8px">${Object.keys(byDate).length} sessioni</p>`;
      Object.entries(byDate).forEach(([date,exercises])=>{html+=`<p style="font-size:.82rem"><strong>${date}</strong>: ${exercises.map(e=>e.name).join(', ')}</p>`;});
      html+=`<button class="btn btn-primary btn-sm" style="margin-top:12px" id="btn-csv-confirm">Importa</button></div>`;
      if(preview) {
        preview.innerHTML=html;
        window._csvImportData=byDate;
        document.getElementById('btn-csv-confirm')?.addEventListener('click', async () => {
          await confirmCSVImport(byDate, callbacks?.workoutsCache || [], callbacks?.settingsCache || {});
          if (callbacks?.onImported) callbacks.onImported();
        });
      }
    }catch(err){toast('Errore parsing CSV','error');}
  };reader.readAsText(file);
}

export async function confirmCSVImport(pendingRows, workoutsCache, settingsCache){
  const byDate=pendingRows||window._csvImportData;if(!byDate)return;let count=0;
  for (const [date, exercises] of Object.entries(byDate)) {
    let tonnage=0;exercises.forEach(ex=>ex.sets.forEach(s=>tonnage+=s.reps*s.weight));
    const workout={id:uid(),type:'gym',date,exercises,_tonnage:tonnage,notes:'Importato da CSV',imported:true};
    workout.scores=scoreWorkout(workout, workoutsCache, settingsCache);
    workout.advice=getAdvice(workout);
    await api.post('/api/workouts', _wrapForAPI(workout));
    count++;
  }
  toast(`${count} sessioni importate!`,'success');
  const preview=document.getElementById('csv-preview');
  if(preview) preview.innerHTML='';
}

// ==================== APPLE HEALTH IMPORT ====================
function _healthAttr(str, name) {
  const m = new RegExp(name + '="([^"]*)"').exec(str);
  return m ? m[1] : '';
}

// Extract a numeric field from a WorkoutStatistics element
function _healthStat(children, typeSubstr, field) {
  const re = new RegExp('WorkoutStatistics[^>]*type="[^"]*' + typeSubstr + '"[^>]*' + field + '="([^"]*)"');
  const m = re.exec(children);
  return m ? parseFloat(m[1]) || 0 : 0;
}

// Extract a MetadataEntry value
function _healthMeta(children, key) {
  const re = new RegExp('MetadataEntry key="' + key + '" value="([^"]*)"');
  const m = re.exec(children);
  return m ? m[1] : '';
}

function _classifyActivity(actType) {
  if (actType.includes('Running')) return 'running';
  if (actType.includes('Walking')) return 'walking';
  if (actType.includes('Cycling')) return 'cycling';
  if (actType.includes('Swimming')) return 'swimming';
  if (actType.includes('Hiking')) return 'hiking';
  if (actType.includes('DownhillSkiing') || actType.includes('SnowSports')) return 'skiing';
  if (actType.includes('Tennis')) return 'tennis';
  if (actType.includes('Rowing')) return 'rowing';
  if (actType.includes('StrengthTraining') || actType.includes('FunctionalStrength') ||
      actType.includes('TraditionalStrengthTraining') || actType.includes('CrossTraining') ||
      actType.includes('CoreTraining') || actType.includes('HighIntensityIntervalTraining'))
    return 'gym';
  return 'other';
}

// Convert METs to RPE (1-10 Borg scale)
function _metsToRPE(mets) {
  if (mets < 3) return 2;
  if (mets < 4) return 3;
  if (mets < 6) return 4;
  if (mets < 7) return 5;
  if (mets < 8) return 6;
  if (mets < 9) return 7;
  if (mets < 10.5) return 8;
  if (mets < 12) return 9;
  return 10;
}

export function handleAppleHealthFile(file, callbacks) {
  if(!file) return;
  const progressBar=document.getElementById('health-progress'),progressFill=document.getElementById('health-progress-fill'),preview=document.getElementById('health-preview');
  if(progressBar) progressBar.style.display='';
  if(preview) preview.innerHTML='<p style="color:var(--text2);font-size:.85rem">Parsing...</p>';
  const chunkSize=2*1024*1024,fileSize=file.size;let offset=0,textBuffer='';
  const workouts=[];const reader=new FileReader();
  function readNextChunk(){reader.readAsText(file.slice(offset,Math.min(offset+chunkSize,fileSize)));}
  reader.onload=function(e){
    textBuffer+=e.target.result;offset+=chunkSize;
    if(progressFill) progressFill.style.width=Math.min(100,Math.round((offset/fileSize)*100))+'%';

    // --- Match complete <Workout ...>...</Workout> blocks (modern Apple Health format) ---
    const reBlock=/<Workout\s([^>]*?)>([\s\S]*?)<\/Workout>/g;
    let m, lastBlockEnd=0;
    while((m=reBlock.exec(textBuffer))!==null){
      lastBlockEnd=reBlock.lastIndex;
      const attrs=m[1], children=m[2];
      const actType=_healthAttr(attrs,'workoutActivityType');
      const startDate=_healthAttr(attrs,'startDate');
      const duration=parseFloat(_healthAttr(attrs,'duration'))||0;

      // --- Extract ALL available data from WorkoutStatistics ---
      // Distance
      let distance=parseFloat(_healthAttr(attrs,'totalDistance'))||0;
      if(!distance) distance = _healthStat(children,'DistanceWalkingRunning','sum')
                            || _healthStat(children,'DistanceCycling','sum')
                            || _healthStat(children,'DistanceSwimming','sum');
      // Calories
      let calories=parseFloat(_healthAttr(attrs,'totalEnergyBurned'))||0;
      if(!calories) calories = _healthStat(children,'ActiveEnergyBurned','sum');
      // Heart rate (average, minimum, maximum)
      const avghr = Math.round(_healthStat(children,'HeartRate','average'));
      const maxhr = Math.round(_healthStat(children,'HeartRate','maximum'));
      const minhr = Math.round(_healthStat(children,'HeartRate','minimum'));
      // Steps
      const steps = Math.round(_healthStat(children,'StepCount','sum'));
      // Running metrics
      const runSpeed = _healthStat(children,'RunningSpeed','average');
      const runPower = Math.round(_healthStat(children,'RunningPower','average'));
      const runStride = Math.round(_healthStat(children,'RunningStrideLength','average')*100)/100;
      const runGCT = Math.round(_healthStat(children,'RunningGroundContactTime','average'));
      const runVertOsc = Math.round(_healthStat(children,'RunningVerticalOscillation','average')*10)/10;
      // Cycling metrics
      const cycSpeed = Math.round(_healthStat(children,'CyclingSpeed','average')*10)/10;
      const cycPower = Math.round(_healthStat(children,'CyclingPower','average'));
      const cycCadence = Math.round(_healthStat(children,'CyclingCadence','average'));
      // Swimming metrics
      const swimStrokes = Math.round(_healthStat(children,'SwimmingStrokeCount','sum'));

      // --- Extract MetadataEntry fields ---
      const elevRaw = _healthMeta(children,'HKElevationAscended');
      const elevation = elevRaw ? Math.round(parseFloat(elevRaw)/100*10)/10 : 0; // cm → m
      const metsRaw = _healthMeta(children,'HKAverageMETs');
      const mets = metsRaw ? Math.round(parseFloat(metsRaw)*100)/100 : 0;
      const indoorRaw = _healthMeta(children,'HKIndoorWorkout');
      const indoor = indoorRaw === '1';
      const tempRaw = _healthMeta(children,'HKWeatherTemperature');
      const temperature = tempRaw ? Math.round((parseFloat(tempRaw)-32)*5/9) : 0; // °F → °C
      const strokeStyle = _healthMeta(children,'HKSwimmingStrokeStyle');
      const lapLength = _healthMeta(children,'HKLapLength') ? parseFloat(_healthMeta(children,'HKLapLength')) : 0;

      // Build workout object with ALL available data (undefined for missing = not stored)
      const w = {type:_classifyActivity(actType), actType, date:startDate.slice(0,10),
        duration:Math.round(duration), distance:Math.round(distance*100)/100,
        calories:Math.round(calories), selected:true};
      // Only add fields that have real values
      if(avghr) w.avghr=avghr; if(maxhr) w.maxhr=maxhr; if(minhr) w.minhr=minhr;
      if(steps) w.steps=steps; if(elevation) w.elevation=elevation; if(mets) w.mets=mets;
      if(indoor) w.indoor=true;
      if(temperature) w.temperature=temperature;
      if(runSpeed) w.runSpeed=Math.round(runSpeed*10)/10;
      if(runPower) w.runPower=runPower;
      if(runStride) w.runStride=runStride;
      if(runGCT) w.runGCT=runGCT;
      if(runVertOsc) w.runVertOsc=runVertOsc;
      if(cycSpeed) w.cycSpeed=cycSpeed;
      if(cycPower) w.cycPower=cycPower;
      if(cycCadence) w.cycCadence=cycCadence;
      if(swimStrokes) w.swimStrokes=swimStrokes;
      if(strokeStyle) w.strokeStyle=strokeStyle;
      if(lapLength) w.lapLength=lapLength;
      workouts.push(w);
    }

    // --- Also match self-closing <Workout ... /> (legacy Apple Health format) ---
    const reSelf=/<Workout\s([^>]*?)\/>/g;
    let m2;
    while((m2=reSelf.exec(textBuffer))!==null){
      if(m2.index<lastBlockEnd) continue; // already matched as block
      const attrs=m2[1];
      const actType=_healthAttr(attrs,'workoutActivityType');
      const startDate=_healthAttr(attrs,'startDate');
      const duration=parseFloat(_healthAttr(attrs,'duration'))||0;
      const distance=parseFloat(_healthAttr(attrs,'totalDistance'))||0;
      const calories=parseFloat(_healthAttr(attrs,'totalEnergyBurned'))||0;
      workouts.push({type:_classifyActivity(actType),actType,date:startDate.slice(0,10),
        duration:Math.round(duration),distance:Math.round(distance*100)/100,
        calories:Math.round(calories),selected:true});
    }

    // Trim buffer smartly: keep from after last </Workout> to catch split blocks
    const lastClose=textBuffer.lastIndexOf('</Workout>');
    if(lastClose!==-1) textBuffer=textBuffer.slice(lastClose+'</Workout>'.length);
    else if(textBuffer.length>chunkSize*2) textBuffer=textBuffer.slice(-chunkSize);

    if(offset<fileSize){readNextChunk();return;}
    if(progressFill) progressFill.style.width='100%';
    const unique=[],seen=new Set();
    workouts.forEach(w=>{const key=`${w.date}_${w.type}_${w.duration}`;if(!seen.has(key)){seen.add(key);unique.push(w);}});
    unique.reverse(); // newest first

    // Calculate RPE: Priority 1 = METs (Apple's effort), Priority 2 = HR fallback (FCmax 197 bpm)
    unique.forEach(w => {
      if (w.mets) {
        w.rpe = _metsToRPE(w.mets);
      } else if (w.avghr) {
        w.rpe = Math.max(1, Math.min(10, Math.round((w.avghr / 197) * 10)));
      }
    });

    window._healthImportData=unique; // ALL workouts
    if(!unique.length){if(preview)preview.innerHTML='<p style="color:var(--text2)">Nessun allenamento trovato.</p>';return;}
    const PREVIEW_LIMIT=50;
    const toShow=unique.slice(0,PREVIEW_LIMIT);
    const typeNames={running:'Corsa',walking:'Camminata',cycling:'Ciclismo',swimming:'Nuoto',
      gym:'Palestra',hiking:'Escursionismo',skiing:'Sci',tennis:'Tennis',rowing:'Canottaggio',other:'Altro'};
    let html=`<div class="card"><div class="card-title">Trovati ${unique.length} allenamenti</div>`;
    if(unique.length>PREVIEW_LIMIT) html+=`<p style="font-size:.82rem;color:var(--text2);margin-bottom:8px">Anteprima ultimi ${PREVIEW_LIMIT} — tutti i ${unique.length} verranno importati.</p>`;
    html+=`<div style="max-height:400px;overflow-y:auto">`;
    toShow.forEach((w,i)=>{
      let info = `${w.duration} min`;
      if(w.distance) info += ` · ${w.distance} km`;
      if(w.avghr) info += ` · FC ${w.avghr}`;
      if(w.rpe) info += ` · RPE ${w.rpe}`;
      if(w.calories) info += ` · ${w.calories} kcal`;
      if(w.elevation) info += ` · ${w.elevation}m D+`;
      html+=`<div class="import-preview-item"><input type="checkbox" class="import-checkbox" ${w.selected?'checked':''} data-health-idx="${i}">
        <span style="flex:1"><strong>${formatDate(w.date)}</strong> - ${typeNames[w.type]||w.type} - ${info}</span></div>`;
    });
    html+=`</div><button class="btn btn-primary" style="margin-top:12px;width:100%" id="btn-health-import">Importa selezionati</button></div>`;
    if(preview) {
      preview.innerHTML=html;
      // Bind checkbox changes
      preview.querySelectorAll('[data-health-idx]').forEach(cb => {
        cb.addEventListener('change', function() { window._healthImportData[parseInt(this.dataset.healthIdx)].selected = this.checked; });
      });
      const importBtn = document.getElementById('btn-health-import');
      if (importBtn) importBtn.addEventListener('click', async () => {
        importBtn.disabled = true;
        importBtn.textContent = 'Importazione in corso...';
        try {
          await importHealthWorkouts(window._healthImportData, callbacks?.workoutsCache || [], callbacks?.settingsCache || {});
          if (callbacks?.onImported) callbacks.onImported();
        } catch (err) {
          toast('Errore importazione: ' + (err.message || 'Sconosciuto'), 'error');
          importBtn.disabled = false;
          importBtn.textContent = 'Importa selezionati';
        }
      });
    }
  };
  reader.onerror=()=>toast('Errore lettura file','error');
  readNextChunk();
}

export async function importHealthWorkouts(selected, workoutsCache, settingsCache){
  const data=selected||window._healthImportData;if(!data)return;
  const toImport = data.filter(w=>w.selected);
  if(!toImport.length){ toast('Nessun allenamento selezionato','error'); return; }

  const btn = document.getElementById('btn-health-import');

  // Build all workout objects — pass through ALL available fields
  const prepared = toImport.map(w => {
    // Base fields present for every workout
    const workout = {id:uid(), date:w.date, type:w.type, duration:w.duration, notes:'Importato da Apple Health', imported:true};

    // Conditionally add ALL fields that exist (never store empty/zero)
    if(w.distance) workout.distance = w.distance;
    if(w.avghr) workout.avghr = w.avghr;
    if(w.maxhr) workout.maxhr = w.maxhr;
    if(w.minhr) workout.minhr = w.minhr;
    if(w.rpe) workout.rpe = w.rpe;
    if(w.mets) workout.mets = w.mets;
    if(w.calories) workout.calories = w.calories;
    if(w.elevation) workout.elevation = w.elevation;
    if(w.indoor) workout.indoor = true;
    if(w.temperature) workout.temperature = w.temperature;
    if(w.steps) workout.steps = w.steps;
    // Running-specific
    if(w.runSpeed) workout.avgSpeed = w.runSpeed;
    if(w.runPower) workout.avgPower = w.runPower;
    if(w.runStride) workout.avgStride = w.runStride;
    if(w.runGCT) workout.groundContact = w.runGCT;
    if(w.runVertOsc) workout.vertOsc = w.runVertOsc;
    // Cycling-specific
    if(w.cycSpeed) workout.avgSpeed = w.cycSpeed;
    if(w.cycPower) workout.avgPower = w.cycPower;
    if(w.cycCadence) workout.avgCadence = w.cycCadence;
    // Swimming-specific
    if(w.swimStrokes) workout.strokes = w.swimStrokes;
    if(w.strokeStyle) workout.strokeStyle = w.strokeStyle;
    if(w.lapLength) workout.lapLength = w.lapLength;
    // Pace for running/walking
    if((w.type==='running'||w.type==='walking') && w.distance>0 && w.duration>0) {
      workout._pace = (w.duration*60)/w.distance; // sec/km
    }
    // Gym needs exercises array
    if(w.type==='gym') { workout.exercises=[]; workout._tonnage=0; }
    // Other → save as original type name
    if(w.type==='other') {
      workout.type='gym'; workout.exercises=[]; workout._tonnage=0;
      workout.notes='Importato da Apple Health ('+w.actType.replace('HKWorkoutActivityType','')+')';}

    try { workout.scores=scoreWorkout(workout, workoutsCache, settingsCache); } catch(e) { workout.scores={}; }
    try { workout.advice=getAdvice(workout); } catch(e) { workout.advice=''; }
    return _wrapForAPI(workout);
  });

  // Send in batches of 50 via bulk endpoint
  const BATCH=50;
  let count=0, errors=0;
  for (let i=0; i<prepared.length; i+=BATCH) {
    const batch = prepared.slice(i, i+BATCH);
    if (btn) btn.textContent = `Importazione ${Math.min(i+BATCH, prepared.length)}/${prepared.length}...`;
    try {
      const res = await api.post('/api/workouts/bulk', { workouts: batch });
      count += res.count || batch.length;
    } catch(err) {
      console.error('Bulk import error batch', i, err);
      errors += batch.length;
    }
  }

  if(errors) toast(`${count} importati, ${errors} errori`,'error');
  else toast(`${count} allenamenti importati!`,'success');

  const preview=document.getElementById('health-preview');
  if(preview) preview.innerHTML='';
}

// ==================== FIT FILE ====================
export function handleFITFile(file, callbacks) {
  if(!file) return;
  const preview=document.getElementById('fit-preview');
  if(preview) preview.innerHTML='<p style="color:var(--text2);font-size:.85rem">Lettura file FIT...</p>';
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=parseFITMinimal(new Uint8Array(e.target.result));
      if(!data){if(preview)preview.innerHTML='<p style="color:var(--red)">File FIT non valido.</p>';return;}
      const card=document.createElement('div');card.className='card';
      card.innerHTML=`<div class="card-title">File FIT</div><p style="font-size:.85rem;color:var(--text2)">Data: ${data.date} | Durata: ${data.duration||'--'} min</p>
        <button class="btn btn-primary btn-sm" id="btn-fit-import">Importa</button>`;
      if(preview) {
        preview.innerHTML='';
        preview.appendChild(card);
        document.getElementById('btn-fit-import')?.addEventListener('click', async function() {
          await importFITWorkout(data, callbacks?.workoutsCache || [], callbacks?.settingsCache || {});
          this.disabled = true; this.textContent = 'Importato!';
          if (callbacks?.onImported) callbacks.onImported();
        });
      }
    }catch(err){if(preview)preview.innerHTML='<p style="color:var(--red)">Errore FIT: '+err.message+'</p>';}
  };
  reader.readAsArrayBuffer(file);
}

export function parseFITMinimal(bytes) {
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

export async function importFITWorkout(data, workoutsCache, settingsCache){
  const workout={id:uid(),type:'gym',date:data.date,duration:data.duration,exercises:[],_tonnage:0,notes:'Importato da FIT',imported:true};
  workout.scores=scoreWorkout(workout, workoutsCache, settingsCache);
  workout.advice=getAdvice(workout);
  await api.post('/api/workouts', _wrapForAPI(workout));
  toast('Importato da FIT!','success');
}

// ==================== EXPORT / IMPORT JSON ====================
export function exportAllData(caches) {
  const data={
    workouts: caches.workoutsCache || [],
    settings: caches.settingsCache || {},
    exercises: caches.exercisesCache || [],
    weights: caches.weightsCache || [],
    exportDate: new Date().toISOString()
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='training_analyzer_backup_'+todayStr()+'.json';a.click();
  toast('Backup esportato!','success');
}

export function importJSONBackup(file, callbacks) {
  if(!file)return;
  if(!confirm('Questo cancellerà tutti i dati esistenti e li sostituirà con il backup. Continuare?')) return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const data=JSON.parse(e.target.result);
      toast('Importazione in corso...','');

      // Delete existing data first
      await api.del('/api/workouts').catch(()=>{});

      if(data.workouts) {
        const workouts = Array.isArray(data.workouts) ? data.workouts : Object.values(data.workouts);
        let imported = 0;
        for (const w of workouts) {
          const { type, date, id, _tonnage, ...rest } = w;
          await api.post('/api/workouts', { type: type || 'gym', date: date || new Date().toISOString().slice(0,10), data: rest });
          imported++;
        }
        toast(`${imported} allenamenti importati`, 'success');
      }
      if(data.settings) await api.put('/api/settings', data.settings);
      if(data.exercises) {
        const exercises = Array.isArray(data.exercises) ? data.exercises : Object.values(data.exercises);
        for (const ex of exercises) {
          await api.post('/api/exercises', ex);
        }
      }
      if(data.weights) {
        const weights = Array.isArray(data.weights) ? data.weights : Object.values(data.weights);
        for (const w of weights) {
          await api.post('/api/weights', w);
        }
      }
      toast('Backup importato con successo!','success');
      if (callbacks?.onImported) callbacks.onImported();
    }catch(err){
      console.error('Import error:', err);
      toast('Errore nell\'importazione: ' + (err.message||''),'error');
    }
  };reader.readAsText(file);
}
