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
// Single continuous body outline (head + arms + torso + legs) with
// vertical gradient fill and outer glow filter — visual style of a
// medical/anatomy reference figure. Click hotspots are added separately
// (invisible rects) so each body region is still independently clickable.
// ViewBox is 0 0 240 500 to give room for hands and feet.
const BODY_SVG = `
<svg class="body-avatar-svg" viewBox="0 0 240 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body-tint" x1="0" y1="0" x2="0" y2="1">
      <stop id="body-tint-stop-top"    offset="0%"   stop-color="var(--text2)"/>
      <stop id="body-tint-stop-mid"    offset="50%"  stop-color="var(--text2)" stop-opacity="0.85"/>
      <stop id="body-tint-stop-bottom" offset="100%" stop-color="var(--text2)" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="body-shine" cx="35%" cy="22%" r="65%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="55%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="body-glow" x="-20%" y="-10%" width="140%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b2"/>
      <feMerge>
        <feMergeNode in="b2"/>
        <feMergeNode in="b1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="visceral-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>

  <!-- BODY — single continuous outline. Gradient fill + glow filter. -->
  <g id="body-shape" filter="url(#body-glow)">
    <path id="body-outline" d="
      M 120,18
      C 140,18 154,32 154,52
      C 154,66 148,76 138,80
      L 134,90
      C 144,93 158,97 170,103
      C 182,109 192,118 196,128
      C 198,142 196,158 192,176
      C 188,196 184,216 182,236
      C 180,254 180,270 184,284
      C 188,296 192,306 192,316
      C 192,326 184,332 174,330
      C 168,328 164,322 162,314
      C 160,300 158,284 158,266
      C 158,244 158,222 156,200
      C 154,180 150,166 144,156
      C 142,166 142,180 142,196
      C 142,216 144,238 144,256
      C 144,274 148,292 152,310
      C 158,332 158,356 154,378
      C 150,400 144,422 140,442
      C 138,456 138,468 140,472
      L 156,472
      C 162,472 162,478 158,480
      L 116,480
      L 116,468
      C 116,448 118,422 118,398
      C 118,372 116,348 116,322
      L 116,288
      L 120,286
      L 124,288
      L 124,322
      C 124,348 122,372 122,398
      C 122,422 124,448 124,468
      L 124,480
      L 82,480
      C 78,478 78,472 84,472
      L 100,472
      C 102,468 102,456 100,442
      C 96,422 90,400 86,378
      C 82,356 82,332 88,310
      C 92,292 96,274 96,256
      C 96,238 98,216 98,196
      C 98,180 98,166 96,156
      C 90,166 86,180 84,200
      C 82,222 82,244 82,266
      C 82,284 82,300 80,314
      C 78,322 74,328 68,330
      C 58,332 50,326 50,316
      C 50,306 54,296 58,284
      C 62,270 62,254 60,236
      C 58,216 54,196 50,176
      C 46,158 44,142 46,128
      C 50,118 60,109 72,103
      C 84,97 98,93 108,90
      L 104,80
      C 94,76 88,66 88,52
      C 88,32 102,18 120,18
      Z
    " fill="url(#body-tint)"/>
    <path d="
      M 120,18
      C 140,18 154,32 154,52
      C 154,66 148,76 138,80
      L 134,90
      C 144,93 158,97 170,103
      C 182,109 192,118 196,128
      C 198,142 196,158 192,176
      C 188,196 184,216 182,236
      C 180,254 180,270 184,284
      C 188,296 192,306 192,316
      C 192,326 184,332 174,330
      C 168,328 164,322 162,314
      C 160,300 158,284 158,266
      C 158,244 158,222 156,200
      C 154,180 150,166 144,156
      C 142,166 142,180 142,196
      C 142,216 144,238 144,256
      C 144,274 148,292 152,310
      C 158,332 158,356 154,378
      C 150,400 144,422 140,442
      C 138,456 138,468 140,472
      L 156,472
      C 162,472 162,478 158,480
      L 116,480
      L 116,468
      C 116,448 118,422 118,398
      C 118,372 116,348 116,322
      L 116,288
      L 120,286
      L 124,288
      L 124,322
      C 124,348 122,372 122,398
      C 122,422 124,448 124,468
      L 124,480
      L 82,480
      C 78,478 78,472 84,472
      L 100,472
      C 102,468 102,456 100,442
      C 96,422 90,400 86,378
      C 82,356 82,332 88,310
      C 92,292 96,274 96,256
      C 96,238 98,216 98,196
      C 98,180 98,166 96,156
      C 90,166 86,180 84,200
      C 82,222 82,244 82,266
      C 82,284 82,300 80,314
      C 78,322 74,328 68,330
      C 58,332 50,326 50,316
      C 50,306 54,296 58,284
      C 62,270 62,254 60,236
      C 58,216 54,196 50,176
      C 46,158 44,142 46,128
      C 50,118 60,109 72,103
      C 84,97 98,93 108,90
      L 104,80
      C 94,76 88,66 88,52
      C 88,32 102,18 120,18
      Z
    " fill="url(#body-shine)" pointer-events="none"/>
  </g>

  <!-- Visceral hotspot (only visible when visceralFat is set) -->
  <circle id="visceral-hotspot" cx="120" cy="200" r="22" fill="transparent" filter="url(#visceral-glow)" pointer-events="none"/>

  <!-- INVISIBLE CLICK HOTSPOTS — capture clicks for body-part details modal.
       Stacked over the silhouette without affecting the visual. -->
  <g class="body-avatar-hotspots" fill="rgba(0,0,0,0)">
    <rect data-body-part="head"      x="92"  y="14"  width="56" height="68"/>
    <rect data-body-part="neck"      x="100" y="78"  width="40" height="20"/>
    <rect data-body-part="shoulders" x="60"  y="92"  width="120" height="32"/>
    <rect data-body-part="chest"     x="68"  y="118" width="104" height="56"/>
    <rect data-body-part="waist"     x="80"  y="170" width="80"  height="48"/>
    <rect data-body-part="hips"      x="74"  y="216" width="92"  height="56"/>
    <rect data-body-part="bicep-l"   x="40"  y="118" width="34"  height="74"/>
    <rect data-body-part="bicep-r"   x="166" y="118" width="34"  height="74"/>
    <rect data-body-part="forearm-l" x="46"  y="190" width="32"  height="120"/>
    <rect data-body-part="forearm-r" x="162" y="190" width="32"  height="120"/>
    <rect data-body-part="thigh-l"   x="76"  y="270" width="46"  height="84"/>
    <rect data-body-part="thigh-r"   x="118" y="270" width="46"  height="84"/>
    <rect data-body-part="calf-l"   x="80"  y="354" width="42"  height="120"/>
    <rect data-body-part="calf-r"   x="118" y="354" width="42"  height="120"/>
  </g>
</svg>
`;

// ==================== TINT APPLICATION ====================
// Single-path body uses a gradient fill — update the gradient stops to
// tint the whole figure. The radial highlight (body-shine) stays unchanged
// so we keep the depth/lighting effect across all tints.
function applyTint(svg, color) {
  ['body-tint-stop-top','body-tint-stop-mid','body-tint-stop-bottom'].forEach(id => {
    const stop = svg.querySelector('#'+id);
    if (stop) stop.setAttribute('stop-color', color);
  });
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
