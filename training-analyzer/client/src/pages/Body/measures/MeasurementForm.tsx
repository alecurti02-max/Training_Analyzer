import { useState } from 'preact/hooks';
import { todayStr } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { latestMeasurement, saveMeasurement } from '@/store/measurements';
import { FIELDS } from '../logic/measurementsConfig';

// Form "Misurazione completa" (port di bodyMeasurements.renderLogForm): tutti i
// campi FIELDS divisi in Circonferenze/Composizione; prefill dall'ultima misura;
// salva su /api/body-measurements (upsert per data) + sync in settings.
export function MeasurementForm() {
  const last: any = latestMeasurement();
  const [date, setDate] = useState(todayStr());
  // valori controllati per ogni campo, prefill dall'ultima misurazione
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = last[f.key] == null ? '' : String(last[f.key]);
    return init;
  });

  const setField = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  async function save() {
    const payload: Record<string, any> = { date: date || todayStr() };
    let hasAny = false;
    for (const f of FIELDS) {
      const raw = vals[f.key];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) { payload[f.key] = n; hasAny = true; }
    }
    if (!hasAny) { toast('Inserisci almeno un valore', 'error'); return; }
    try { await saveMeasurement(payload as any); toast('Misurazione salvata', 'success'); }
    catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  const group = (g: 'circ' | 'comp') => FIELDS.filter((f) => f.group === g).map((f) => (
    <div class="form-group" key={f.key}>
      <label>{f.label} ({f.unit})</label>
      <input type="number" step="0.1" min="0" placeholder={f.unit} value={vals[f.key]} onInput={(e: any) => setField(f.key, e.target.value)} />
    </div>
  ));

  return (
    <div>
      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group"><label>Data</label><input type="date" value={date} onInput={(e: any) => setDate(e.target.value)} /></div>
        <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" onClick={save}>Salva misurazione</button></div>
      </div>
      <details class="bm-section" open>
        <summary style="cursor:pointer;font-weight:700;margin:8px 0">Circonferenze (cm)</summary>
        <div class="form-row" style="flex-wrap:wrap">{group('circ')}</div>
      </details>
      <details class="bm-section">
        <summary style="cursor:pointer;font-weight:700;margin:8px 0">Composizione corporea</summary>
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Tipicamente da bilancia impedenziometrica. Lascia vuoto ciò che non misuri.</p>
        <div class="form-row" style="flex-wrap:wrap">{group('comp')}</div>
      </details>
      <p style="font-size:.75rem;color:var(--text2);margin-top:6px">Se esiste già una misurazione per la data scelta, verrà aggiornata.</p>
    </div>
  );
}
