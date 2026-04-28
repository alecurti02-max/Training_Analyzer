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
// Single continuous body outline rendered as STROKE + subtle inner fill,
// like a medical/fitness anatomy figure. Outer glow filter for the aura.
// Path traces head → right arm/hand → right side of torso → right leg →
// up between the legs → down the left leg → up left side → left arm →
// back to top of head. Anatomy: visible legs separation, knee/calf
// definition, suggested hands at hip level.
const BODY_SVG = `
<svg class="body-avatar-svg" viewBox="0 0 240 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body-tint" x1="0" y1="0" x2="0" y2="1">
      <stop id="body-tint-stop-top"    offset="0%"   stop-color="var(--text2)" stop-opacity="0.18"/>
      <stop id="body-tint-stop-mid"    offset="55%"  stop-color="var(--text2)" stop-opacity="0.10"/>
      <stop id="body-tint-stop-bottom" offset="100%" stop-color="var(--text2)" stop-opacity="0.18"/>
    </linearGradient>
    <radialGradient id="body-shine" cx="65%" cy="30%" r="70%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="60%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="body-glow" x="-20%" y="-10%" width="140%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b2"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b3"/>
      <feMerge>
        <feMergeNode in="b3"/>
        <feMergeNode in="b2"/>
        <feMergeNode in="b1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="visceral-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>

  <!-- BODY — outline + subtle gradient fill, with outer glow -->
  <g id="body-shape">
    <!-- Soft inner gradient fill (low alpha) -->
    <path id="body-fill" d="__BODY_PATH__" fill="url(#body-tint)" stroke="none" pointer-events="none"/>
    <!-- Highlight on the right side for depth -->
    <path d="__BODY_PATH__" fill="url(#body-shine)" stroke="none" pointer-events="none"/>
    <!-- The actual outline + glow -->
    <path id="body-outline" d="__BODY_PATH__" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#body-glow)"/>
  </g>

  <!-- Visceral hotspot (only visible when visceralFat is meaningful) -->
  <circle id="visceral-hotspot" cx="120" cy="200" r="20" fill="transparent" filter="url(#visceral-glow)" pointer-events="none"/>

  <!-- INVISIBLE CLICK HOTSPOTS -->
  <g class="body-avatar-hotspots" fill="rgba(0,0,0,0)">
    <rect data-body-part="head"      x="92"  y="14"  width="56" height="68"/>
    <rect data-body-part="neck"      x="106" y="80"  width="28" height="20"/>
    <rect data-body-part="shoulders" x="60"  y="98"  width="120" height="20"/>
    <rect data-body-part="chest"     x="78"  y="118" width="84"  height="56"/>
    <rect data-body-part="waist"     x="84"  y="178" width="72"  height="44"/>
    <rect data-body-part="hips"      x="78"  y="222" width="84"  height="50"/>
    <rect data-body-part="bicep-l"   x="40"  y="118" width="38"  height="80"/>
    <rect data-body-part="bicep-r"   x="162" y="118" width="38"  height="80"/>
    <rect data-body-part="forearm-l" x="44"  y="198" width="36"  height="130"/>
    <rect data-body-part="forearm-r" x="160" y="198" width="36"  height="130"/>
    <rect data-body-part="thigh-l"   x="78"  y="272" width="42"  height="100"/>
    <rect data-body-part="thigh-r"   x="120" y="272" width="42"  height="100"/>
    <rect data-body-part="calf-l"    x="80"  y="372" width="40"  height="108"/>
    <rect data-body-part="calf-r"    x="120" y="372" width="40"  height="108"/>
  </g>
</svg>
`.replace(/__BODY_PATH__/g, BODY_PATH());

// Single continuous path traced as one closed loop. Returns the d= string.
function BODY_PATH() {
  return `
    M 120,16
    C 140,16 156,32 156,52
    C 156,68 150,76 142,80
    Q 130,84 120,84
    Q 110,84 98,80
    C 90,76 84,68 84,52
    C 84,32 100,16 120,16 Z

    M 108,82
    L 110,98
    C 96,102 80,108 72,116
    Q 62,124 60,138
    Q 58,156 60,178
    Q 62,200 64,222
    Q 64,242 66,260
    Q 64,278 64,294
    Q 62,308 56,318
    Q 50,328 52,336
    Q 56,344 64,342
    Q 70,338 74,330
    Q 78,316 80,302
    Q 82,284 84,266
    Q 86,244 88,222
    Q 90,200 92,184
    L 92,200
    Q 92,218 92,234
    Q 92,254 96,272
    Q 98,288 96,304
    Q 92,324 90,344
    Q 88,366 86,388
    Q 84,410 82,432
    Q 80,452 84,468
    Q 88,478 100,478
    L 110,478
    Q 116,478 116,470
    L 117,452
    Q 118,422 118,392
    Q 119,360 120,328
    L 120,300
    L 120,278
    L 120,300
    L 120,328
    Q 121,360 122,392
    Q 122,422 123,452
    L 124,470
    Q 124,478 130,478
    L 140,478
    Q 152,478 156,468
    Q 160,452 158,432
    Q 156,410 154,388
    Q 152,366 150,344
    Q 148,324 144,304
    Q 142,288 144,272
    Q 148,254 148,234
    Q 148,218 148,200
    L 148,184
    Q 150,200 152,222
    Q 154,244 156,266
    Q 158,284 160,302
    Q 162,316 166,330
    Q 170,338 176,342
    Q 184,344 188,336
    Q 190,328 184,318
    Q 178,308 176,294
    Q 176,278 176,260
    Q 178,242 178,222
    Q 180,200 182,178
    Q 184,156 182,138
    Q 180,124 170,116
    C 162,108 146,102 132,98
    L 130,82
    Z
  `;
}

// ==================== TINT APPLICATION ====================
// Apply the body fat tint color to both the inner gradient fill (low alpha)
// and the outline stroke. The radial highlight stays unchanged for depth.
function applyTint(svg, color) {
  ['body-tint-stop-top','body-tint-stop-mid','body-tint-stop-bottom'].forEach(id => {
    const stop = svg.querySelector('#'+id);
    if (stop) stop.setAttribute('stop-color', color);
  });
  const outline = svg.querySelector('#body-outline');
  if (outline) outline.setAttribute('stroke', color);
}

// ==================== MORPHING ====================
// Map of body part → settings field name. Kept for getBodyPartInfo().
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

// Per-part SVG morphing was tried with a multi-part figure but the seams
// always showed and looked ugly. Visual quality of a single anatomical
// path beats per-part scaling — circumferences are still surfaced via
// the click-to-detail modal and the side panel.
function applyMorphing() { /* no-op: single-path silhouette */ }

function partRefKey(part) {
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

  // Apply tint to the gradient stops
  const bfTint = getBodyFatTint(settings.bodyFat, settings.gender, settings.age);
  applyTint(svg, bfTint.color);

  // Visceral overlay
  applyVisceralAndWhtr(svg, settings);
}

// ==================== UTIL ====================
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
