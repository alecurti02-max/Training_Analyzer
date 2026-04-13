// ==================== FRIENDS MODULE ====================
// Social features: search users, follow/unfollow, compare stats.
// All Firebase refs replaced with API calls.

import { api } from './api.js';

// ==================== LOCAL HELPERS ====================
function toast(msg, type='') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.className = 'toast', 3000);
}

function formatDate(d) { return new Date(d).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}); }
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysBetween(d1,d2) { return Math.abs(Math.floor((new Date(d1)-new Date(d2))/86400000)); }

export function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return Math.floor(diff/60) + ' min';
  if (diff < 86400) return Math.floor(diff/3600) + ' h';
  return Math.floor(diff/86400) + ' gg';
}

// ==================== SEARCH ====================
let _searchTimeout = null;

export function searchUsers(query) {
  const resultsEl = document.getElementById('friend-search-results');
  if (!resultsEl) return;
  if (!query || query.length < 2) { resultsEl.className = 'search-results'; resultsEl.innerHTML = ''; return; }

  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(async () => {
    resultsEl.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:.85rem">Ricerca...</div>';
    resultsEl.className = 'search-results show';

    try {
      const results = await api.get('/api/users/search?q=' + encodeURIComponent(query));
      if (results && results.length) {
        renderSearchResults(results);
      } else {
        resultsEl.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:.85rem">Nessun utente trovato. Usa il campo UID qui sotto per aggiungere un amico direttamente.</div>';
        resultsEl.className = 'search-results show';
      }
    } catch (err) {
      resultsEl.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:.85rem">Errore nella ricerca.</div>';
      resultsEl.className = 'search-results show';
    }
  }, 300);
}

export function renderSearchResults(results, followingCache, callbacks) {
  const resultsEl = document.getElementById('friend-search-results');
  if (!resultsEl) return;
  // Use passed followingCache or try to read from window state
  const following = followingCache || window._friendsFollowingCache || {};

  resultsEl.innerHTML = results.map(u => {
    const isFollowing = following[u.uid];
    return `<div class="search-result-item">
      <img src="${u.photoURL||''}" alt="" onerror="this.style.display='none'">
      <div style="flex:1"><strong>${u.displayName||'Utente'}</strong></div>
      <button class="btn-follow ${isFollowing?'following':''}" data-follow-uid="${u.uid}" data-follow-name="${(u.displayName||'').replace(/"/g,'&quot;')}" data-follow-photo="${u.photoURL||''}">
        ${isFollowing ? 'Segui gia' : 'Segui'}
      </button>
    </div>`;
  }).join('');
  resultsEl.className = 'search-results show';

  // Bind follow buttons
  resultsEl.querySelectorAll('[data-follow-uid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.followUid;
      const isCurrentlyFollowing = following[uid];
      await toggleFollow(uid, isCurrentlyFollowing);
      if (callbacks?.onFollowChanged) callbacks.onFollowChanged();
    });
  });
}

// ==================== FOLLOW/UNFOLLOW ====================
export async function addFriendByUID(uidValue) {
  if (!uidValue) { toast('Inserisci un UID!', 'error'); return null; }

  const resultEl = document.getElementById('uid-add-result');
  if(resultEl) resultEl.innerHTML = '<p style="font-size:.82rem;color:var(--text2)">Verifica in corso...</p>';

  try {
    await api.post('/api/users/' + uidValue + '/follow');
    if(resultEl) resultEl.innerHTML = '<p style="font-size:.82rem;color:var(--green)">Utente aggiunto!</p>';
    toast('Amico aggiunto!', 'success');
    return true;
  } catch (err) {
    const msg = err.data?.message || err.message || 'Utente non trovato';
    if(resultEl) resultEl.innerHTML = `<p style="font-size:.82rem;color:var(--red)">${msg}</p>`;
    return false;
  }
}

export async function toggleFollow(uid, isFollowing) {
  try {
    if (isFollowing) {
      await api.del('/api/users/' + uid + '/follow');
    } else {
      await api.post('/api/users/' + uid + '/follow');
    }
  } catch (err) {
    toast('Errore: ' + (err.message || 'Operazione fallita'), 'error');
  }
}

// ==================== RENDER ====================
export function renderFriendsPage(state) {
  const { followingCache, workoutsCache, currentUser } = state;
  // Store followingCache for search results access
  window._friendsFollowingCache = followingCache;
  renderFollowingList(Object.values(followingCache || {}));
  renderCompareCheckboxes(Object.values(followingCache || {}));
}

export function renderFollowingList(followingList) {
  const el = document.getElementById('following-list');
  if (!el) return;
  if (!followingList.length) { el.innerHTML = '<p style="color:var(--text2);font-size:.85rem">Non segui nessuno. Cerca persone qui sopra!</p>'; return; }
  el.innerHTML = followingList.map(f =>
    `<div class="friend-card">
      <img class="friend-avatar" src="${f.photoURL||''}" alt="" onerror="this.style.display='none'">
      <div class="friend-info"><h4>${f.displayName||'Utente'}</h4><p>Seguito</p></div>
      <button class="btn-follow following" data-unfollow-uid="${f.uid}" data-unfollow-name="${(f.displayName||'').replace(/"/g,'&quot;')}" data-unfollow-photo="${f.photoURL||''}">Non seguire</button>
    </div>`
  ).join('');

  // Bind unfollow buttons
  el.querySelectorAll('[data-unfollow-uid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await toggleFollow(btn.dataset.unfollowUid, true);
    });
  });
}

export function renderCompareCheckboxes(followingList) {
  const el = document.getElementById('compare-checkboxes');
  if (!el) return;
  if (!followingList.length) { el.innerHTML = ''; return; }
  el.innerHTML = followingList.map(f =>
    `<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 8px 4px 0;font-size:.85rem;cursor:pointer">
      <input type="checkbox" class="import-checkbox compare-check" value="${f.uid}" data-name="${f.displayName||'Utente'}"> ${f.displayName||'Utente'}
    </label>`
  ).join('');
}

export async function compareSelected(followingList) {
  const checked = document.querySelectorAll('.compare-check:checked');
  if (!checked.length) { toast('Seleziona almeno una persona!', 'error'); return; }
  const resultEl = document.getElementById('friend-compare-result');
  if (!resultEl) return;
  resultEl.innerHTML = '<p style="color:var(--text2);font-size:.85rem">Caricamento...</p>';

  try {
    const friends = [];
    for (const cb of checked) {
      try {
        const stats = await api.get('/api/users/' + cb.value + '/stats');
        friends.push({ uid: cb.value, name: cb.dataset.name, stats });
      } catch (err) {
        friends.push({ uid: cb.value, name: cb.dataset.name, stats: null });
      }
    }

    const validFriends = friends.filter(f => f.stats);
    if (!validFriends.length) { resultEl.innerHTML = '<p style="color:var(--red);font-size:.85rem">Nessun dato disponibile.</p>'; return; }

    // My stats come from the state passed via window or arguments
    const myStats = window._friendsMyStats || {};
    const myAvg = myStats.avgScore || 0;
    const myL7Count = myStats.weekWorkouts || 0;
    const myKm = myStats.weekKm || 0;
    const myTon = myStats.weekTonnage || 0;
    const myTotal = myStats.totalWorkouts || 0;

    const colors = ['var(--accent)', 'var(--green)', 'var(--blue)', '#fdcb6e', '#e17055'];
    const metrics = [
      { label: 'Score Medio', myVal: myAvg, key: 'avgScore', unit: '' },
      { label: 'Allenamenti/Sett', myVal: myL7Count, key: 'weekWorkouts', unit: '' },
      { label: 'Km Corsa/Sett', myVal: myKm, key: 'weekKm', unit: ' km' },
      { label: 'Tonnellaggio/Sett', myVal: myTon, key: 'weekTonnage', unit: ' kg' },
      { label: 'Totale Allenamenti', myVal: myTotal, key: 'totalWorkouts', unit: '' }
    ];

    let html = '<div class="compare-grid">';
    metrics.forEach(m => {
      const allVals = [m.myVal, ...validFriends.map(f => f.stats[m.key] || 0)];
      const maxVal = Math.max(...allVals, 1);
      html += `<div class="compare-card"><h4>${m.label}</h4>`;
      html += `<div class="compare-bar"><span class="compare-bar-label" style="color:${colors[0]}">Tu</span><div class="compare-bar-track"><div class="compare-bar-fill" style="width:${(m.myVal/maxVal)*100}%;background:${colors[0]}"></div></div><span class="compare-value">${Number(m.myVal).toFixed(1)}${m.unit}</span></div>`;
      validFriends.forEach((f, i) => {
        const val = f.stats[m.key] || 0;
        html += `<div class="compare-bar"><span class="compare-bar-label" style="color:${colors[(i+1)%colors.length]}">${f.name.split(' ')[0]}</span><div class="compare-bar-track"><div class="compare-bar-fill" style="width:${(val/maxVal)*100}%;background:${colors[(i+1)%colors.length]}"></div></div><span class="compare-value">${Number(val).toFixed(1)}${m.unit}</span></div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    resultEl.innerHTML = html;
  } catch (err) {
    resultEl.innerHTML = '<p style="color:var(--red);font-size:.85rem">Errore nel confronto.</p>';
  }
}
