import { useState } from 'preact/hooks';
import { todayStr } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Card } from '@/components/layout';
import { weights as weightsSig, addWeightEntry } from '@/store/weights';
import { settings as settingsSig, patchSettings } from '@/store/settings';
import { BmiBanner } from './BmiBanner';
import { SummaryTiles } from './SummaryTiles';
import { MeasurementForm } from './MeasurementForm';

// Tab "Peso" (quicklog): panoramica (riepilogo + BMI), registrazione peso/
// misurazione completa, obiettivo e altezza. Port del flusso ui.js::renderWeightPage.
export function WeightTab() {
  const ws = weightsSig.value;
  const s = settingsSig.value || {};
  const latest = ws.length ? ws[ws.length - 1] : null;

  const [date, setDate] = useState(todayStr());
  const [value, setValue] = useState('');
  const [logTab, setLogTab] = useState<'weight' | 'full'>('weight');

  async function saveWeight() {
    const v = parseFloat(value);
    if (!v) { toast('Inserisci il peso!', 'error'); return; }
    try { await addWeightEntry(date || todayStr(), v); setValue(''); toast('Peso registrato!', 'success'); }
    catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  // Obiettivo/altezza: patch parziale di settings al blur (change), come il legacy.
  async function saveTarget(raw: string) {
    const v = parseFloat(raw);
    if (v) { try { await patchSettings({ weightTarget: v }); } catch (_) { /* */ } }
  }
  async function saveHeight(raw: string) {
    const v = parseInt(raw, 10);
    if (v) { try { await patchSettings({ height: v }); } catch (_) { /* */ } }
  }

  return (
    <>
      <Card>
        <div class="card-title">Panoramica</div>
        <SummaryTiles />
        <div style="margin-top:12px"><BmiBanner latestWeight={latest?.value} height={s.height} /></div>
      </Card>

      <Card>
        <div class="card-title">Registra</div>
        <div class="bm-log-tabs" style="display:flex;gap:6px;margin-bottom:12px">
          <button class={`bm-tab${logTab === 'weight' ? ' active' : ''}`} onClick={() => setLogTab('weight')}>Peso</button>
          <button class={`bm-tab${logTab === 'full' ? ' active' : ''}`} onClick={() => setLogTab('full')}>Misurazione completa</button>
        </div>
        {logTab === 'weight' ? (
          <div class="weight-form">
            <div class="form-group"><label>Data</label><input type="date" value={date} onInput={(e: any) => setDate(e.target.value)} /></div>
            <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" placeholder="75.0" style="font-size:1.1rem" value={value} onInput={(e: any) => setValue(e.target.value)} /></div>
            <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" onClick={saveWeight}>Salva</button></div>
          </div>
        ) : (
          <MeasurementForm />
        )}
      </Card>

      <Card>
        <div class="card-title">Obiettivo e altezza</div>
        <div class="form-row">
          <div class="form-group"><label>Peso Target (kg)</label><input type="number" step="0.1" placeholder="70.0" value={s.weightTarget ?? ''} onChange={(e: any) => saveTarget(e.target.value)} /></div>
          <div class="form-group"><label>Altezza (cm) per BMI</label><input type="number" placeholder="175" value={s.height ?? ''} onChange={(e: any) => saveHeight(e.target.value)} /></div>
        </div>
      </Card>
    </>
  );
}
