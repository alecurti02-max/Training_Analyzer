import { useState, useEffect } from 'preact/hooks';
import { todayStr } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { settings as settingsSig } from '@/store/settings';
import { nutrition, loadNutrition, saveNutrition, deleteNutrition } from '@/store/nutrition';

function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// Tile riepilogo con confronto vs target (stesse soglie del vecchio recovery.js).
function Tile({ label, value, target, unit }: { label: string; value: number | null; target?: number | null; unit: string }) {
  const valStr = value == null ? '—' : `${Math.round(value)} ${unit}`;
  let delta = null;
  let color = 'var(--text2)';
  if (value != null && target) {
    const d = value - target;
    if (Math.abs(d) <= target * 0.05) color = 'var(--green)';
    else if (Math.abs(d) <= target * 0.15) color = 'var(--yellow)';
    else color = 'var(--red)';
    delta = `Δ ${d > 0 ? '+' : ''}${Math.round(d)} ${unit}`;
  }
  return (
    <div class="weight-stat">
      <div class="ws-value" style="font-size:1.4rem">
        {valStr}
        {target ? <span style="font-size:.85rem;color:var(--text2);font-weight:400"> / {target} {unit}</span> : null}
      </div>
      <div class="ws-label">{label}</div>
      {delta && <div style={{ fontSize: '.8rem', marginTop: 2, color }}>{delta}</div>}
    </div>
  );
}

export function NutritionTab() {
  useEffect(() => { loadNutrition(); }, []);
  const list = nutrition.value;
  const s = settingsSig.value || {};
  const today = todayStr();
  const rec = list.find((r) => r.date === today);

  const [date, setDate] = useState(today);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');

  async function save() {
    if (!calories && !protein && !carbs && !fat) { toast('Inserisci almeno un valore', 'error'); return; }
    const payload: any = { date: date || today };
    if (calories !== '') payload.calories = parseInt(calories, 10);
    if (protein !== '') payload.proteinG = parseFloat(protein);
    if (carbs !== '') payload.carbsG = parseFloat(carbs);
    if (fat !== '') payload.fatG = parseFloat(fat);
    if (notes) payload.notes = notes;
    try {
      await saveNutrition(payload);
      toast('Log alimentazione salvato', 'success');
      setCalories(''); setProtein(''); setCarbs(''); setFat(''); setNotes('');
    } catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  async function del(id: string) {
    if (!confirm('Eliminare questo log?')) return;
    try { await deleteNutrition(id); toast('Log eliminato', 'success'); }
    catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  const rows = [...list].reverse().slice(0, 30);

  return (
    <>
      <div class="card cc-hud">
        <div class="card-title">Oggi</div>
        <div class="weight-stats">
          <Tile label="Calorie" value={rec?.calories ?? null} target={s.caloriesTarget} unit="kcal" />
          <Tile label="Proteine" value={rec?.proteinG ?? null} target={s.proteinTargetG} unit="g" />
          <Tile label="Carboidrati" value={rec?.carbsG ?? null} unit="g" />
          <Tile label="Grassi" value={rec?.fatG ?? null} unit="g" />
        </div>
        {!s.caloriesTarget && !s.proteinTargetG && (
          <p style="font-size:.78rem;color:var(--text2);margin-top:8px">Imposta i target in <strong>Setup &gt; Impostazioni</strong> per vedere il confronto.</p>
        )}
      </div>

      <div class="card">
        <div class="card-title">Registra giornata</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Inserisci i totali della giornata. Se esiste già un record per la data, viene aggiornato.</p>
        <div class="form-row">
          <div class="form-group"><label>Data</label><input type="date" value={date} onInput={(e: any) => setDate(e.target.value)} /></div>
          <div class="form-group"><label>Calorie (kcal)</label><input type="number" min="0" step="1" placeholder="es. 2200" value={calories} onInput={(e: any) => setCalories(e.target.value)} /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Proteine (g)</label><input type="number" min="0" step="0.1" placeholder="es. 140" value={protein} onInput={(e: any) => setProtein(e.target.value)} /></div>
          <div class="form-group"><label>Carboidrati (g)</label><input type="number" min="0" step="0.1" placeholder="es. 250" value={carbs} onInput={(e: any) => setCarbs(e.target.value)} /></div>
          <div class="form-group"><label>Grassi (g)</label><input type="number" min="0" step="0.1" placeholder="es. 70" value={fat} onInput={(e: any) => setFat(e.target.value)} /></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1"><label>Note (opz.)</label><input type="text" placeholder="es. cena fuori, surplus weekend..." value={notes} onInput={(e: any) => setNotes(e.target.value)} /></div>
          <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" onClick={save}>Salva</button></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Storico</div>
        {!rows.length ? (
          <p style="font-size:.85rem;color:var(--text2)">Nessun log alimentazione salvato.</p>
        ) : (
          <div style="overflow-x:auto">
            <table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">
                <tr><th>Data</th><th>Calorie</th><th>P</th><th>C</th><th>G</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateShort(r.date)}</td>
                    <td>{r.calories != null ? r.calories : '—'}</td>
                    <td>{r.proteinG != null ? r.proteinG + 'g' : '—'}</td>
                    <td>{r.carbsG != null ? r.carbsG + 'g' : '—'}</td>
                    <td>{r.fatG != null ? r.fatG + 'g' : '—'}</td>
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
