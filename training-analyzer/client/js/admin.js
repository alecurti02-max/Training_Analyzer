// ==================== ADMIN MODULE ====================
// Admin dashboard: global stats, user list, charts. Visible only to role==='admin'.

import { api } from './api.js';
import { destroyChart, storeChart, getChartTheme } from './charts.js';

const PAGE_SIZE = 50;
let currentPage = 1;

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function setupAdminGating(user) {
  const navAdmin = document.getElementById('nav-admin');
  if (!navAdmin) return;
  navAdmin.style.display = user && user.role === 'admin' ? '' : 'none';
}

export async function renderAdmin() {
  await Promise.all([renderStats(), renderUsers(currentPage)]);
}

async function renderStats() {
  const statsEl = document.getElementById('admin-stats');
  const providersEl = document.getElementById('admin-providers');
  if (!statsEl) return;

  let data;
  try {
    data = await api.get('/api/admin/stats');
  } catch (err) {
    statsEl.innerHTML = `<div class="card"><div style="color:var(--text2)">Accesso negato o errore: ${escapeHtml(err.message || 'errore')}</div></div>`;
    return;
  }

  const { users, workouts, signupsDaily } = data;

  statsEl.innerHTML = `
    <div class="card stat-card">
      <div class="stat-label">Utenti totali</div>
      <div class="stat-value">${users.total}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Nuovi (7gg)</div>
      <div class="stat-value">${users.last7}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Nuovi (30gg)</div>
      <div class="stat-value">${users.last30}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Workout totali</div>
      <div class="stat-value">${workouts.total}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Workout (7gg)</div>
      <div class="stat-value">${workouts.last7}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">Admin</div>
      <div class="stat-value">${users.admins}</div>
    </div>
  `;

  if (providersEl) {
    const g = users.byProvider.google || 0;
    const l = users.byProvider.local || 0;
    const tot = g + l || 1;
    providersEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:6px 0">
        <span>Google</span><span><b>${g}</b> <span style="color:var(--text2)">(${Math.round(g/tot*100)}%)</span></span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0">
        <span>Email</span><span><b>${l}</b> <span style="color:var(--text2)">(${Math.round(l/tot*100)}%)</span></span>
      </div>
    `;
  }

  renderSignupsChart(signupsDaily);
  renderSportsChart(workouts.bySport || []);
}

function renderSignupsChart(signupsDaily) {
  const canvas = document.getElementById('admin-chart-signups');
  if (!canvas || !window.Chart) return;
  destroyChart('admin-signups');

  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = Object.fromEntries((signupsDaily || []).map((r) => [r.day, r.count]));
  const data = days.map((d) => byDay[d] || 0);
  const labels = days.map((d) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));

  const theme = getChartTheme();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nuovi utenti',
        data,
        borderColor: 'rgba(224,32,32,1)',
        backgroundColor: 'rgba(224,32,32,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: theme.grid, ticks: theme.ticks },
        y: { grid: theme.grid, ticks: { ...theme.ticks, precision: 0 }, beginAtZero: true },
      },
    },
  });
  storeChart('admin-signups', chart);
}

const SPORT_COLORS = [
  'rgba(224,32,32,0.85)',
  'rgba(74,144,226,0.85)',
  'rgba(46,204,113,0.85)',
  'rgba(241,196,15,0.85)',
  'rgba(155,89,182,0.85)',
  'rgba(230,126,34,0.85)',
  'rgba(26,188,156,0.85)',
];

function renderSportsChart(bySport) {
  const canvas = document.getElementById('admin-chart-sports');
  if (!canvas || !window.Chart) return;
  destroyChart('admin-sports');
  if (!bySport.length) {
    canvas.parentElement.innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px">Nessun dato</div>';
    return;
  }

  const labels = bySport.map((r) => r.type);
  const data = bySport.map((r) => r.count);
  const colors = bySport.map((_, i) => SPORT_COLORS[i % SPORT_COLORS.length]);

  const theme = getChartTheme();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: theme.textColor, boxWidth: 12 } },
      },
    },
  });
  storeChart('admin-sports', chart);
}

async function renderUsers(page) {
  const tableEl = document.getElementById('admin-users-table');
  const pagerEl = document.getElementById('admin-users-pager');
  if (!tableEl) return;

  let data;
  try {
    data = await api.get(`/api/admin/users?page=${page}&limit=${PAGE_SIZE}`);
  } catch (err) {
    tableEl.innerHTML = `<div style="color:var(--text2)">Errore caricamento: ${escapeHtml(err.message || '')}</div>`;
    return;
  }

  const { users, total } = data;
  if (!users.length) {
    tableEl.innerHTML = '<div style="color:var(--text2);padding:12px">Nessun utente</div>';
    pagerEl.innerHTML = '';
    return;
  }

  const rows = users.map((u) => {
    const name = (u.firstName || u.lastName)
      ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
      : (u.displayName || '—');
    const isAdmin = u.role === 'admin';
    const badge = isAdmin
      ? '<span style="background:rgba(224,32,32,0.15);color:var(--accent);padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700">ADMIN</span>'
      : '';
    const provIcon = u.provider === 'google' ? 'Google' : 'Email';
    return `<tr>
      <td style="padding:8px 6px">${escapeHtml(name)} ${badge}</td>
      <td style="padding:8px 6px;color:var(--text2);font-size:.85rem">${escapeHtml(u.email)}</td>
      <td style="padding:8px 6px;font-size:.85rem">${provIcon}</td>
      <td style="padding:8px 6px;font-size:.85rem;text-align:right">${u.workoutCount}</td>
      <td style="padding:8px 6px;font-size:.85rem;color:var(--text2);text-align:right">${formatDate(u.createdAt)}</td>
    </tr>`;
  }).join('');

  tableEl.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border);font-size:.78rem;color:var(--text2);text-transform:uppercase">
            <th style="padding:8px 6px;text-align:left">Nome</th>
            <th style="padding:8px 6px;text-align:left">Email</th>
            <th style="padding:8px 6px;text-align:left">Provider</th>
            <th style="padding:8px 6px;text-align:right">Workout</th>
            <th style="padding:8px 6px;text-align:right">Registrato</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  pagerEl.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="admin-prev" ${page <= 1 ? 'disabled' : ''}>&larr; Prec</button>
    <span style="color:var(--text2);font-size:.85rem">Pagina ${page} di ${totalPages} · ${total} utenti</span>
    <button class="btn btn-secondary btn-sm" id="admin-next" ${page >= totalPages ? 'disabled' : ''}>Succ &rarr;</button>
  `;
  const prev = document.getElementById('admin-prev');
  const next = document.getElementById('admin-next');
  if (prev) prev.onclick = () => { currentPage = Math.max(1, page - 1); renderUsers(currentPage); };
  if (next) next.onclick = () => { currentPage = Math.min(totalPages, page + 1); renderUsers(currentPage); };
}
