// ==================== IMPORT MODULE ====================
// GPX, CSV, Apple Health, FIT file import/export.
// All Firebase save calls replaced with API calls.

import { api } from './api.js';
import { scoreWorkout, getAdvice } from './scoring.js';

// ==================== LOCAL HELPERS ====================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
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
  await api.post('/api/workouts', workout);
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
    await api.post('/api/workouts', workout);
    count++;
  }
  toast(`${count} sessioni importate!`,'success');
  const preview=document.getElementById('csv-preview');
  if(preview) preview.innerHTML='';
}

// ==================== APPLE HEALTH IMPORT ====================
export function handleAppleHealthFile(file, callbacks) {
  if(!file) return;
  const progressBar=document.getElementById('health-progress'),progressFill=document.getElementById('health-progress-fill'),preview=document.getElementById('health-preview');
  if(progressBar) progressBar.style.display='';
  if(preview) preview.innerHTML='<p style="color:var(--text2);font-size:.85rem">Parsing...</p>';
  const chunkSize=1024*1024,fileSize=file.size;let offset=0,textBuffer='';
  const workouts=[];const reader=new FileReader();
  function readNextChunk(){reader.readAsText(file.slice(offset,Math.min(offset+chunkSize,fileSize)));}
  reader.onload=function(e){
    textBuffer+=e.target.result;offset+=chunkSize;
    if(progressFill) progressFill.style.width=Math.min(100,Math.round((offset/fileSize)*100))+'%';
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
    if(progressFill) progressFill.style.width='100%';
    const unique=[],seen=new Set();
    workouts.forEach(w=>{const key=`${w.date}_${w.type}_${w.duration}`;if(!seen.has(key)){seen.add(key);unique.push(w);}});
    const toShow=unique.slice(-50).reverse();window._healthImportData=toShow;
    if(!toShow.length){if(preview)preview.innerHTML='<p style="color:var(--text2)">Nessun allenamento trovato.</p>';return;}
    const typeNames={running:'Corsa',walking:'Camminata',cycling:'Ciclismo',swimming:'Nuoto',gym:'Palestra',other:'Altro'};
    let html=`<div class="card"><div class="card-title">Trovati ${unique.length} allenamenti</div><div style="max-height:400px;overflow-y:auto">`;
    toShow.forEach((w,i)=>{
      html+=`<div class="import-preview-item"><input type="checkbox" class="import-checkbox" ${w.selected?'checked':''} data-health-idx="${i}">
        <span style="flex:1"><strong>${formatDate(w.date)}</strong> - ${typeNames[w.type]||w.type} - ${w.duration} min${w.distance?' - '+w.distance+' km':''}</span></div>`;
    });
    html+=`</div><button class="btn btn-primary" style="margin-top:12px;width:100%" id="btn-health-import">Importa selezionati</button></div>`;
    if(preview) {
      preview.innerHTML=html;
      // Bind checkbox changes
      preview.querySelectorAll('[data-health-idx]').forEach(cb => {
        cb.addEventListener('change', function() { window._healthImportData[parseInt(this.dataset.healthIdx)].selected = this.checked; });
      });
      document.getElementById('btn-health-import')?.addEventListener('click', async () => {
        await importHealthWorkouts(window._healthImportData, callbacks?.workoutsCache || [], callbacks?.settingsCache || {});
        if (callbacks?.onImported) callbacks.onImported();
      });
    }
  };
  reader.onerror=()=>toast('Errore lettura file','error');
  readNextChunk();
}

export async function importHealthWorkouts(selected, workoutsCache, settingsCache){
  const data=selected||window._healthImportData;if(!data)return;let count=0;
  for (const w of data.filter(w=>w.selected)) {
    if(w.type==='running'||w.type==='walking'||w.type==='cycling'){
      const workout={id:uid(),type:'running',date:w.date,distance:w.distance||0,duration:w.duration,
        _pace:w.distance>0&&w.duration>0?(w.duration*60)/w.distance:0,runType:'easy',notes:'Importato da Apple Health',imported:true};
      workout.scores=scoreWorkout(workout, workoutsCache, settingsCache);
      workout.advice=getAdvice(workout);
      await api.post('/api/workouts', workout);count++;
    } else if(w.type==='gym'){
      const workout={id:uid(),type:'gym',date:w.date,duration:w.duration,exercises:[],_tonnage:0,notes:'Importato da Apple Health',imported:true};
      workout.scores=scoreWorkout(workout, workoutsCache, settingsCache);
      workout.advice=getAdvice(workout);
      await api.post('/api/workouts', workout);count++;
    }
  }
  toast(`${count} allenamenti importati!`,'success');
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
  await api.post('/api/workouts', workout);
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
  if(!file)return;const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.workouts) {
        for (const w of data.workouts) {
          await api.post('/api/workouts', w);
        }
      }
      if(data.settings) await api.put('/api/settings', data.settings);
      if(data.exercises) {
        for (const ex of data.exercises) {
          await api.post('/api/exercises', ex);
        }
      }
      if(data.weights) {
        for (const w of data.weights) {
          await api.post('/api/weights', w);
        }
      }
      toast('Backup importato!','success');
      if (callbacks?.onImported) callbacks.onImported();
    }catch(err){toast('Errore nel file JSON','error');}
  };reader.readAsText(file);
}
