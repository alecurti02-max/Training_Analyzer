// ==================== BODY AVATAR ====================
// Interactive body silhouette that morphs based on user circumferences and
// body composition. Lives in Progressi → Atletica.
//
// Public API:
//   renderBodyAvatar(container, settings)    — render the avatar + side panel
//   getBodyPartInfo(partKey, settings)       — modal payload for a body part
//   getBodyFatTint(bodyFat, gender, age)     — color category for body fat %

// ==================== REFERENCE CIRCUMFERENCES ====================
// Median anthropometric values for a "fit healthy" adult. 3 height buckets × 2 genders.
// Used as scale=1 baseline; user values morph parts proportionally.
const REF_M_SHORT = { shoulders:115, chest:95,  waist:80, hips:92,  bicep:31, thigh:54, calf:36, neck:38 }; // <170cm
const REF_M_MID   = { shoulders:122, chest:100, waist:84, hips:95,  bicep:33, thigh:57, calf:38, neck:39 }; // 170-180
const REF_M_TALL  = { shoulders:128, chest:104, waist:88, hips:98,  bicep:34, thigh:59, calf:39, neck:40 }; // >180
const REF_F_SHORT = { shoulders:102, chest:84,  waist:66, hips:92,  bicep:26, thigh:53, calf:34, neck:32 }; // <160cm
const REF_F_MID   = { shoulders:108, chest:88,  waist:70, hips:95,  bicep:27, thigh:55, calf:36, neck:33 }; // 160-170
const REF_F_TALL  = { shoulders:114, chest:92,  waist:74, hips:98,  bicep:28, thigh:57, calf:37, neck:34 }; // >170

export function getReferenceCircumferences(height, gender) {
  if (gender === 'M') {
    if (!height || height < 170) return REF_M_SHORT;
    if (height > 180) return REF_M_TALL;
    return REF_M_MID;
  }
  if (gender === 'F') {
    if (!height || height < 160) return REF_F_SHORT;
    if (height > 170) return REF_F_TALL;
    return REF_F_MID;
  }
  // Neutral fallback: midpoint of M-mid and F-mid
  return {
    shoulders:115, chest:94, waist:77, hips:95, bicep:30, thigh:56, calf:37, neck:36,
  };
}

// ==================== BODY FAT THRESHOLDS (from scoring.js) ====================
// Same Jackson-Pollock linearized thresholds used in bodyCompositionSubScore.
// Returns {atl, fit, med, acc} for the user's age and gender.
export function getBodyFatThresholds(gender, age) {
  if (!gender || !age) return null;
  const d = age - 25;
  if (gender === 'M') {
    return {
      atl: 11 + 0.125 * d,
      fit: 13 + 0.125 * d,
      med: 17 + 0.125 * d,
      acc: 22 + 0.100 * d,
    };
  }
  return {
    atl: 14 + 0.150 * d,
    fit: 16 + 0.175 * d,
    med: 19 + 0.200 * d,
    acc: 23 + 0.175 * d,
  };
}

export function getBodyFatTint(bodyFat, gender, age) {
  if (bodyFat == null) return { color: 'var(--text2)', label: '—', tone: 'neutral' };
  const t = getBodyFatThresholds(gender, age);
  if (!t) return { color: 'var(--text2)', label: 'dato incompleto', tone: 'neutral' };
  if (bodyFat <= t.atl) return { color: '#00b894', label: 'Atletico', tone: 'green' };
  if (bodyFat <= t.fit) return { color: '#6ed5a0', label: 'In forma', tone: 'green' };
  if (bodyFat <= t.med) return { color: '#fdcb6e', label: 'Nella media', tone: 'yellow' };
  if (bodyFat <= t.acc) return { color: '#e8a060', label: 'Accettabile', tone: 'yellow' };
  return { color: '#E02020', label: 'Sopra la soglia', tone: 'red' };
}

// ==================== VISCERAL FAT TINT ====================
function getVisceralTint(visceralFat) {
  if (visceralFat == null) return null;
  if (visceralFat <= 9)  return { color: '#00b894', label: 'Sano', opacity: 0.25 + visceralFat * 0.04 };
  if (visceralFat <= 12) return { color: '#fdcb6e', label: 'Borderline', opacity: 0.55 };
  if (visceralFat <= 14) return { color: '#e8a060', label: 'Elevato', opacity: 0.75 };
  return { color: '#E02020', label: 'Critico', opacity: 0.9 };
}

// ==================== WHTR TINT ====================
function getWhtrTint(whtr) {
  if (whtr == null) return null;
  if (whtr < 0.42) return { color: '#fdcb6e', label: 'Basso (sottopeso?)' };
  if (whtr <= 0.50) return { color: '#00b894', label: 'Sano' };
  if (whtr <= 0.55) return { color: '#fdcb6e', label: 'Borderline' };
  if (whtr <= 0.60) return { color: '#e8a060', label: 'Elevato' };
  return { color: '#E02020', label: 'Critico' };
}

// ==================== SVG SILHOUETTE ====================
// Lean athletic silhouette, viewBox 0 0 200 440. The torso parts
// (chest/waist/hips) share matching X coordinates at every seam so the
// fills meet seamlessly with the same color — no visible boundary lines.
// Limbs overlap into torso/shoulder zones so joints look connected.
const BODY_SVG = `
<svg class="body-avatar-svg" viewBox="0 0 200 440" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body-tint" x1="0" y1="0" x2="0" y2="1">
      <stop id="body-tint-stop-top"    offset="0%"   stop-color="var(--text2)"/>
      <stop id="body-tint-stop-bottom" offset="100%" stop-color="var(--text2)"/>
    </linearGradient>
    <filter id="visceral-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
  </defs>

  <!-- LEGS (drawn first; hip will overlap thigh tops) -->
  <!-- Left thigh: slim, tapered toward knee -->
  <g data-body-part="thigh-l" style="transform-origin:82px 280px">
    <path d="M 68,228
             L 100,228
             L 100,332
             C 100,335 94,337 86,337
             C 76,337 70,335 69,332
             Q 66,300 65,265
             Q 65,245 68,228 Z"/>
  </g>
  <!-- Right thigh -->
  <g data-body-part="thigh-r" style="transform-origin:118px 280px">
    <path d="M 132,228
             L 100,228
             L 100,332
             C 100,335 106,337 114,337
             C 124,337 130,335 131,332
             Q 134,300 135,265
             Q 135,245 132,228 Z"/>
  </g>

  <!-- Left calf: tapered with subtle outer curve -->
  <g data-body-part="calf-l" style="transform-origin:82px 380px">
    <path d="M 69,332
             L 100,332
             L 96,418
             C 96,424 92,426 87,426
             C 80,426 76,424 75,418
             Q 73,400 71,378
             Q 69,355 69,332 Z"/>
  </g>
  <!-- Right calf -->
  <g data-body-part="calf-r" style="transform-origin:118px 380px">
    <path d="M 131,332
             L 100,332
             L 104,418
             C 104,424 108,426 113,426
             C 120,426 124,424 125,418
             Q 127,400 129,378
             Q 131,355 131,332 Z"/>
  </g>

  <!-- ARMS — slim, hanging close to torso. Top extends into shoulder/chest
       area so the painters z-order hides the inner edge cleanly. Outer
       edge stays inside the shoulder yoke width (no shoulder-pad effect). -->
  <!-- Left bicep -->
  <g data-body-part="bicep-l" style="transform-origin:60px 130px">
    <path d="M 78,100
             C 68,104 62,118 60,138
             C 60,156 63,166 67,170
             L 73,170
             Q 76,150 77,128
             Q 78,110 78,100 Z"/>
  </g>
  <!-- Right bicep -->
  <g data-body-part="bicep-r" style="transform-origin:140px 130px">
    <path d="M 122,100
             C 132,104 138,118 140,138
             C 140,156 137,166 133,170
             L 127,170
             Q 124,150 123,128
             Q 122,110 122,100 Z"/>
  </g>
  <!-- Left forearm — continues bicep down, tapers slightly to wrist -->
  <g data-body-part="forearm-l" style="transform-origin:62px 206px">
    <path d="M 67,170 L 73,170
             Q 71,200 69,234
             C 69,238 66,240 62,240
             C 58,240 56,238 56,234
             Q 59,200 63,170
             Q 65,172 67,170 Z"/>
  </g>
  <!-- Right forearm -->
  <g data-body-part="forearm-r" style="transform-origin:138px 206px">
    <path d="M 133,170 L 127,170
             Q 129,200 131,234
             C 131,238 134,240 138,240
             C 142,240 144,238 144,234
             Q 141,200 137,170
             Q 135,172 133,170 Z"/>
  </g>

  <!-- TORSO — z-order: hips → waist → chest → shoulders (top) -->
  <!-- Hips: matches waist bottom at seam, flares outward -->
  <g data-body-part="hips" style="transform-origin:100px 210px">
    <path d="M 70,184
             L 130,184
             Q 138,200 142,232
             Q 142,236 136,236
             L 64,236
             Q 58,236 58,232
             Q 62,200 70,184 Z"/>
  </g>

  <!-- Waist: matches chest bottom (top) and hips top (bottom) exactly -->
  <g data-body-part="waist" style="transform-origin:100px 164px">
    <path d="M 68,144
             L 132,144
             C 130,156 126,166 124,170
             C 124,176 127,182 130,184
             L 70,184
             C 73,182 76,176 76,170
             C 74,166 70,156 68,144 Z"/>
  </g>

  <!-- Chest: tapers from shoulder area down to waist width -->
  <g data-body-part="chest" style="transform-origin:100px 120px">
    <path d="M 62,100
             Q 100,98 138,100
             C 137,114 134,130 132,144
             L 68,144
             C 66,130 63,114 62,100 Z"/>
  </g>

  <!-- Shoulders: athletic deltoids, widest part — covers top of biceps and chest top -->
  <g data-body-part="shoulders" style="transform-origin:100px 86px">
    <path d="M 50,104
             C 48,84 62,68 82,64
             Q 100,62 118,64
             C 138,68 152,84 150,104
             C 148,108 142,110 134,108
             Q 116,104 100,104
             Q 84,104 66,108
             C 58,110 52,108 50,104 Z"/>
  </g>

  <!-- Neck -->
  <g data-body-part="neck" style="transform-origin:100px 68px">
    <path d="M 93,58
             Q 100,57 107,58
             L 109,76
             Q 100,77 91,76
             L 93,58 Z"/>
  </g>

  <!-- Head: oval, balanced size -->
  <g data-body-part="head" style="transform-origin:100px 36px">
    <ellipse cx="100" cy="36" rx="16" ry="20"/>
  </g>

  <!-- Visceral hotspot (only visible when visceralFat is set) -->
  <circle id="visceral-hotspot" cx="100" cy="160" r="14" fill="transparent" filter="url(#visceral-glow)" pointer-events="none"/>
</svg>
`;

// ==================== TINT APPLICATION ====================
// Apply body fat color to all silhouette parts via gradient stops.
// We don't use fill="url(#body-tint)" because gradient updates require setting
// stop-color JS. Simpler: set fill on every <g> path directly.
function applyTint(svg, color) {
  svg.querySelectorAll('g[data-body-part] path, g[data-body-part] circle, g[data-body-part] rect, g[data-body-part] ellipse')
    .forEach(el => { el.setAttribute('fill', color); });
}

// ==================== MORPHING ====================
// Apply scaleX based on user circumference vs reference.
// Map of body part → settings field name.
const PART_TO_FIELD = {
  shoulders: 'circShoulders',
  chest: 'circChest',
  waist: 'circWaist',
  hips: 'circHips',
  'bicep-l': 'circBicep',
  'bicep-r': 'circBicep',
  'thigh-l': 'circThigh',
  'thigh-r': 'circThigh',
  'calf-l': 'circCalf',
  'calf-r': 'circCalf',
  neck: 'circNeck',
};

function applyMorphing(svg, settings, ref) {
  Object.entries(PART_TO_FIELD).forEach(([part, field]) => {
    const userVal = settings[field];
    const refVal = ref[field.replace('circ', '').toLowerCase()] || ref[partRefKey(part)];
    const g = svg.querySelector(`g[data-body-part="${part}"]`);
    if (!g) return;
    if (userVal && refVal) {
      const scale = clamp(userVal / refVal, 0.75, 1.3);
      g.style.transform = `scaleX(${scale})`;
    } else {
      g.style.transform = '';
    }
  });
}

function partRefKey(part) {
  // Strip -l/-r suffix and lowercase
  return part.replace(/-(l|r)$/, '');
}

// ==================== VISCERAL HOTSPOT ====================
// WHtR is shown in the side panel bar — no need to repeat it on the silhouette.
function applyVisceralAndWhtr(svg, settings) {
  const vfTint = getVisceralTint(settings.visceralFat);
  const hotspot = svg.querySelector('#visceral-hotspot');
  if (!hotspot) return;
  if (vfTint) {
    hotspot.setAttribute('fill', vfTint.color);
    hotspot.setAttribute('opacity', String(vfTint.opacity));
  } else {
    hotspot.setAttribute('fill', 'transparent');
  }
}

// ==================== EXPLANATIONS ====================
const EXPLANATIONS = {
  shoulders: 'La larghezza delle spalle è un marker di sviluppo della parte superiore. Il rapporto spalle/vita ideale è ~1.6 per un fisico atletico maschile, ~1.4 per quello femminile.',
  chest: 'Il petto riflette il volume del tronco e lo sviluppo dei pettorali e della gabbia toracica.',
  waist: 'La vita è una delle misure più importanti: il rapporto vita/altezza (WHtR) sotto 0,50 è considerato sano per entrambi i generi e correla con minor rischio cardiovascolare.',
  hips: 'I fianchi insieme alla vita compongono il rapporto vita/fianchi (WHR), che indica la distribuzione del grasso corporeo.',
  bicep: 'La circonferenza del bicipite riflette il volume muscolare delle braccia. Da misurare a braccio teso o flesso (in modo coerente).',
  thigh: 'La coscia indica lo sviluppo muscolare di quadricipiti e adduttori, importanti per forza e potenza degli arti inferiori.',
  calf: 'Il polpaccio è un buon indicatore di propriocezione e tonicità degli arti inferiori.',
  neck: 'Il collo è correlato alla massa magra totale e usato in alcune formule di stima del body fat (Navy Method).',
  head: 'La testa non viene misurata ma fa parte della silhouette di riferimento.',
  forearm: 'L\'avambraccio è correlato alla forza di presa.',
};

const PART_TITLES = {
  head: 'Testa', neck: 'Collo', shoulders: 'Spalle', chest: 'Petto',
  waist: 'Vita', hips: 'Fianchi',
  'bicep-l': 'Bicipite', 'bicep-r': 'Bicipite',
  'forearm-l': 'Avambraccio', 'forearm-r': 'Avambraccio',
  'thigh-l': 'Coscia', 'thigh-r': 'Coscia',
  'calf-l': 'Polpaccio', 'calf-r': 'Polpaccio',
};

// ==================== PUBLIC: getBodyPartInfo ====================
export function getBodyPartInfo(partKey, settings) {
  const refKey = partRefKey(partKey);
  const title = PART_TITLES[partKey] || refKey;
  const ref = getReferenceCircumferences(settings.height, settings.gender);
  const refVal = ref[refKey];
  const field = PART_TO_FIELD[partKey];
  const userVal = field ? settings[field] : null;
  const explanation = EXPLANATIONS[refKey] || '';

  let valueStr = userVal != null ? `${userVal} cm` : 'Non misurato';
  let idealStr = refVal ? `~${Math.round(refVal * 0.9)}-${Math.round(refVal * 1.1)} cm` : '—';
  let delta = '';
  if (userVal != null && refVal) {
    const d = userVal - refVal;
    const sign = d > 0 ? '+' : '';
    delta = ` (${sign}${d.toFixed(1)} cm vs media)`;
  }

  // Special: waist also shows WHtR
  let extra = '';
  if (refKey === 'waist' && settings.circWaist && settings.height) {
    const whtr = (settings.circWaist / settings.height).toFixed(2);
    const tint = getWhtrTint(parseFloat(whtr));
    extra = `<div class="body-detail-row"><span>Rapporto vita/altezza (WHtR)</span><strong style="color:${tint?.color || 'var(--text)'}">${whtr} — ${tint?.label || ''}</strong></div>`;
  }
  if (refKey === 'hips' && settings.circWaist && settings.circHips) {
    const whr = (settings.circWaist / settings.circHips).toFixed(2);
    const tgt = settings.gender === 'M' ? '< 0.95' : '< 0.85';
    extra = `<div class="body-detail-row"><span>Rapporto vita/fianchi (WHR)</span><strong>${whr} (target ${tgt})</strong></div>`;
  }
  if (refKey === 'shoulders' && settings.circShoulders && settings.circWaist) {
    const sw = (settings.circShoulders / settings.circWaist).toFixed(2);
    const tgt = settings.gender === 'M' ? '~1.6' : '~1.4';
    extra = `<div class="body-detail-row"><span>Rapporto spalle/vita</span><strong>${sw} (target ${tgt})</strong></div>`;
  }

  return { title, valueStr, idealStr, delta, explanation, extra };
}

// ==================== SIDE PANEL ====================
function renderSidePanel(settings) {
  const whtr = (settings.circWaist && settings.height) ? settings.circWaist / settings.height : null;
  const whtrTint = getWhtrTint(whtr);
  const bfTint = getBodyFatTint(settings.bodyFat, settings.gender, settings.age);
  const vfTint = getVisceralTint(settings.visceralFat);

  // WHtR meter: 0.30 → 0.70 range, marker at 0.50
  const whtrPct = whtr ? clamp((whtr - 0.30) / 0.40 * 100, 0, 100) : 0;
  const whtrCard = `
    <div class="body-avatar-stat">
      <div class="body-avatar-stat-label">Vita / Altezza (WHtR)</div>
      <div class="body-avatar-stat-value" style="color:${whtrTint?.color || 'var(--text2)'}">${whtr ? whtr.toFixed(2) : '—'}</div>
      <div class="body-avatar-bar">
        <div class="body-avatar-bar-fill" style="width:${whtrPct}%;background:${whtrTint?.color || 'var(--bg3)'}"></div>
        <div class="body-avatar-bar-marker" style="left:50%" title="Soglia 0.50"></div>
      </div>
      <div class="body-avatar-stat-hint">${whtrTint?.label || 'Aggiungi vita e altezza'}</div>
    </div>`;

  // Body fat ring (SVG circle 0..40%)
  const bfPct = settings.bodyFat != null ? clamp(settings.bodyFat, 0, 50) : null;
  const bfCircumference = 2 * Math.PI * 30;
  const bfDashoffset = bfPct != null ? bfCircumference * (1 - bfPct / 50) : bfCircumference;
  const bfCard = `
    <div class="body-avatar-stat">
      <div class="body-avatar-stat-label">Massa grassa</div>
      <div class="body-avatar-ring">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="var(--bg3)" stroke-width="6"/>
          <circle cx="40" cy="40" r="30" fill="none" stroke="${bfTint.color}" stroke-width="6"
            stroke-dasharray="${bfCircumference}" stroke-dashoffset="${bfDashoffset}"
            stroke-linecap="round" transform="rotate(-90 40 40)"
            style="transition:stroke-dashoffset .5s ease, stroke .5s ease"/>
        </svg>
        <div class="body-avatar-ring-text">${bfPct != null ? bfPct.toFixed(1) + '%' : '—'}</div>
      </div>
      <div class="body-avatar-stat-hint" style="color:${bfTint.color}">${bfTint.label}</div>
    </div>`;

  // Visceral + lean tiles
  const vfCard = `
    <div class="body-avatar-stat">
      <div class="body-avatar-stat-label">Grasso viscerale</div>
      <div class="body-avatar-stat-value" style="color:${vfTint?.color || 'var(--text2)'}">${settings.visceralFat ?? '—'}</div>
      <div class="body-avatar-stat-hint">${vfTint?.label || 'Indice bilancia (1-30)'}</div>
    </div>`;
  const leanCard = `
    <div class="body-avatar-stat">
      <div class="body-avatar-stat-label">Massa muscolare</div>
      <div class="body-avatar-stat-value">${settings.skeletalMuscle != null ? settings.skeletalMuscle.toFixed(1) + '%' : '—'}</div>
      <div class="body-avatar-stat-hint">% muscolo scheletrico</div>
    </div>`;

  return `<div class="body-avatar-side">${whtrCard}${bfCard}${vfCard}${leanCard}</div>`;
}

// ==================== EMPTY STATE ====================
function renderEmpty() {
  return `
    <div class="body-avatar-empty">
      <div style="font-size:3rem;margin-bottom:8px">👤</div>
      <p style="margin-bottom:12px">Aggiungi le tue misure in <strong>Corpo → Misure</strong> per vedere il tuo profilo corporeo.</p>
      <button class="btn btn-primary btn-sm" data-page="weight">Vai alle misure</button>
    </div>`;
}

// ==================== MAIN RENDER ====================
export function renderBodyAvatar(container, settings) {
  if (!container) return;
  if (!settings || (!settings.circWaist && !settings.height && !settings.bodyFat)) {
    container.innerHTML = renderEmpty();
    return;
  }

  container.innerHTML = `<div class="body-avatar-wrap">${BODY_SVG}${renderSidePanel(settings)}</div>`;

  const svg = container.querySelector('.body-avatar-svg');
  if (!svg) return;

  // Apply tint
  const bfTint = getBodyFatTint(settings.bodyFat, settings.gender, settings.age);
  applyTint(svg, bfTint.color);

  // Apply morphing
  const ref = getReferenceCircumferences(settings.height, settings.gender);
  applyMorphing(svg, settings, ref);

  // Visceral + WHtR overlays
  applyVisceralAndWhtr(svg, settings);
}

// ==================== UTIL ====================
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
