// ==================== PDF EXPORT MODULE ====================
// Generates the "Panoramica fisica" PDF report (4-6 pages) — meant to be
// shown to a personal trainer. Client-side via jsPDF + Chart.js → PNG.
//
// Layout: cover → anagrafica → composizione → profilo atletico (radar) →
// trend 90gg (2x2 mini-charts) → recovery & streak → coach AI summary.

import { calcTonnage, getRecoveryStatus, calculateStreak } from './scoring.js';

// ---------- THEME (CSS var → RGB hex, jsPDF can't read CSS) ----------
const COLORS = {
  red: '#E11D2C',
  green: '#10B981',
  yellow: '#FFD60A',
  orange: '#FB923C',
  blue: '#22D3EE',
  text: '#0E1014',
  text2: '#5A5F6C',
  border: '#DEE0E6',
  bg: '#FFFFFF',
};

function cssVarToHex(varStr) {
  if (!varStr) return COLORS.text;
  const m = String(varStr).match(/var\(--(\w+)\)/);
  if (m && COLORS[m[1]]) return COLORS[m[1]];
  return varStr;
}

// ---------- HELPERS ----------
function todayDateStr() {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fileSafe(s) {
  return String(s || 'utente').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
}

function ageFrom(birthOrAge) {
  if (typeof birthOrAge === 'number') return birthOrAge;
  return null;
}

function fmt(v, unit = '', dash = '—') {
  if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return dash;
  return unit ? `${v} ${unit}` : String(v);
}

// Returns last value of `field` in measurements, plus delta vs first available value.
function latestAndDelta(measurements, field) {
  const sorted = [...(measurements || [])]
    .filter((m) => m && m[field] != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!sorted.length) return { latest: null, delta: null, latestDate: null };
  const latest = sorted[sorted.length - 1][field];
  const first = sorted[0][field];
  return { latest, delta: sorted.length > 1 ? +(latest - first).toFixed(1) : null, latestDate: sorted[sorted.length - 1].date };
}

// ---------- AVATAR / PHOTO ----------
async function loadProfileImageAsDataUrl(photoURL) {
  if (!photoURL) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        // cover-fit centered
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = photoURL;
  });
}

function drawAvatarCircle(doc, dataUrl, name, x, y, size) {
  if (dataUrl) {
    // jsPDF doesn't natively clip to circle; draw image then a thick border-shaped mask
    try {
      doc.addImage(dataUrl, 'JPEG', x, y, size, size);
    } catch (e) {
      drawInitialAvatar(doc, name, x, y, size);
      return;
    }
  } else {
    drawInitialAvatar(doc, name, x, y, size);
  }
  // border ring
  doc.setDrawColor(COLORS.red);
  doc.setLineWidth(1.2);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'S');
}

function drawInitialAvatar(doc, name, x, y, size) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase();
  doc.setFillColor(COLORS.red);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size * 1.4);
  doc.text(initial, x + size / 2, y + size / 2 + size * 0.18, { align: 'center' });
  doc.setTextColor(COLORS.text);
}

// ---------- OFF-SCREEN CHART → PNG ----------
async function chartToImage({ type, data, options, width = 800, height = 400 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.cssText = 'position:absolute;left:-99999px;top:0';
  document.body.appendChild(canvas);
  const chart = new window.Chart(canvas, {
    type,
    data,
    options: { ...(options || {}), animation: false, responsive: false, maintainAspectRatio: false },
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const url = chart.toBase64Image('image/png', 1.0);
  chart.destroy();
  canvas.remove();
  return url;
}

// ---------- SECTION RENDERERS ----------
async function renderCoverPage(doc, ctx) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const top = 22;

  // Avatar
  const avatarSize = 38;
  const avatarX = margin;
  const avatarY = top;
  const dataUrl = await loadProfileImageAsDataUrl(ctx.user?.photoURL);
  drawAvatarCircle(doc, dataUrl, ctx.user?.displayName || ctx.user?.firstName || ctx.user?.email, avatarX, avatarY, avatarSize);

  // Title block right of avatar
  const tx = avatarX + avatarSize + 8;
  doc.setTextColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const fullName = ctx.user?.displayName
    || [ctx.user?.firstName, ctx.user?.lastName].filter(Boolean).join(' ')
    || (ctx.user?.email || 'Atleta');
  doc.text(String(fullName).slice(0, 40), tx, avatarY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(COLORS.text2);
  const sub = [];
  if (ctx.settings?.age) sub.push(`${ctx.settings.age} anni`);
  if (ctx.settings?.gender) sub.push(ctx.settings.gender === 'M' ? 'Uomo' : ctx.settings.gender === 'F' ? 'Donna' : ctx.settings.gender);
  if (sub.length) doc.text(sub.join(' · '), tx, avatarY + 18);

  const sub2 = [];
  if (ctx.settings?.height) sub2.push(`${ctx.settings.height} cm`);
  if (ctx.settings?.bodyweight) sub2.push(`${ctx.settings.bodyweight} kg`);
  if (ctx.settings?.weightTarget) sub2.push(`obiettivo ${ctx.settings.weightTarget} kg`);
  if (sub2.length) doc.text(sub2.join(' · '), tx, avatarY + 25);

  doc.text(`Generato il ${todayDateStr()}`, tx, avatarY + 32);

  // Title + subtitle
  doc.setTextColor(COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Panoramica fisica', margin, top + avatarSize + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.text2);
  doc.text('Report sintetico per il personal trainer', margin, top + avatarSize + 20);

  // Big athletic score badge (if computed)
  if (ctx.fitness && typeof ctx.fitness.score === 'number') {
    const badgeY = top + avatarSize + 30;
    const badgeH = 32;
    const color = cssVarToHex(ctx.fitness.levelColor);
    doc.setFillColor(color);
    doc.roundedRect(margin, badgeY, pageW - 2 * margin, badgeH, 3, 3, 'F');
    doc.setTextColor('#ffffff');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(`${ctx.fitness.score}/100`, margin + 8, badgeY + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.text(`Profilo Atletico — ${ctx.fitness.level || ''}`, margin + 70, badgeY + 14);
    doc.setFontSize(9);
    doc.text('Composito su 6 assi: forza, cardio, resistenza, composizione, flessibilità, atleticità.', margin + 70, badgeY + 22);
    doc.setTextColor(COLORS.text);
  }
}

function renderAnagraficaSection(doc, ctx) {
  const margin = 18;
  let y = doc.internal.pageSize.getHeight() / 2 + 4; // below cover badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COLORS.text);
  doc.text('Anagrafica & obiettivi', margin, y);
  y += 4;

  const s = ctx.settings || {};
  const rows = [
    ['Età', fmt(s.age, 'anni')],
    ['Sesso', s.gender === 'M' ? 'Uomo' : s.gender === 'F' ? 'Donna' : '—'],
    ['Altezza', fmt(s.height, 'cm')],
    ['Peso attuale', fmt(s.bodyweight, 'kg')],
    ['Peso target', fmt(s.weightTarget, 'kg')],
    ['VO₂ max', fmt(s.vo2max, 'ml/kg/min')],
    ['FC max', fmt(s.maxhr, 'bpm')],
    ['FC riposo', fmt(s.resthr, 'bpm')],
    ['Flessibilità', fmt(s.flexibility, '/10')],
    ['Sport attivi', Array.isArray(s.activeSports) && s.activeSports.length ? s.activeSports.join(', ') : '—'],
    ['Obiettivo settimanale', s.weekgoal ? `${s.weekgoal} sedute` : '—'],
    ['Obiettivo km', s.kmgoal ? `${s.kmgoal} km` : '—'],
  ];
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Campo', 'Valore']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: COLORS.red, textColor: '#fff', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
  });
}

function renderBodyCompositionSection(doc, ctx) {
  doc.addPage();
  const margin = 18;
  let y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLORS.text);
  doc.text('Composizione corporea', margin, y);
  y += 4;

  const s = ctx.settings || {};
  const measurements = ctx.measurements || [];
  const lastM = measurements[measurements.length - 1] || {};

  const circ = [
    ['Petto', s.circChest, lastM.circChest, 'cm'],
    ['Vita', s.circWaist, lastM.circWaist, 'cm'],
    ['Fianchi', s.circHips, lastM.circHips, 'cm'],
    ['Spalle', s.circShoulders, lastM.circShoulders, 'cm'],
    ['Bicipite', s.circBicep, lastM.circBicep, 'cm'],
    ['Collo', s.circNeck, lastM.circNeck, 'cm'],
    ['Coscia', s.circThigh, lastM.circThigh, 'cm'],
    ['Polpaccio', s.circCalf, lastM.circCalf, 'cm'],
  ];

  const compRows = [
    ['Massa grassa (BF%)', s.bodyFat, 'bodyFat', '%'],
    ['Muscolo scheletrico', s.skeletalMuscle, 'skeletalMuscle', '%'],
    ['Acqua corporea', s.bodyWater, 'bodyWater', '%'],
    ['Grasso sottocutaneo', s.subcutaneousFat, 'subcutaneousFat', '%'],
    ['Grasso viscerale', s.visceralFat, 'visceralFat', 'idx'],
    ['Proteine', s.protein, 'protein', '%'],
    ['Massa muscolare', s.muscleMass, 'muscleMass', 'kg'],
    ['Massa ossea', s.boneMass, 'boneMass', 'kg'],
  ];

  // Circonferenze
  doc.autoTable({
    startY: y + 4,
    margin: { left: margin, right: margin },
    head: [['Circonferenza', 'Valore', 'Unità']],
    body: circ.map(([label, settingsVal, mVal, unit]) => {
      const v = settingsVal != null ? settingsVal : mVal;
      return [label, v != null ? String(v) : '—', unit];
    }),
    theme: 'striped',
    headStyles: { fillColor: COLORS.red, textColor: '#fff', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { cellWidth: 18, halign: 'center' } },
  });

  // Composizione (con delta storico se disponibile)
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: margin, right: margin },
    head: [['Metrica', 'Attuale', 'Δ vs primo dato', 'Unità']],
    body: compRows.map(([label, settingsVal, key, unit]) => {
      const v = settingsVal != null ? settingsVal : (lastM[key] != null ? lastM[key] : null);
      const { delta } = latestAndDelta(measurements, key);
      const deltaStr = delta == null ? '—' : (delta > 0 ? `+${delta}` : String(delta));
      return [label, v != null ? String(v) : '—', deltaStr, unit];
    }),
    theme: 'striped',
    headStyles: { fillColor: COLORS.red, textColor: '#fff', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { cellWidth: 18, halign: 'center' } },
  });
}

async function renderFitnessProfileSection(doc, ctx) {
  doc.addPage();
  const margin = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLORS.text);
  doc.text('Profilo atletico', margin, 22);

  const fitness = ctx.fitness;
  if (!fitness || !Array.isArray(fitness.details) || !fitness.details.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text2);
    doc.text('Dati insufficienti per calcolare il profilo atletico.', margin, 32);
    return;
  }

  // Radar
  const labels = fitness.details.map((d) => d.label);
  const values = fitness.details.map((d) => Number(d.pct) || 0);
  const radarUrl = await chartToImage({
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Profilo',
        data: values,
        backgroundColor: 'rgba(225,29,44,0.20)',
        borderColor: COLORS.red,
        borderWidth: 2,
        pointBackgroundColor: COLORS.red,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, color: '#B0B4BE', font: { size: 11 } }, pointLabels: { font: { size: 13 } } } },
    },
    width: 700, height: 700,
  });
  const radarSize = 90;
  const pageW = doc.internal.pageSize.getWidth();
  doc.addImage(radarUrl, 'PNG', (pageW - radarSize) / 2, 28, radarSize, radarSize);

  // Detail rows
  const tableY = 28 + radarSize + 4;
  doc.autoTable({
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [['Asse', 'Punteggio', '%', 'Note']],
    body: fitness.details.map((d) => [
      d.label,
      String(d.value || ''),
      `${d.pct || 0}%`,
      String(d.sublabel || ''),
    ]),
    theme: 'striped',
    headStyles: { fillColor: COLORS.red, textColor: '#fff', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: 22, halign: 'right' }, 2: { cellWidth: 14, halign: 'right' } },
  });
}

// Group workouts by ISO week → sum tonnage / km
function aggregateWeekly(workouts, type, valueFn) {
  const buckets = {};
  workouts.filter((w) => w.type === type).forEach((w) => {
    const d = new Date(w.date);
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + (valueFn(w) || 0);
  });
  return Object.entries(buckets)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([date, value]) => ({ date, value }));
}

async function renderTrendChartsSection(doc, ctx) {
  doc.addPage();
  const margin = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLORS.text);
  doc.text('Trend ultimi 90 giorni', margin, 22);

  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // 1) Peso
  const weights = (ctx.weights || []).filter((w) => w.date >= cutoffStr).sort((a, b) => new Date(a.date) - new Date(b.date));
  // 2) Tonnellaggio settimanale gym
  const userBW = ctx.settings?.bodyweight || 0;
  const tonnageWeekly = aggregateWeekly((ctx.workouts || []).filter((w) => w.date >= cutoffStr), 'gym', (w) => w._tonnage || calcTonnage(w.exercises || [], userBW));
  // 3) Km settimanali running
  const kmWeekly = aggregateWeekly((ctx.workouts || []).filter((w) => w.date >= cutoffStr), 'running', (w) => w.distance || 0);
  // 4) Body fat
  const bf = (ctx.measurements || []).filter((m) => m.date >= cutoffStr && m.bodyFat != null).sort((a, b) => new Date(a.date) - new Date(b.date));

  const charts = [
    {
      title: 'Peso (kg)',
      data: { labels: weights.map((w) => w.date.slice(5)), datasets: [{ label: 'kg', data: weights.map((w) => w.value), borderColor: COLORS.red, backgroundColor: 'rgba(225,29,44,0.15)', tension: 0.3, fill: true, pointRadius: 2 }] },
      empty: !weights.length,
    },
    {
      title: 'Tonnellaggio settimanale (kg)',
      data: { labels: tonnageWeekly.map((b) => b.date.slice(5)), datasets: [{ label: 'kg', data: tonnageWeekly.map((b) => Math.round(b.value)), borderColor: COLORS.blue, backgroundColor: 'rgba(34,211,238,0.15)', tension: 0.3, fill: true, pointRadius: 2 }] },
      empty: !tonnageWeekly.length,
    },
    {
      title: 'Km running settimanali',
      data: { labels: kmWeekly.map((b) => b.date.slice(5)), datasets: [{ label: 'km', data: kmWeekly.map((b) => +b.value.toFixed(1)), borderColor: COLORS.green, backgroundColor: 'rgba(16,185,129,0.15)', tension: 0.3, fill: true, pointRadius: 2 }] },
      empty: !kmWeekly.length,
    },
    {
      title: 'Massa grassa (%)',
      data: { labels: bf.map((m) => m.date.slice(5)), datasets: [{ label: '%', data: bf.map((m) => m.bodyFat), borderColor: COLORS.orange, backgroundColor: 'rgba(251,146,60,0.15)', tension: 0.3, fill: true, pointRadius: 2 }] },
      empty: !bf.length,
    },
  ];

  const pageW = doc.internal.pageSize.getWidth();
  const cellW = (pageW - 2 * margin - 6) / 2;
  const cellH = cellW * 0.6;
  const positions = [
    [margin, 30],
    [margin + cellW + 6, 30],
    [margin, 30 + cellH + 18],
    [margin + cellW + 6, 30 + cellH + 18],
  ];

  for (let i = 0; i < charts.length; i++) {
    const c = charts[i];
    const [x, y] = positions[i];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    doc.text(c.title, x, y - 2);
    if (c.empty) {
      doc.setDrawColor(COLORS.border);
      doc.rect(x, y, cellW, cellH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(COLORS.text2);
      doc.text('Dati non disponibili', x + cellW / 2, y + cellH / 2, { align: 'center' });
      continue;
    }
    const url = await chartToImage({
      type: 'line',
      data: c.data,
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 6 } }, y: { ticks: { font: { size: 9 } } } } },
      width: 800, height: 480,
    });
    doc.addImage(url, 'PNG', x, y, cellW, cellH);
  }
}

function renderRecoveryStreakSection(doc, ctx) {
  doc.addPage();
  const margin = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLORS.text);
  doc.text('Recupero & costanza', margin, 22);

  const muscleGroups = ctx.muscleGroups && ctx.muscleGroups.length ? ctx.muscleGroups : [];
  const recovery = getRecoveryStatus(ctx.workouts || [], muscleGroups);
  const streak = calculateStreak(ctx.workouts || []);

  // Top tiles
  const pageW = doc.internal.pageSize.getWidth();
  const tileW = (pageW - 2 * margin - 12) / 3;
  const tileY = 30;
  const tiles = [
    { label: 'Streak attuale', value: `${streak.current} gg`, sub: `Record: ${streak.record} gg` },
    { label: 'Fatica generale', value: `${recovery.generalFatigue}/100`, sub: `Allenamenti 7gg: ${recovery.workoutsLast7}` },
    { label: 'Riposo suggerito', value: `${recovery.suggestedRestDays} gg`, sub: 'In base al carico recente' },
  ];
  tiles.forEach((t, i) => {
    const x = margin + i * (tileW + 6);
    doc.setDrawColor(COLORS.border);
    doc.setFillColor('#EDEEF1');
    doc.roundedRect(x, tileY, tileW, 26, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text2);
    doc.text(t.label.toUpperCase(), x + 4, tileY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(COLORS.text);
    doc.text(t.value, x + 4, tileY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text2);
    doc.text(t.sub, x + 4, tileY + 22);
  });

  // Muscle recovery table
  const muscles = Object.keys(recovery.muscleRecovery || {});
  if (muscles.length) {
    doc.autoTable({
      startY: tileY + 32,
      margin: { left: margin, right: margin },
      head: [['Muscolo', 'Ultimo lavoro', 'Giorni fa', 'Recupero']],
      body: muscles.map((m) => {
        const r = recovery.muscleRecovery[m];
        return [
          m,
          r.lastWorked ? new Date(r.lastWorked).toLocaleDateString('it-IT') : 'Mai',
          r.lastWorked ? `${r.daysAgo}` : '—',
          `${r.pct}%`,
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: COLORS.red, textColor: '#fff', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }
}

function renderAiSummarySection(doc, aiSummary) {
  if (!aiSummary || (typeof aiSummary !== 'object')) return;
  const hasContent = (aiSummary.summary && String(aiSummary.summary).trim())
    || (Array.isArray(aiSummary.strengths) && aiSummary.strengths.length)
    || (Array.isArray(aiSummary.improvements) && aiSummary.improvements.length)
    || (Array.isArray(aiSummary.recommendations) && aiSummary.recommendations.length);
  if (!hasContent) return;

  doc.addPage();
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(COLORS.text);
  doc.text('Sintesi del coach (AI)', margin, y);
  y += 8;

  if (aiSummary.summary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    const lines = doc.splitTextToSize(String(aiSummary.summary), pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  }

  function bulletList(title, items, color) {
    if (!Array.isArray(items) || !items.length) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(color);
    doc.text(title, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${String(item)}`, pageW - 2 * margin - 4);
      if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 22;
      }
      doc.text(lines, margin + 2, y);
      y += lines.length * 5 + 2;
    });
    y += 4;
  }

  bulletList('Punti di forza', aiSummary.strengths, COLORS.green);
  bulletList('Aree da migliorare', aiSummary.improvements, COLORS.orange);
  bulletList('Raccomandazioni concrete', aiSummary.recommendations, COLORS.blue);
}

function addFooter(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text2);
    doc.text(`Pagina ${i}/${total} · Training Analyzer · ${todayDateStr()}`, pageW / 2, pageH - 8, { align: 'center' });
  }
}

async function saveOrFallback(doc, filename) {
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // Standalone web-app on iOS Home Screen: window.open('_blank') doesn't work
  // (no tab to open into) and <a download> is ignored. The reliable path is
  // the Web Share API → user picks "Save to Files", "Mail", "WhatsApp", etc.
  const isStandalone = window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches;

  if (isIos) {
    const blob = doc.output('blob');
    let file = null;
    try { file = new File([blob], filename, { type: 'application/pdf' }); } catch (_) { /* old iOS */ }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Panoramica fisica', text: filename });
        return;
      } catch (e) {
        // User cancelled or share failed — fall through to next strategy
        if (e?.name === 'AbortError') return;
      }
    }

    // Fallback for older iOS / Share API not available: open the blob URL in
    // a new context. In standalone mode this opens Safari, where the user can
    // tap the Share icon to save.
    const url = URL.createObjectURL(blob);
    if (isStandalone) {
      // window.open from standalone may be blocked → use location swap instead.
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  doc.save(filename);
}

// ---------- PUBLIC ENTRY ----------
export async function exportProfilePdf(ctx) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF non caricato');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Page 1: cover + anagrafica
  await renderCoverPage(doc, ctx);
  renderAnagraficaSection(doc, ctx);

  // Page 2+: sections
  renderBodyCompositionSection(doc, ctx);
  await renderFitnessProfileSection(doc, ctx);
  await renderTrendChartsSection(doc, ctx);
  renderRecoveryStreakSection(doc, ctx);
  renderAiSummarySection(doc, ctx.aiSummary);

  addFooter(doc);

  const nameForFile = fileSafe(ctx.user?.displayName
    || [ctx.user?.firstName, ctx.user?.lastName].filter(Boolean).join('-')
    || ctx.user?.email
    || 'utente');
  const dateForFile = new Date().toISOString().slice(0, 10);
  await saveOrFallback(doc, `panoramica-${nameForFile}-${dateForFile}.pdf`);
}
