import { Card } from '@/components/layout';
import { settings as settingsSig, patchSettings } from '@/store/settings';
import { FIELDS } from '../logic/measurementsConfig';

// Tab "Misure": snapshot composizione in Settings (fonte parallela alle
// BodyMeasurement per-data). Input controllati dal signal settings; salvataggio
// per-campo via patchSettings al change (niente full-object footgun del legacy).
export function MeasuresTab() {
  const s = settingsSig.value || {};

  async function onField(key: string, raw: string) {
    const v = raw === '' ? null : parseFloat(raw);
    try { await patchSettings({ [key]: Number.isFinite(v as number) ? v : null }); } catch (_) { /* */ }
  }

  const inputs = (group: 'circ' | 'comp') => FIELDS.filter((f) => f.group === group).map((f) => (
    <div class="form-group" key={f.key}>
      <label>{f.label} ({f.unit})</label>
      <input type="number" step="0.1" min="0" placeholder={f.unit}
        value={s[f.key] ?? ''} onChange={(e: any) => onField(f.key, e.target.value)} />
    </div>
  ));

  return (
    <>
      <Card>
        <div class="card-title">Circonferenze Corporee (cm)</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Misurazioni per il profilo atletico e il monitoraggio della composizione corporea.</p>
        <div class="form-row" style="flex-wrap:wrap">{inputs('circ')}</div>
      </Card>
      <Card>
        <div class="card-title">Composizione Corporea (opzionale)</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Valori tipicamente forniti da bilance impedenziometriche. Compila solo i campi che puoi misurare.</p>
        <div class="form-row" style="flex-wrap:wrap">{inputs('comp')}</div>
      </Card>
    </>
  );
}
