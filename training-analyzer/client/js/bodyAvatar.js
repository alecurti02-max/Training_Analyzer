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
// Front-view simplified human body, viewBox 0 0 200 400.
// Each <g data-body-part> can be transformed independently.
const BODY_SVG = `
<svg class="body-avatar-svg" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body-tint" x1="0" y1="0" x2="0" y2="1">
      <stop id="body-tint-stop-top"    offset="0%"   stop-color="var(--text2)"/>
      <stop id="body-tint-stop-bottom" offset="100%" stop-color="var(--text2)"/>
    </linearGradient>
    <filter id="visceral-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>

  <!-- Head -->
  <g data-body-part="head" style="transform-origin:100px 30px">
    <circle cx="100" cy="32" r="22"/>
  </g>
  <!-- Neck -->
  <g data-body-part="neck" style="transform-origin:100px 60px">
    <rect x="92" y="52" width="16" height="14"/>
  </g>

  <!-- Shoulders/upper torso -->
  <g data-body-part="shoulders" style="transform-origin:100px 75px">
    <path d="M 60,80 Q 100,60 140,80 L 138,95 L 62,95 Z"/>
  </g>

  <!-- Chest -->
  <g data-body-part="chest" style="transform-origin:100px 115px">
    <path d="M 65,95 L 135,95 L 132,140 L 68,140 Z"/>
  </g>

  <!-- Waist -->
  <g data-body-part="waist" style="transform-origin:100px 165px">
    <path d="M 70,140 L 130,140 L 128,185 L 72,185 Z"/>
  </g>

  <!-- Hips -->
  <g data-body-part="hips" style="transform-origin:100px 205px">
    <path d="M 70,185 L 130,185 L 138,225 L 62,225 Z"/>
  </g>

  <!-- Biceps -->
  <g data-body-part="bicep-l" style="transform-origin:48px 115px">
    <path d="M 42,90 L 60,95 L 58,140 L 38,140 Z"/>
  </g>
  <g data-body-part="bicep-r" style="transform-origin:152px 115px">
    <path d="M 140,95 L 158,90 L 162,140 L 142,140 Z"/>
  </g>

  <!-- Forearms (static) -->
  <g data-body-part="forearm-l" style="transform-origin:45px 175px">
    <path d="M 38,140 L 58,140 L 52,210 L 36,210 Z"/>
  </g>
  <g data-body-part="forearm-r" style="transform-origin:155px 175px">
    <path d="M 142,140 L 162,140 L 164,210 L 148,210 Z"/>
  </g>

  <!-- Thighs -->
  <g data-body-part="thigh-l" style="transform-origin:80px 270px">
    <path d="M 70,225 L 100,225 L 96,310 L 64,310 Z"/>
  </g>
  <g data-body-part="thigh-r" style="transform-origin:120px 270px">
    <path d="M 100,225 L 130,225 L 136,310 L 104,310 Z"/>
  </g>

  <!-- Calves -->
  <g data-body-part="calf-l" style="transform-origin:80px 350px">
    <path d="M 64,310 L 96,310 L 92,395 L 70,395 Z"/>
  </g>
  <g data-body-part="calf-r" style="transform-origin:120px 350px">
    <path d="M 104,310 L 136,310 L 130,395 L 108,395 Z"/>
  </g>

  <!-- WHtR ring (around waist) -->
  <ellipse id="whtr-ring" cx="100" cy="162" rx="36" ry="6" fill="none" stroke="transparent" stroke-width="3" pointer-events="none"/>

  <!-- Visceral hotspot (abdomen) -->
  <circle id="visceral-hotspot" cx="100" cy="162" r="14" fill="transparent" filter="url(#visceral-glow)" pointer-events="none"/>
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

// ==================== VISCERAL + WHTR ====================
function applyVisceralAndWhtr(svg, settings) {
  const vfTint = getVisceralTint(settings.visceralFat);
  const hotspot = svg.querySelector('#visceral-hotspot');
  if (hotspot) {
    if (vfTint) {
      hotspot.setAttribute('fill', vfTint.color);
      hotspot.setAttribute('opacity', String(vfTint.opacity));
    } else {
      hotspot.setAttribute('fill', 'transparent');
    }
  }
  const whtr = (settings.circWaist && settings.height) ? settings.circWaist / settings.height : null;
  const whtrTint = getWhtrTint(whtr);
  const ring = svg.querySelector('#whtr-ring');
  if (ring) {
    if (whtrTint) ring.setAttribute('stroke', whtrTint.color);
    else ring.setAttribute('stroke', 'transparent');
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
