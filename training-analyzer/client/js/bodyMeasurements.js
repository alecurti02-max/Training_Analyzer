// ==================== BODY MEASUREMENTS MODULE ====================
// All logic for the "Peso & Composizione" page: measurement log, history, charts.
//
// To add/remove a field: edit FIELDS below. The form, history table, and charts
// will adapt automatically. Changing a field's `chart` bucket moves it between
// the trend tabs. The overview tab plots every field that has `overview: true`.
//
// To tweak zones or chart colors, edit CHART_COLORS or VISCERAL_ZONES.

import { api } from './api.js';
import { destroyChart, storeChart, getChartTheme } from './charts.js';

// ---------- FIELD CONFIG (single source of truth) ----------
export const FIELDS = [
  // Circonferenze
  { key: 'circChest',       label: 'Petto',           unit: 'cm',      group: 'circ', chart: 'circ',       overview: true,  color: '#E02020' },
  { key: 'circWaist',       label: 'Vita',            unit: 'cm',      group: 'circ', chart: 'circ',       overview: true,  color: '#FF4444' },
  { key: 'circHips',        label: 'Fianchi',         unit: 'cm',      group: 'circ', chart: 'circ',       overview: true,  color: '#e17055' },
  { key: 'circShoulders',   label: 'Spalle',          unit: 'cm',      group: 'circ', chart: 'circ',       overview: false, color: '#fdcb6e' },
  { key: 'circBicep',       label: 'Bicipite',        unit: 'cm',      group: 'circ', chart: 'circ',       overview: false, color: '#fab1a0' },
  { key: 'circNeck',        label: 'Collo',           unit: 'cm',      group: 'circ', chart: 'circ',       overview: false, color: '#d35400' },
  { key: 'circThigh',       label: 'Coscia',          unit: 'cm',      group: 'circ', chart: 'circ',       overview: false, color: '#a29bfe' },
  { key: 'circCalf',        label: 'Polpaccio',       unit: 'cm',      group: 'circ', chart: 'circ',       overview: false, color: '#6c5ce7' },
  // Composizione: percentuali
  { key: 'bodyFat',         label: 'Massa grassa',    unit: '%',       group: 'comp', chart: 'compPct',    overview: true,  color: '#E02020' },
  { key: 'skeletalMuscle',  label: 'Muscolo scheletr.', unit: '%',     group: 'comp', chart: 'compPct',    overview: true,  color: '#00b894' },
  { key: 'subcutaneousFat', label: 'Grasso sottocut.', unit: '%',      group: 'comp', chart: 'compPct',    overview: false, color: '#fdcb6e' },
  { key: 'bodyWater',       label: 'Acqua',           unit: '%',       group: 'comp', chart: 'compPct',    overview: true,  color: '#0984e3' },
  { key: 'protein',         label: 'Proteine',        unit: '%',       group: 'comp', chart: 'compPct',    overview: false, color: '#74b9ff' },
  // Composizione: masse
  { key: 'muscleMass',      label: 'Massa muscolare', unit: 'kg',      group: 'comp', chart: 'compMass',   overview: false, color: '#00b894' },
  { key: 'boneMass',        label: 'Massa ossea',     unit: 'kg',      group: 'comp', chart: 'compMass',   overview: false, color: '#b2bec3' },
  // Composizione: viscerale (scala a sé)
  { key: 'visceralFat',     label: 'Grasso viscerale', unit: 'indice', group: 'comp', chart: 'visceral',   overview: true,  color: '#c0392b' },
];

export const VISCERAL_ZONES = [
  { max: 9,        label: 'Buono',      color: 'rgba(0,184,148,0.12)', stroke: 'rgba(0,184,148,0.35)' },
  { max: 12,       label: 'Attenzione', color: 'rgba(253,203,110,0.15)', stroke: 'rgba(253,203,110,0.4)' },
  { max: Infinity, label: 'Alto',       color: 'rgba(224,32,32,0.12)', stroke: 'rgba(224,32,32,0.35)' },
];

export const RANGE_OPTIONS = [
  { key: '30d', label: '30 gg', days: 30 },
  { key: '90d', label: '90 gg', days: 90 },
  { key: '6m',  label: '6 mesi', days: 183 },
  { key: '1y',  label: '1 anno', days: 365 },
  { key: 'all', label: 'Tutto', days: null },
];

export const CHART_TABS = [
  { key: 'weight',   label: 'Peso' },
  { key: 'circ',     label: 'Circonferenze' },
  { key: 'compPct',  label: 'Composizione %' },
  { key: 'compMass', label: 'Masse (kg)' },
  { key: 'visceral', label: 'Grasso viscerale' },
  { key: 'overview', label: "Vista d'insieme" },
];

// ---------- STATE ----------
let _measurements = [];
let _weights = [];
let _settings = {};
let _activeTab = 'weight';
let _activeRange = '90d';
// visibility toggles: tabKey -> Set of field keys currently visible
const _visibility = {};

// ---------- DATA ACCESS ----------
export async function loadMeasurements() {
  try {
    const res = await api.get('/api/body-measurements');
    _measurements = Array.isArray(res) ? res : [];
    _measurements.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (e) {
    console.error('Failed to load measurements:', e);
    _measurements = [];
  }
  return _measurements;
}

export function getMeasurements() { return _measurements; }

export function setCaches({ weights, settings }) {
  if (weights) _weights = weights;
  if (settings) _settings = settings;
}

// ---------- HELPERS ----------
function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatDate(d) { return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fieldByKey(k) { return FIELDS.find((f) => f.key === k); }
function fieldsInTab(tab) { return FIELDS.filter((f) => f.chart === tab); }
function filterByRange(rows, rangeKey) {
  const opt = RANGE_OPTIONS.find((r) => r.key === rangeKey);
  if (!opt || opt.days == null) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - opt.days);
  return rows.filter((r) => new Date(r.date) >= cutoff);
}
function toastMsg(msg, type = '') {
  if (window.__tsToast) window.__tsToast(msg, type);
  else if (type === 'error') console.error(msg);
}

// ---------- FORM / HISTORY ----------
function buildFieldInputs(groupKey, valuesSource = {}) {
  const group = FIELDS.filter((f) => f.group === groupKey);
  return group.map((f) => {
    const v = valuesSource[f.key];
    const val = v == null ? '' : v;
    return `<div class="form-group">
      <label>${f.label} (${f.unit})</label>
      <input type="number" step="0.1" min="0" data-bm-field="${f.key}" value="${val}" placeholder="${f.unit}">
    </div>`;
  }).join('');
}

export function renderLogForm(target) {
  const defaults = latestValues();
  target.innerHTML = `
    <div class="form-row" style="margin-bottom:8px">
      <div class="form-group"><label>Data</label><input type="date" id="bm-date" value="${todayStr()}"></div>
      <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" id="bm-save">Salva misurazione</button></div>
    </div>
    <details class="bm-section" open>
      <summary style="cursor:pointer;font-weight:700;margin:8px 0">Circonferenze (cm)</summary>
      <div class="form-row" style="flex-wrap:wrap">${buildFieldInputs('circ', defaults)}</div>
    </details>
    <details class="bm-section">
      <summary style="cursor:pointer;font-weight:700;margin:8px 0">Composizione corporea</summary>
      <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Tipicamente da bilancia impedenziometrica. Lascia vuoto ciò che non misuri.</p>
      <div class="form-row" style="flex-wrap:wrap">${buildFieldInputs('comp', defaults)}</div>
    </details>
    <p style="font-size:.75rem;color:var(--text2);margin-top:6px">Se esiste già una misurazione per la data scelta, verrà aggiornata.</p>
  `;
  target.querySelector('#bm-save').addEventListener('click', () => handleSave(target));
}

function latestValues() {
  if (!_measurements.length) return {};
  return _measurements[_measurements.length - 1];
}

async function handleSave(target) {
  const date = target.querySelector('#bm-date').value || todayStr();
  const payload = { date };
  let hasAny = false;
  target.querySelectorAll('[data-bm-field]').forEach((inp) => {
    const k = inp.dataset.bmField;
    if (inp.value === '' || inp.value == null) return;
    const n = Number(inp.value);
    if (Number.isFinite(n)) { payload[k] = n; hasAny = true; }
  });
  if (!hasAny) { toastMsg('Inserisci almeno un valore', 'error'); return; }
  try {
    const saved = await api.post('/api/body-measurements', payload);
    const idx = _measurements.findIndex((m) => m.date === saved.date);
    if (idx >= 0) _measurements[idx] = saved;
    else _measurements.push(saved);
    _measurements.sort((a, b) => new Date(a.date) - new Date(b.date));
    toastMsg('Misurazione salvata', 'success');
    if (window.__bmOnChange) window.__bmOnChange();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

export function renderHistory(target) {
  if (!_measurements.length) {
    target.innerHTML = '<p style="font-size:.85rem;color:var(--text2)">Nessuna misurazione salvata.</p>';
    return;
  }
  const rows = [..._measurements].reverse().slice(0, 20);
  const cols = ['circWaist', 'circHips', 'bodyFat', 'skeletalMuscle', 'visceralFat'];
  const head = '<tr><th>Data</th>' + cols.map((k) => `<th>${fieldByKey(k).label}</th>`).join('') + '<th></th></tr>';
  const body = rows.map((r) => {
    const cells = cols.map((k) => {
      const v = r[k];
      return `<td>${v == null ? '—' : v + ' ' + fieldByKey(k).unit}</td>`;
    }).join('');
    return `<tr><td>${formatDate(r.date)}</td>${cells}<td><button class="btn-icon" data-bm-del="${r.id}" title="Elimina">✕</button></td></tr>`;
  }).join('');
  target.innerHTML = `<div style="overflow-x:auto"><table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
    <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">${head}</thead>
    <tbody>${body}</tbody>
  </table></div>`;
  target.querySelectorAll('[data-bm-del]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.bmDel));
  });
}

async function handleDelete(id) {
  if (!confirm('Eliminare questa misurazione?')) return;
  try {
    await api.del('/api/body-measurements/' + id);
    _measurements = _measurements.filter((m) => m.id !== id);
    toastMsg('Misurazione eliminata', 'success');
    if (window.__bmOnChange) window.__bmOnChange();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

// ---------- TABS + RANGE ----------
export function renderTabsBar(target) {
  const rangePills = RANGE_OPTIONS.map((r) => (
    `<button class="bm-pill ${_activeRange === r.key ? 'active' : ''}" data-bm-range="${r.key}">${r.label}</button>`
  )).join('');
  const tabs = CHART_TABS.map((t) => (
    `<button class="bm-tab ${_activeTab === t.key ? 'active' : ''}" data-bm-tab="${t.key}">${t.label}</button>`
  )).join('');
  target.innerHTML = `
    <div class="bm-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tabs}</div>
    <div class="bm-range" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${rangePills}</div>
    <div id="bm-chart-controls" style="margin-bottom:8px"></div>
    <div class="chart-container" style="height:320px"><canvas id="bm-canvas"></canvas></div>
  `;
  target.querySelectorAll('[data-bm-tab]').forEach((b) => {
    b.addEventListener('click', () => { _activeTab = b.dataset.bmTab; renderTabsBar(target); renderActiveChart(); });
  });
  target.querySelectorAll('[data-bm-range]').forEach((b) => {
    b.addEventListener('click', () => { _activeRange = b.dataset.bmRange; renderTabsBar(target); renderActiveChart(); });
  });
  renderActiveChart();
}

function renderControls(tab) {
  const el = document.getElementById('bm-chart-controls');
  if (!el) return;
  if (tab === 'weight' || tab === 'visceral') { el.innerHTML = ''; return; }
  const fields = tab === 'overview'
    ? FIELDS.filter((f) => f.overview)
    : fieldsInTab(tab);
  if (!_visibility[tab]) {
    _visibility[tab] = new Set(
      tab === 'overview' ? fields.map((f) => f.key) : fields.filter((f) => f.overview).map((f) => f.key)
    );
    // fallback: if nothing is "overview" in this tab, show all by default
    if (_visibility[tab].size === 0) _visibility[tab] = new Set(fields.map((f) => f.key));
  }
  const vis = _visibility[tab];
  el.innerHTML = fields.map((f) => (
    `<label class="bm-toggle">
      <input type="checkbox" data-bm-vis="${f.key}" ${vis.has(f.key) ? 'checked' : ''}>
      <span class="bm-dot" style="background:${f.color}"></span>
      ${f.label}
    </label>`
  )).join('');
  el.querySelectorAll('[data-bm-vis]').forEach((chk) => {
    chk.addEventListener('change', () => {
      if (chk.checked) vis.add(chk.dataset.bmVis); else vis.delete(chk.dataset.bmVis);
      renderActiveChart();
    });
  });
}

// ---------- CHART ENGINE ----------
function renderActiveChart() {
  renderControls(_activeTab);
  destroyChart('bm');
  resetCanvas();
  const ctx = document.getElementById('bm-canvas')?.getContext('2d');
  if (!ctx) return;
  const ct = getChartTheme();

  if (_activeTab === 'weight') return drawWeight(ctx, ct);
  if (_activeTab === 'visceral') return drawVisceral(ctx, ct);
  if (_activeTab === 'overview') return drawOverview(ctx, ct);
  return drawFieldGroup(ctx, ct, _activeTab);
}

function drawWeight(ctx, ct) {
  const rows = filterByRange(_weights, _activeRange);
  if (!rows.length) return empty(ctx, 'Nessun dato peso nel periodo.');
  const target = _settings?.weightTarget;
  const datasets = [{
    label: 'Peso (kg)',
    data: rows.map((r) => r.value),
    borderColor: '#E02020', pointBackgroundColor: '#E02020', tension: 0.3, fill: false,
  }];
  if (target) datasets.push({
    label: 'Obiettivo', data: rows.map(() => target),
    borderColor: '#00b894', borderDash: [10, 5], pointRadius: 0, fill: false,
  });
  storeChart('bm', new Chart(ctx, {
    type: 'line',
    data: { labels: rows.map((r) => formatDate(r.date)), datasets },
    options: baseLineOpts(ct),
  }));
}

function drawFieldGroup(ctx, ct, tab) {
  const rows = filterByRange(_measurements, _activeRange);
  const fields = fieldsInTab(tab).filter((f) => _visibility[tab]?.has(f.key));
  if (!fields.length) return empty(ctx, 'Seleziona almeno una metrica.');
  if (!rows.some((r) => fields.some((f) => r[f.key] != null))) {
    return empty(ctx, 'Nessuna misurazione nel periodo.');
  }
  const datasets = fields.map((f) => ({
    label: f.label + ' (' + f.unit + ')',
    data: rows.map((r) => (r[f.key] == null ? null : r[f.key])),
    borderColor: f.color, pointBackgroundColor: f.color, tension: 0.3, fill: false, spanGaps: true,
  }));
  storeChart('bm', new Chart(ctx, {
    type: 'line',
    data: { labels: rows.map((r) => formatDate(r.date)), datasets },
    options: baseLineOpts(ct),
  }));
}

function drawVisceral(ctx, ct) {
  const rows = filterByRange(_measurements, _activeRange).filter((r) => r.visceralFat != null);
  if (!rows.length) return empty(ctx, 'Nessun dato grasso viscerale nel periodo.');
  const maxVal = Math.max(...rows.map((r) => r.visceralFat), 15);
  const zonePlugin = {
    id: 'bmZones',
    beforeDatasetsDraw(chart) {
      const { ctx: c, chartArea: a, scales: { y } } = chart;
      let prev = 0;
      VISCERAL_ZONES.forEach((z) => {
        const top = y.getPixelForValue(Math.min(z.max, maxVal));
        const bot = y.getPixelForValue(prev);
        c.save();
        c.fillStyle = z.color;
        c.fillRect(a.left, top, a.right - a.left, bot - top);
        c.restore();
        prev = z.max;
      });
    },
  };
  storeChart('bm', new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map((r) => formatDate(r.date)),
      datasets: [{
        label: 'Grasso viscerale',
        data: rows.map((r) => r.visceralFat),
        borderColor: '#c0392b', pointBackgroundColor: '#c0392b', tension: 0.3, fill: false,
      }],
    },
    options: { ...baseLineOpts(ct), scales: { ...baseLineOpts(ct).scales, y: { ...baseLineOpts(ct).scales.y, min: 0, max: maxVal } } },
    plugins: [zonePlugin],
  }));
}

function drawOverview(ctx, ct) {
  const rows = filterByRange(_measurements, _activeRange);
  const fields = FIELDS.filter((f) => f.overview && _visibility.overview?.has(f.key));
  if (!rows.length || !fields.length) return empty(ctx, 'Seleziona almeno una metrica.');
  const datasets = fields.map((f) => {
    const vals = rows.map((r) => r[f.key]).filter((v) => v != null);
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = (max - min) || 1;
    return {
      label: f.label,
      data: rows.map((r) => (r[f.key] == null ? null : ((r[f.key] - min) / span) * 100)),
      borderColor: f.color, pointBackgroundColor: f.color, tension: 0.3, fill: false, spanGaps: true, borderWidth: 1.5,
    };
  }).filter(Boolean);
  if (!datasets.length) return empty(ctx, 'Servono almeno 2 misurazioni per metrica.');
  storeChart('bm', new Chart(ctx, {
    type: 'line',
    data: { labels: rows.map((r) => formatDate(r.date)), datasets },
    options: {
      ...baseLineOpts(ct),
      plugins: {
        legend: { labels: { color: ct.textColor, font: { family: 'Inter' } } },
        tooltip: { callbacks: { title: (items) => items[0].label, label: (item) => item.dataset.label + ': ' + Math.round(item.raw) + ' (norm.)' } },
      },
      scales: { ...baseLineOpts(ct).scales, y: { ...baseLineOpts(ct).scales.y, min: 0, max: 100, ticks: { ...ct.ticks, callback: (v) => v + '%' } } },
    },
  }));
}

function baseLineOpts(ct) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: ct.textColor, font: { family: 'Inter' } } } },
    scales: {
      x: { ...ct, ticks: { ...ct.ticks, maxTicksLimit: 10 } },
      y: ct,
    },
  };
}

function empty(ctx, msg) {
  const el = ctx.canvas.parentElement;
  if (el) {
    // Hide canvas, show message
    ctx.canvas.style.display = 'none';
    let note = el.querySelector('.bm-empty');
    if (!note) {
      note = document.createElement('div');
      note.className = 'bm-empty';
      note.style.cssText = 'padding:40px;text-align:center;color:var(--text2);font-size:.9rem';
      el.appendChild(note);
    }
    note.textContent = msg;
    note.style.display = '';
  }
}

// Before each render, reset empty state/canvas visibility
function resetCanvas() {
  const canvas = document.getElementById('bm-canvas');
  if (canvas) canvas.style.display = '';
  const note = document.querySelector('.bm-empty');
  if (note) note.style.display = 'none';
}

// ---------- SUMMARY TILES ----------
export function renderSummary(target) {
  const last = latestValues();
  const prev = _measurements.length > 1 ? _measurements[_measurements.length - 2] : null;
  const lastW = _weights.length ? _weights[_weights.length - 1] : null;
  const prevW = _weights.length > 1 ? _weights[_weights.length - 2] : null;

  const tiles = [
    tile('Peso',
      lastW ? lastW.value.toFixed(1) + ' kg' : '—',
      _settings?.height ? 'BMI ' + bmi(lastW?.value, _settings.height) : '',
      diff(lastW?.value, prevW?.value, 1, 'kg')),
    tile('Vita',
      last.circWaist != null ? last.circWaist + ' cm' : '—',
      whtr(last.circWaist, _settings?.height),
      diff(last.circWaist, prev?.circWaist, 1, 'cm')),
    tile('Composizione',
      last.bodyFat != null ? last.bodyFat + '% BF' : '—',
      last.visceralFat != null ? 'Viscerale ' + last.visceralFat + ' ' + visceralBadge(last.visceralFat) : '',
      diff(last.bodyFat, prev?.bodyFat, 1, '%')),
  ];
  target.innerHTML = `<div class="weight-stats">${tiles.join('')}</div>`;
}

function tile(label, main, sub, deltaHtml) {
  return `<div class="weight-stat">
    <div class="ws-value" style="font-size:1.4rem">${main}</div>
    <div class="ws-label">${label}${sub ? ' · ' + sub : ''}</div>
    ${deltaHtml ? `<div style="font-size:.8rem;margin-top:2px">${deltaHtml}</div>` : ''}
  </div>`;
}

function diff(cur, prev, digits, unit) {
  if (cur == null || prev == null) return '';
  const d = +(cur - prev).toFixed(digits);
  const c = d > 0 ? 'var(--red)' : d < 0 ? 'var(--green)' : 'var(--text2)';
  const s = d > 0 ? '+' + d : d;
  return `<span style="color:${c}">Δ ${s} ${unit}</span>`;
}
function bmi(w, h) { if (!w || !h) return '—'; const m = h / 100; return (w / (m * m)).toFixed(1); }
function whtr(waist, h) { if (!waist || !h) return ''; return 'WHtR ' + (waist / h).toFixed(2); }
function visceralBadge(v) {
  if (v <= 9) return '🟢';
  if (v <= 12) return '🟡';
  return '🔴';
}

// ---------- PUBLIC ENTRY ----------
export function renderMeasurementsPage({ weights, settings, onChange, toast: toastFn } = {}) {
  if (weights) _weights = weights;
  if (settings) _settings = settings;
  if (toastFn) window.__tsToast = toastFn;
  if (onChange) window.__bmOnChange = onChange;

  const summary = document.getElementById('bm-summary');
  const form = document.getElementById('bm-form');
  const history = document.getElementById('bm-history');
  const tabs = document.getElementById('bm-tabs-container');

  if (summary) renderSummary(summary);
  if (form) renderLogForm(form);
  if (history) renderHistory(history);
  if (tabs) renderTabsBar(tabs);
}
