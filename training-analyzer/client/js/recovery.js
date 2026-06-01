// ==================== RECOVERY MODULE ====================
// Logging giornaliero alimentazione + sonno. Pattern: un record per giorno
// con upsert su (userId, date). Confronto vs target da Settings.

import { api } from './api.js';
import { todayStr } from '../src/lib/utils.js';

let _nutrition = []; // sorted asc by date
let _sleep = [];     // sorted asc by date
let _settings = {};

// todayStr from src/lib/utils.js (top).
function fmtDateShort(d) { return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); }
function toastMsg(msg, type = '') {
  if (window.__tsToast) window.__tsToast(msg, type);
  else if (type === 'error') console.error(msg);
}

// ---------- DATA ACCESS ----------
export async function loadRecoveryData() {
  try {
    const [nut, slp] = await Promise.all([
      api.get('/api/nutrition').catch(() => []),
      api.get('/api/sleep').catch(() => []),
    ]);
    _nutrition = (Array.isArray(nut) ? nut : []).sort((a, b) => new Date(a.date) - new Date(b.date));
    _sleep = (Array.isArray(slp) ? slp : []).sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (e) {
    console.error('Failed to load recovery data:', e);
  }
}

export function getNutrition() { return _nutrition; }
export function getSleep() { return _sleep; }

// ---------- NUTRITION ----------
function nutritionTodayHtml() {
  const today = todayStr();
  const rec = _nutrition.find((r) => r.date === today);
  const t = _settings || {};
  const calT = t.caloriesTarget;
  const proT = t.proteinTargetG;

  function tile(label, value, target, unit) {
    const valStr = value == null ? '—' : `${Math.round(value)} ${unit}`;
    const tgtStr = target ? ` / ${target} ${unit}` : '';
    let delta = '';
    let deltaColor = 'var(--text2)';
    if (value != null && target) {
      const d = value - target;
      const sign = d > 0 ? '+' : '';
      delta = `Δ ${sign}${Math.round(d)} ${unit}`;
      if (Math.abs(d) <= target * 0.05) deltaColor = 'var(--green)';
      else if (Math.abs(d) <= target * 0.15) deltaColor = 'var(--yellow)';
      else deltaColor = 'var(--red)';
    }
    return `<div class="weight-stat">
      <div class="ws-value" style="font-size:1.4rem">${valStr}<span style="font-size:.85rem;color:var(--text2);font-weight:400">${tgtStr}</span></div>
      <div class="ws-label">${label}</div>
      ${delta ? `<div style="font-size:.8rem;margin-top:2px;color:${deltaColor}">${delta}</div>` : ''}
    </div>`;
  }

  const tiles = [
    tile('Calorie', rec?.calories ?? null, calT, 'kcal'),
    tile('Proteine', rec?.proteinG ?? null, proT, 'g'),
    tile('Carboidrati', rec?.carbsG ?? null, null, 'g'),
    tile('Grassi', rec?.fatG ?? null, null, 'g'),
  ];
  return `<div class="weight-stats">${tiles.join('')}</div>`
    + (!calT && !proT ? `<p style="font-size:.78rem;color:var(--text2);margin-top:8px">Imposta i target in <strong>Setup &gt; Impostazioni</strong> per vedere il confronto.</p>` : '');
}

function renderNutritionToday() {
  const el = document.getElementById('nutrition-today-summary');
  if (el) el.innerHTML = nutritionTodayHtml();
}

function renderNutritionHistory() {
  const el = document.getElementById('nutrition-history');
  if (!el) return;
  if (!_nutrition.length) {
    el.innerHTML = '<p style="font-size:.85rem;color:var(--text2)">Nessun log alimentazione salvato.</p>';
    return;
  }
  const rows = [..._nutrition].reverse().slice(0, 30);
  const head = '<tr><th>Data</th><th>Calorie</th><th>P</th><th>C</th><th>G</th><th></th></tr>';
  const body = rows.map((r) => `<tr>
    <td>${fmtDateShort(r.date)}</td>
    <td>${r.calories != null ? r.calories : '—'}</td>
    <td>${r.proteinG != null ? r.proteinG + 'g' : '—'}</td>
    <td>${r.carbsG != null ? r.carbsG + 'g' : '—'}</td>
    <td>${r.fatG != null ? r.fatG + 'g' : '—'}</td>
    <td><button class="btn-icon" data-nut-del="${r.id}" title="Elimina">✕</button></td>
  </tr>`).join('');
  el.innerHTML = `<div style="overflow-x:auto"><table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
    <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">${head}</thead>
    <tbody>${body}</tbody>
  </table></div>`;
  el.querySelectorAll('[data-nut-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteNutrition(btn.dataset.nutDel));
  });
}

export async function saveNutritionLog() {
  const date = document.getElementById('nut-date').value || todayStr();
  const cal = document.getElementById('nut-calories').value;
  const p = document.getElementById('nut-protein').value;
  const c = document.getElementById('nut-carbs').value;
  const f = document.getElementById('nut-fat').value;
  const notes = document.getElementById('nut-notes').value;

  if (!cal && !p && !c && !f) {
    toastMsg('Inserisci almeno un valore', 'error');
    return;
  }
  const payload = { date };
  if (cal !== '') payload.calories = parseInt(cal, 10);
  if (p !== '') payload.proteinG = parseFloat(p);
  if (c !== '') payload.carbsG = parseFloat(c);
  if (f !== '') payload.fatG = parseFloat(f);
  if (notes) payload.notes = notes;

  try {
    const saved = await api.post('/api/nutrition', payload);
    const idx = _nutrition.findIndex((m) => m.date === saved.date);
    if (idx >= 0) _nutrition[idx] = saved;
    else _nutrition.push(saved);
    _nutrition.sort((a, b) => new Date(a.date) - new Date(b.date));
    toastMsg('Log alimentazione salvato', 'success');
    // Reset i campi numerici (mantieni la data)
    document.getElementById('nut-calories').value = '';
    document.getElementById('nut-protein').value = '';
    document.getElementById('nut-carbs').value = '';
    document.getElementById('nut-fat').value = '';
    document.getElementById('nut-notes').value = '';
    renderNutritionToday();
    renderNutritionHistory();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

async function deleteNutrition(id) {
  if (!confirm('Eliminare questo log?')) return;
  try {
    await api.del('/api/nutrition/' + id);
    _nutrition = _nutrition.filter((r) => r.id !== id);
    toastMsg('Log eliminato', 'success');
    renderNutritionToday();
    renderNutritionHistory();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

// ---------- SLEEP ----------
function sleepTodayHtml() {
  const today = todayStr();
  const rec = _sleep.find((r) => r.date === today);
  const t = _settings || {};
  const dur = rec?.durationHours;
  const q = rec?.quality;
  const dT = t.sleepHoursTarget;

  function tile(label, value, target, unit, formatter) {
    const valStr = value == null ? '—' : (formatter ? formatter(value) : `${value} ${unit}`);
    const tgtStr = target ? ` / ${target} ${unit}` : '';
    let delta = '';
    let deltaColor = 'var(--text2)';
    if (value != null && target) {
      const d = value - target;
      const sign = d > 0 ? '+' : '';
      delta = `Δ ${sign}${(+d).toFixed(1)} ${unit}`;
      if (Math.abs(d) <= 0.5) deltaColor = 'var(--green)';
      else if (Math.abs(d) <= 1.0) deltaColor = 'var(--yellow)';
      else deltaColor = 'var(--red)';
    }
    return `<div class="weight-stat">
      <div class="ws-value" style="font-size:1.4rem">${valStr}<span style="font-size:.85rem;color:var(--text2);font-weight:400">${tgtStr}</span></div>
      <div class="ws-label">${label}</div>
      ${delta ? `<div style="font-size:.8rem;margin-top:2px;color:${deltaColor}">${delta}</div>` : ''}
    </div>`;
  }

  const qBadge = (qv) => {
    if (qv == null) return '—';
    const c = qv >= 8 ? 'var(--green)' : qv >= 5 ? 'var(--yellow)' : 'var(--red)';
    return `<span style="color:${c}">${qv}/10</span>`;
  };

  const tiles = [
    tile('Durata', dur, dT, 'h', (v) => `${(+v).toFixed(1)} h`),
    `<div class="weight-stat">
      <div class="ws-value" style="font-size:1.4rem">${qBadge(q)}</div>
      <div class="ws-label">Qualità</div>
    </div>`,
  ];
  return `<div class="weight-stats">${tiles.join('')}</div>`
    + (!dT ? `<p style="font-size:.78rem;color:var(--text2);margin-top:8px">Imposta l'obiettivo ore in <strong>Setup &gt; Impostazioni</strong> per vedere il confronto.</p>` : '');
}

function renderSleepToday() {
  const el = document.getElementById('sleep-today-summary');
  if (el) el.innerHTML = sleepTodayHtml();
}

function renderSleepHistory() {
  const el = document.getElementById('sleep-history');
  if (!el) return;
  if (!_sleep.length) {
    el.innerHTML = '<p style="font-size:.85rem;color:var(--text2)">Nessun log sonno salvato.</p>';
    return;
  }
  const rows = [..._sleep].reverse().slice(0, 30);
  const head = '<tr><th>Data</th><th>Durata</th><th>Qualità</th><th></th></tr>';
  const body = rows.map((r) => `<tr>
    <td>${fmtDateShort(r.date)}</td>
    <td>${r.durationHours != null ? (+r.durationHours).toFixed(1) + ' h' : '—'}</td>
    <td>${r.quality != null ? r.quality + '/10' : '—'}</td>
    <td><button class="btn-icon" data-slp-del="${r.id}" title="Elimina">✕</button></td>
  </tr>`).join('');
  el.innerHTML = `<div style="overflow-x:auto"><table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
    <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">${head}</thead>
    <tbody>${body}</tbody>
  </table></div>`;
  el.querySelectorAll('[data-slp-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteSleep(btn.dataset.slpDel));
  });
}

export async function saveSleepLog() {
  const date = document.getElementById('slp-date').value || todayStr();
  const dur = document.getElementById('slp-duration').value;
  const qua = document.getElementById('slp-quality').value;
  const notes = document.getElementById('slp-notes').value;

  if (!dur && !qua) {
    toastMsg('Inserisci almeno durata o qualità', 'error');
    return;
  }
  const payload = { date };
  if (dur !== '') payload.durationHours = parseFloat(dur);
  if (qua !== '') payload.quality = parseInt(qua, 10);
  if (notes) payload.notes = notes;

  try {
    const saved = await api.post('/api/sleep', payload);
    const idx = _sleep.findIndex((m) => m.date === saved.date);
    if (idx >= 0) _sleep[idx] = saved;
    else _sleep.push(saved);
    _sleep.sort((a, b) => new Date(a.date) - new Date(b.date));
    toastMsg('Log sonno salvato', 'success');
    document.getElementById('slp-duration').value = '';
    document.getElementById('slp-quality').value = '';
    document.getElementById('slp-notes').value = '';
    renderSleepToday();
    renderSleepHistory();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

async function deleteSleep(id) {
  if (!confirm('Eliminare questo log?')) return;
  try {
    await api.del('/api/sleep/' + id);
    _sleep = _sleep.filter((r) => r.id !== id);
    toastMsg('Log eliminato', 'success');
    renderSleepToday();
    renderSleepHistory();
  } catch (e) {
    toastMsg('Errore: ' + (e.message || ''), 'error');
  }
}

// ---------- PUBLIC ENTRY ----------
export function renderRecoveryPage({ settings, toast: toastFn } = {}) {
  if (settings) _settings = settings;
  if (toastFn) window.__tsToast = toastFn;
  const today = todayStr();
  const nutDate = document.getElementById('nut-date');
  if (nutDate && !nutDate.value) nutDate.value = today;
  const slpDate = document.getElementById('slp-date');
  if (slpDate && !slpDate.value) slpDate.value = today;
  renderNutritionToday();
  renderNutritionHistory();
  renderSleepToday();
  renderSleepHistory();
}
