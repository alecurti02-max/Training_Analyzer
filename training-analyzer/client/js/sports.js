// ==================== SPORTS MODULE ====================
// Sport templates, field definitions, default muscles

export const SPORT_TEMPLATES = {
  gym: { name:'Palestra', icon:'\u{1F3CB}', fixed:true, hasExercises:true,
    fields:['duration','rpe'] },
  running: { name:'Corsa', icon:'\u{1F3C3}', fixed:true,
    fields:['distance','duration','pace','avghr','maxhr','elevation','cadence','rpe','runType'] },
  walking: { name:'Camminata', icon:'\u{1F6B6}',
    fields:['distance','duration','avghr','rpe'] },
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

export const FIELD_DEFS = {
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

export const DEFAULT_MUSCLES = ['Petto','Schiena','Spalle','Bicipiti','Tricipiti','Quadricipiti','Femorali','Glutei','Polpacci','Addominali','Avambracci','Trapezio','Full Body'];

export const SPORT_DEFAULT_MUSCLES = {
  running:      ['Quadricipiti','Femorali','Polpacci','Glutei'],
  walking:      ['Quadricipiti','Polpacci','Glutei'],
  cycling:      ['Quadricipiti','Glutei','Polpacci'],
  swimming:     ['Schiena','Spalle','Tricipiti','Petto','Addominali'],
  hiking:       ['Quadricipiti','Polpacci','Glutei','Femorali'],
  boxing:       ['Spalle','Tricipiti','Addominali','Schiena'],
  tennis:       ['Spalle','Avambracci','Quadricipiti','Addominali'],
  padel:        ['Spalle','Avambracci','Quadricipiti','Addominali'],
  football:     ['Quadricipiti','Femorali','Polpacci','Glutei'],
  basketball:   ['Quadricipiti','Polpacci','Glutei','Spalle'],
  crossfit:     ['Full Body'],
  yoga:         ['Addominali','Schiena','Glutei'],
  climbing:     ['Schiena','Bicipiti','Avambracci','Spalle'],
  skiing:       ['Quadricipiti','Glutei','Addominali'],
  martial_arts: ['Addominali','Spalle','Quadricipiti','Schiena'],
  volleyball:   ['Spalle','Quadricipiti','Polpacci','Addominali'],
  skateboard:   ['Quadricipiti','Polpacci','Addominali'],
  surf:         ['Spalle','Schiena','Addominali'],
  dance:        ['Quadricipiti','Polpacci','Addominali','Glutei'],
  karting:      ['Avambracci','Trapezio','Addominali']
};

export function getDefaultMusclesForSport(type) {
  return SPORT_DEFAULT_MUSCLES[type] ? SPORT_DEFAULT_MUSCLES[type].slice() : [];
}

export function getUserActiveSports(settingsCache) {
  const sports = ['gym','running'];
  (settingsCache.activeSports || []).forEach(s => { if (!sports.includes(s)) sports.push(s); });
  return sports;
}
