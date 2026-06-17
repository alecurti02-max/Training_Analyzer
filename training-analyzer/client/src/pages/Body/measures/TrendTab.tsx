import { useState, useRef, useEffect } from 'preact/hooks';
import { Card } from '@/components/layout';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { getChartTheme } from '../../../../js/charts.js';
import { measurements, deleteMeasurement } from '@/store/measurements';
import { weights as weightsSig } from '@/store/weights';
import { settings as settingsSig } from '@/store/settings';
import {
  FIELDS, VISCERAL_ZONES, RANGE_OPTIONS, CHART_TABS, fieldByKey, fieldsInTab, filterByRange,
} from '../logic/measurementsConfig';

declare const Chart: any;

function baseLineOpts(ct: any) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: ct.textColor, font: { family: 'Inter' } } } },
    scales: { x: { ...ct, ticks: { ...ct.ticks, maxTicksLimit: 10 } }, y: ct },
  };
}

// Costruisce la config Chart.js per il tab attivo. Ritorna { config, plugins } o
// { empty: msg } se non c'è nulla da disegnare. Port di renderActiveChart.
function buildChart(tab: string, range: string, vis: Set<string>, ws: any[], ms: any[], settings: any) {
  const ct = getChartTheme();
  if (tab === 'weight') {
    const rows = filterByRange(ws, range);
    if (!rows.length) return { empty: 'Nessun dato peso nel periodo.' };
    const datasets: any[] = [{ label: 'Peso (kg)', data: rows.map((r) => r.value), borderColor: '#00E5CE', pointBackgroundColor: '#00E5CE', tension: 0.3, fill: false }];
    if (settings?.weightTarget) datasets.push({ label: 'Obiettivo', data: rows.map(() => settings.weightTarget), borderColor: '#10B981', borderDash: [10, 5], pointRadius: 0, fill: false });
    return { config: { type: 'line', data: { labels: rows.map((r) => formatDate(r.date)), datasets }, options: baseLineOpts(ct) } };
  }
  if (tab === 'visceral') {
    const rows = filterByRange(ms, range).filter((r) => r.visceralFat != null);
    if (!rows.length) return { empty: 'Nessun dato grasso viscerale nel periodo.' };
    const maxVal = Math.max(...rows.map((r) => r.visceralFat), 15);
    const zonePlugin = {
      id: 'bmZones',
      beforeDatasetsDraw(chart: any) {
        const { ctx: c, chartArea: a, scales: { y } } = chart;
        let prev = 0;
        VISCERAL_ZONES.forEach((z) => {
          const top = y.getPixelForValue(Math.min(z.max, maxVal));
          const bot = y.getPixelForValue(prev);
          c.save(); c.fillStyle = z.color; c.fillRect(a.left, top, a.right - a.left, bot - top); c.restore();
          prev = z.max;
        });
      },
    };
    const opts = baseLineOpts(ct);
    return {
      config: {
        type: 'line',
        data: { labels: rows.map((r) => formatDate(r.date)), datasets: [{ label: 'Grasso viscerale', data: rows.map((r) => r.visceralFat), borderColor: '#FF2D46', pointBackgroundColor: '#FF2D46', tension: 0.3, fill: false }] },
        options: { ...opts, scales: { ...opts.scales, y: { ...opts.scales.y, min: 0, max: maxVal } } },
      },
      plugins: [zonePlugin],
    };
  }
  if (tab === 'overview') {
    const rows = filterByRange(ms, range);
    const fields = FIELDS.filter((f) => f.overview && vis.has(f.key));
    if (!rows.length || !fields.length) return { empty: 'Seleziona almeno una metrica.' };
    const datasets = fields.map((f) => {
      const vals = rows.map((r) => r[f.key]).filter((v) => v != null);
      if (vals.length < 2) return null;
      const min = Math.min(...vals); const max = Math.max(...vals); const span = (max - min) || 1;
      return { label: f.label, data: rows.map((r) => (r[f.key] == null ? null : ((r[f.key] - min) / span) * 100)), borderColor: f.color, pointBackgroundColor: f.color, tension: 0.3, fill: false, spanGaps: true, borderWidth: 1.5 };
    }).filter(Boolean);
    if (!datasets.length) return { empty: 'Servono almeno 2 misurazioni per metrica.' };
    const opts = baseLineOpts(ct);
    return {
      config: {
        type: 'line', data: { labels: rows.map((r) => formatDate(r.date)), datasets },
        options: {
          ...opts,
          plugins: { legend: { labels: { color: ct.textColor, font: { family: 'Inter' } } }, tooltip: { callbacks: { title: (items: any) => items[0].label, label: (item: any) => item.dataset.label + ': ' + Math.round(item.raw) + ' (norm.)' } } },
          scales: { ...opts.scales, y: { ...opts.scales.y, min: 0, max: 100, ticks: { ...ct.ticks, callback: (v: any) => v + '%' } } },
        },
      },
    };
  }
  // circ / compPct / compMass
  const rows = filterByRange(ms, range);
  const fields = fieldsInTab(tab).filter((f) => vis.has(f.key));
  if (!fields.length) return { empty: 'Seleziona almeno una metrica.' };
  if (!rows.some((r) => fields.some((f) => r[f.key] != null))) return { empty: 'Nessuna misurazione nel periodo.' };
  const datasets = fields.map((f) => ({ label: f.label + ' (' + f.unit + ')', data: rows.map((r) => (r[f.key] == null ? null : r[f.key])), borderColor: f.color, pointBackgroundColor: f.color, tension: 0.3, fill: false, spanGaps: true }));
  return { config: { type: 'line', data: { labels: rows.map((r) => formatDate(r.date)), datasets }, options: baseLineOpts(ct) } };
}

function defaultVisibility(tab: string): Set<string> {
  const fields = tab === 'overview' ? FIELDS.filter((f) => f.overview) : fieldsInTab(tab);
  let set = new Set(tab === 'overview' ? fields.map((f) => f.key) : fields.filter((f) => f.overview).map((f) => f.key));
  if (set.size === 0) set = new Set(fields.map((f) => f.key));
  return set;
}

export function TrendTab() {
  const ms = measurements.value;
  const ws = weightsSig.value;
  const s = settingsSig.value || {};
  const [tab, setTab] = useState('weight');
  const [range, setRange] = useState('90d');
  const [visMap, setVisMap] = useState<Record<string, Set<string>>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  const vis = visMap[tab] || defaultVisibility(tab);
  const showControls = tab !== 'weight' && tab !== 'visceral';
  const controlFields = tab === 'overview' ? FIELDS.filter((f) => f.overview) : fieldsInTab(tab);

  const result = buildChart(tab, range, vis, ws, ms, s);

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (result.empty || !canvasRef.current) return undefined;
    // Chart.js v4: i plugin locali (zone viscerali) vanno nel campo `plugins` della config.
    const cfg = result.plugins ? { ...result.config, plugins: result.plugins } : result.config;
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), cfg);
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  });

  function toggleVis(key: string) {
    const next = new Set(vis);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisMap((p) => ({ ...p, [tab]: next }));
  }

  async function del(id: string) {
    if (!confirm('Eliminare questa misurazione?')) return;
    try { await deleteMeasurement(id); toast('Misurazione eliminata', 'success'); }
    catch (e: any) { toast('Errore: ' + (e?.message || ''), 'error'); }
  }

  const histRows = [...ms].reverse().slice(0, 20);
  const histCols = ['circWaist', 'circHips', 'bodyFat', 'skeletalMuscle', 'visceralFat'];

  return (
    <>
      <Card>
        <div class="card-title">Andamenti</div>
        <div class="bm-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          {CHART_TABS.map((t) => <button key={t.key} class={`bm-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        <div class="bm-range" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          {RANGE_OPTIONS.map((r) => <button key={r.key} class={`bm-pill${range === r.key ? ' active' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>)}
        </div>
        {showControls && (
          <div id="bm-chart-controls" style="margin-bottom:8px">
            {controlFields.map((f) => (
              <label class="bm-toggle" key={f.key}>
                <input type="checkbox" checked={vis.has(f.key)} onChange={() => toggleVis(f.key)} />
                <span class="bm-dot" style={{ background: f.color }} />
                {f.label}
              </label>
            ))}
          </div>
        )}
        <div class="chart-container" style="height:320px">
          {result.empty
            ? <div class="bm-empty" style="padding:40px;text-align:center;color:var(--text2);font-size:.9rem">{result.empty}</div>
            : <canvas ref={canvasRef} />}
        </div>
      </Card>

      <Card>
        <div class="card-title">Storico misurazioni</div>
        {!histRows.length ? (
          <p style="font-size:.85rem;color:var(--text2)">Nessuna misurazione salvata.</p>
        ) : (
          <div style="overflow-x:auto">
            <table class="bm-table" style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead style="text-align:left;color:var(--text2);border-bottom:1px solid var(--border)">
                <tr><th>Data</th>{histCols.map((k) => <th key={k}>{fieldByKey(k)!.label}</th>)}<th /></tr>
              </thead>
              <tbody>
                {histRows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    {histCols.map((k) => <td key={k}>{r[k] == null ? '—' : r[k] + ' ' + fieldByKey(k)!.unit}</td>)}
                    <td><button class="btn-icon" title="Elimina" onClick={() => del(r.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
