import { useState, useRef, useEffect } from 'preact/hooks';
import { Card } from '@/components/layout';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { todayStr, daysBetween } from '@/lib/utils';
import { workouts as workoutsSig } from '@/store/workouts';
import { following, loadFollowing, followUser, unfollowUser } from '@/store/following';

// Statistiche "io" per il confronto (port di renderFriendsPageLocal/_friendsMyStats).
function myStats(ws: any[]) {
  const now = todayStr();
  const l7 = ws.filter((w) => daysBetween(now, w.date) <= 7);
  return {
    avgScore: ws.length ? ws.reduce((s, w) => s + (w.scores?.overall || 0), 0) / ws.length : 0,
    weekWorkouts: l7.length,
    weekKm: l7.filter((w) => w.type === 'running').reduce((s, w) => s + (w.distance || 0), 0),
    weekTonnage: l7.filter((w) => w.type === 'gym').reduce((s, w) => s + (w._tonnage || 0), 0),
    totalWorkouts: ws.length,
  };
}

const COMPARE_COLORS = ['var(--race)', 'var(--green)', 'var(--cyan)', 'var(--yellow)', 'var(--orange)'];

export function FriendsTab() {
  useEffect(() => { loadFollowing(); }, []);
  const followMap = following.value;
  const followList = Object.values(followMap) as any[];
  const ws = workoutsSig.value;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uidInput, setUidInput] = useState('');
  const [uidMsg, setUidMsg] = useState<{ text: string; color: string } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [compareRows, setCompareRows] = useState<any[] | null>(null);
  const searchTimer = useRef<any>(null);

  function onSearch(q: string) {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q || q.length < 2) { setResults(null); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setResults(await api.get('/api/users/search?q=' + encodeURIComponent(q))); }
      catch (_) { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }

  async function toggleFollow(u: any) {
    try {
      if (followMap[u.uid]) await unfollowUser(u.uid);
      else await followUser({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL });
    } catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  async function addByUid() {
    if (!uidInput) { toast('Inserisci un UID!', 'error'); return; }
    setUidMsg({ text: 'Verifica in corso...', color: 'var(--text2)' });
    try {
      await followUser({ uid: uidInput });
      setUidMsg({ text: 'Utente aggiunto!', color: 'var(--green)' });
      toast('Amico aggiunto!', 'success');
      setUidInput('');
    } catch (e: any) {
      setUidMsg({ text: e?.data?.message || e?.message || 'Utente non trovato', color: 'var(--red)' });
    }
  }

  function toggleCheck(uid: string) {
    setChecked((prev) => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  }

  async function compare() {
    if (!checked.size) { toast('Seleziona almeno una persona!', 'error'); return; }
    setCompareRows(null);
    const friends: any[] = [];
    for (const uid of checked) {
      const name = followMap[uid]?.displayName || 'Utente';
      try { friends.push({ uid, name, stats: await api.get('/api/users/' + uid + '/stats') }); }
      catch (_) { friends.push({ uid, name, stats: null }); }
    }
    const valid = friends.filter((f) => f.stats);
    if (!valid.length) { setCompareRows([]); return; }
    const mine = myStats(ws);
    const metrics = [
      { label: 'Score Medio', key: 'avgScore', myVal: mine.avgScore, unit: '' },
      { label: 'Allenamenti/Sett', key: 'weekWorkouts', myVal: mine.weekWorkouts, unit: '' },
      { label: 'Km Corsa/Sett', key: 'weekKm', myVal: mine.weekKm, unit: ' km' },
      { label: 'Tonnellaggio/Sett', key: 'weekTonnage', myVal: mine.weekTonnage, unit: ' kg' },
      { label: 'Totale Allenamenti', key: 'totalWorkouts', myVal: mine.totalWorkouts, unit: '' },
    ];
    setCompareRows(metrics.map((m) => {
      const all = [m.myVal, ...valid.map((f) => f.stats[m.key] || 0)];
      const max = Math.max(...all, 1);
      const bars = [{ label: 'Tu', val: m.myVal, color: COMPARE_COLORS[0] },
        ...valid.map((f, i) => ({ label: f.name.split(' ')[0], val: f.stats[m.key] || 0, color: COMPARE_COLORS[(i + 1) % COMPARE_COLORS.length] }))];
      return { ...m, max, bars };
    }));
  }

  return (
    <>
      <Card>
        <div class="card-title">Cerca Persone</div>
        <div class="search-box">
          <input type="text" placeholder="Cerca per nome..." value={query} onInput={(e: any) => onSearch(e.target.value)} />
          {results !== null && (
            <div class="search-results show">
              {searching && <div style="padding:14px;color:var(--text2);font-size:.85rem">Ricerca...</div>}
              {!searching && !results.length && <div style="padding:14px;color:var(--text2);font-size:.85rem">Nessun utente trovato. Usa il campo UID qui sotto.</div>}
              {!searching && results.map((u) => (
                <div class="search-result-item" key={u.uid}>
                  <img src={u.photoURL || ''} alt="" onError={(e: any) => { e.target.style.display = 'none'; }} />
                  <div style="flex:1"><strong>{u.displayName || 'Utente'}</strong></div>
                  <button class={`btn-follow${followMap[u.uid] ? ' following' : ''}`} onClick={() => toggleFollow(u)}>
                    {followMap[u.uid] ? 'Segui già' : 'Segui'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
          <p style="font-size:.78rem;color:var(--text2);margin-bottom:8px">Oppure aggiungi direttamente con l'UID (lo trovi nel profilo dell'amico):</p>
          <div style="display:flex;gap:8px">
            <input type="text" placeholder="Incolla UID amico..." style="flex:1;font-size:.85rem" value={uidInput} onInput={(e: any) => setUidInput(e.target.value)} />
            <button class="btn btn-primary btn-sm" onClick={addByUid}>Aggiungi</button>
          </div>
          {uidMsg && <div style="margin-top:8px"><p style={{ fontSize: '.82rem', color: uidMsg.color }}>{uidMsg.text}</p></div>}
        </div>
      </Card>

      <Card>
        <div class="card-title">Persone che segui</div>
        {!followList.length ? (
          <p style="color:var(--text2);font-size:.85rem">Non segui nessuno. Cerca persone qui sopra!</p>
        ) : followList.map((f) => (
          <div class="friend-card" key={f.uid}>
            <img class="friend-avatar" src={f.photoURL || ''} alt="" onError={(e: any) => { e.target.style.display = 'none'; }} />
            <div class="friend-info"><h4>{f.displayName || 'Utente'}</h4><p>Seguito</p></div>
            <button class="btn-follow following" onClick={() => unfollowUser(f.uid).catch(() => toast('Errore', 'error'))}>Non seguire</button>
          </div>
        ))}
      </Card>

      <Card>
        <div class="card-title">Confronto</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Seleziona le persone che segui per confrontare le statistiche.</p>
        <div style="margin-bottom:12px">
          {followList.map((f) => (
            <label key={f.uid} style="display:inline-flex;align-items:center;gap:6px;margin:4px 8px 4px 0;font-size:.85rem;cursor:pointer">
              <input type="checkbox" class="import-checkbox" checked={checked.has(f.uid)} onChange={() => toggleCheck(f.uid)} /> {f.displayName || 'Utente'}
            </label>
          ))}
        </div>
        <button class="btn btn-primary btn-sm" onClick={compare}>Confronta Selezionati</button>
        {compareRows !== null && (
          <div class="compare-section">
            {!compareRows.length ? (
              <p style="color:var(--red);font-size:.85rem">Nessun dato disponibile.</p>
            ) : (
              <div class="compare-grid">
                {compareRows.map((m) => (
                  <div class="compare-card" key={m.label}>
                    <h4>{m.label}</h4>
                    {m.bars.map((b: any, i: number) => (
                      <div class="compare-bar" key={i}>
                        <span class="compare-bar-label" style={{ color: b.color }}>{b.label}</span>
                        <div class="compare-bar-track"><div class="compare-bar-fill" style={{ width: (b.val / m.max) * 100 + '%', background: b.color }} /></div>
                        <span class="compare-value">{Number(b.val).toFixed(1)}{m.unit}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
