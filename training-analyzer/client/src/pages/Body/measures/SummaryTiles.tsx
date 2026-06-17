import { measurements, latestMeasurement } from '@/store/measurements';
import { weights as weightsSig } from '@/store/weights';
import { settings as settingsSig } from '@/store/settings';
import { bmi, whtr, visceralBadge } from '../logic/measurementsConfig';

// Tile riepilogo Panoramica (port di bodyMeasurements.renderSummary): Peso+BMI,
// Vita+WHtR, Composizione+viscerale, ciascuna col delta vs precedente.
function deltaNode(cur?: number | null, prev?: number | null, digits = 1, unit = '') {
  if (cur == null || prev == null) return null;
  const d = +(cur - prev).toFixed(digits);
  const color = d > 0 ? 'var(--red)' : d < 0 ? 'var(--green)' : 'var(--text2)';
  return <div style={{ fontSize: '.8rem', marginTop: 2 }}><span style={{ color }}>Δ {d > 0 ? '+' + d : d} {unit}</span></div>;
}

function Tile({ label, sub, main, delta }: { label: string; sub?: string; main: string; delta: any }) {
  return (
    <div class="weight-stat">
      <div class="ws-value" style="font-size:1.4rem">{main}</div>
      <div class="ws-label">{label}{sub ? ' · ' + sub : ''}</div>
      {delta}
    </div>
  );
}

export function SummaryTiles() {
  const ms = measurements.value;
  const ws = weightsSig.value;
  const s = settingsSig.value || {};
  const last: any = latestMeasurement();
  const prev: any = ms.length > 1 ? ms[ms.length - 2] : null;
  const lastW = ws.length ? ws[ws.length - 1] : null;
  const prevW = ws.length > 1 ? ws[ws.length - 2] : null;

  return (
    <div class="weight-stats">
      <Tile
        label="Peso"
        sub={s.height ? 'BMI ' + bmi(lastW?.value, s.height) : ''}
        main={lastW ? lastW.value.toFixed(1) + ' kg' : '—'}
        delta={deltaNode(lastW?.value, prevW?.value, 1, 'kg')}
      />
      <Tile
        label="Vita"
        sub={whtr(last.circWaist, s.height)}
        main={last.circWaist != null ? last.circWaist + ' cm' : '—'}
        delta={deltaNode(last.circWaist, prev?.circWaist, 1, 'cm')}
      />
      <Tile
        label="Composizione"
        sub={last.visceralFat != null ? 'Viscerale ' + last.visceralFat + ' ' + visceralBadge(last.visceralFat) : ''}
        main={last.bodyFat != null ? last.bodyFat + '% BF' : '—'}
        delta={deltaNode(last.bodyFat, prev?.bodyFat, 1, '%')}
      />
    </div>
  );
}
