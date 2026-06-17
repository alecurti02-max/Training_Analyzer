import { useState, useEffect } from 'preact/hooks';
import { todayStr } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { settings as settingsSig } from '@/store/settings';
import { sleep, loadSleep, saveSleep, deleteSleep } from '@/store/sleep';

function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function SleepTab() {
  useEffect(() => { loadSleep(); }, []);
  const list = sleep.value;
  const s = settingsSig.value || {};
  const today = todayStr();
  const rec = list.find((r) => r.date === today);

  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState('');
  const [quality, setQuality] = useState('');
  const [notes, setNotes] = useState('');

  const dur = rec?.durationHours;
  const dT = s.sleepHoursTarget;
  let durDelta = null;
  let durColor = 'var(--text2)';
  if (dur != null && dT) {
    const d = dur - dT;
    if (Math.abs(d) <= 0.5) durColor = 'var(--green)';
    else if (Math.abs(d) <= 1.0) durColor = 'var(--yellow)';
    else durColor = 'var(--red)';
    durDelta = `Δ ${d > 0 ? '+' : ''}${(+d).toFixed(1)} h`;
  }
  const q = rec?.quality;
  const qColor = q == null ? 'var(--text2)' : q >= 8 ? 'var(--green)' : q >= 5 ? 'var(--yellow)' : 'var(--red)';

  async function save() {
    if (!duration && !quality) { toast('Inserisci almeno durata o qualità', 'error'); return; }
    const payload: any = { date: date || today };
    if (duration !== '') payload.durationHours = parseFloat(duration);
    if (quality !== '') payload.quality = parseInt(quality, 10);
    if (notes) payload.notes = notes;
    try {
      await saveSleep(payload);
      toast('Log sonno salvato', 'success');
      setDuration(''); setQuality(''); setNotes('');
    } catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  async function del(id: string) {
    if (!confirm('Eliminare questo log?')) return;
    try { await deleteSleep(id); toast('Log eliminato', 'success'); }
    catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  const rows = [...list].reverse().slice(0, 30);

  return (
    <>
      <div class="card cc-hud">
        <div class="card-title">Stanotte</div>
        <div class="weight-stats">
          <div class="weight-stat">
            <div class="ws-value" style="font-size:1.4rem">
              {dur == null ? '—' : `${(+dur).toFixed(1)} h`}
              {dT ? <span style="font-size:.85rem;color:var(--text2);font-weight:400"> / {dT} h</span> : null}
            </div>
            <div class="ws-label">Durata</div>
            {durDelta && <div style={{ fontSize: '.8rem', marginTop: 2, color: durColor }}>{durDelta}</div>}
          </div>
          <div class="weight-stat">
            <div class="ws-value" style="font-size:1.4rem">{q == null ? '—' : <span style={{ color: qColor }}>{q}/10</span>}</div>
            <div class="ws-label">Qualità</div>
          </div>
        </div>
        {!dT && (
          <p style="font-size:.78rem;color:var(--text2);margin-top:8px">Imposta l'obiettivo ore in <strong>Setup &gt; Impostazioni</strong> per vedere il confronto.</p>
        )}
      </div>

      <div class="card">
        <div class="card-title">Registra notte</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">La data si riferisce al <strong>giorno del risveglio</strong>. Se esiste già un record per la data, viene aggiornato.</p>
        <div class="form-row">
          <div class="form-group"><label>Data</label><input type="date" value={date} onInput={(e: any) => setDate(e.target.value)} /></div>
          <div class="form-group"><label>Durata (ore)</label><input type="number" min="0" max="24" step="0.25" placeholder="es. 7.5" value={duration} onInput={(e: any) => setDuration(e.target.value)} /></div>
          <div class="form-group"><label>Qualità (1-10)</label><input type="number" min="1" max="10" step="1" placeholder="es. 7" value={quality} onInput={(e: any) => setQuality(e.target.value)} /></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1"><label>Note (opz.)</label><input type="text" placeholder="es. risveglio notturno, sogni vividi..." value={notes} onInput={(e: any) => setNotes(e.target.value)} /></div>
          <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" onClick={save}>Salva</button></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Storico</div>
        {!rows.length ? (
          <p style="font-size:.85rem;color:var(--text2)">Nessun log sonno salvato.</p>
        ) : (
          <div style="overflow-x:auto">
            <table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">
                <tr><th>Data</th><th>Durata</th><th>Qualità</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateShort(r.date)}</td>
                    <td>{r.durationHours != null ? (+r.durationHours).toFixed(1) + ' h' : '—'}</td>
                    <td>{r.quality != null ? r.quality + '/10' : '—'}</td>
                    <td><button class="btn-icon" title="Elimina" onClick={() => del(r.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
