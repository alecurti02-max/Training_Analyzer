import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { PageShell } from '@/components/layout';
import { loadMeasurements } from '@/store/measurements';
import { WeightTab } from './measures/WeightTab';
import { MeasuresTab } from './measures/MeasuresTab';
import { TrendTab } from './measures/TrendTab';
import { NutritionTab } from './recovery/NutritionTab';
import { SleepTab } from './recovery/SleepTab';

// Corpo — route .tsx AUTONOMA (M3 Body completo): 5 tab Preact (Peso, Misure,
// Alimentazione, Sonno, Andamenti). Niente più dipendenze da bodyMeasurements.js
// / recovery.js / ui.js::renderWeightPage. Stato dai signal store (reattivo).
const TABS = [
  { key: 'quicklog', label: 'Peso' },
  { key: 'measures', label: 'Misure' },
  { key: 'nutrition', label: 'Alimentazione' },
  { key: 'sleep', label: 'Sonno' },
  { key: 'trend', label: 'Andamenti' },
];

export function BodyPage() {
  const [tab, setTab] = useState('quicklog');
  useEffect(() => { loadMeasurements(); }, []);

  return (
    <PageShell eyebrow="04 · CORPO" title="Corpo">
      <div class="lay-tabbar">
        {TABS.map((t) => (
          <button key={t.key} class={`bm-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'quicklog' && <WeightTab />}
      {tab === 'measures' && <MeasuresTab />}
      {tab === 'nutrition' && <NutritionTab />}
      {tab === 'sleep' && <SleepTab />}
      {tab === 'trend' && <TrendTab />}
    </PageShell>
  );
}

// Mount self-contained (registry router): host in #page-body, nasconde markup
// legacy fratello, render. Registrato in main.jsx.
export function mountBodyPage(): void {
  const pageEl = document.getElementById('page-body');
  if (!pageEl) return;
  let host = document.getElementById('body-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'body-host';
    pageEl.appendChild(host);
  }
  Array.from(pageEl.children).forEach((c) => { (c as HTMLElement).style.display = c === host ? '' : 'none'; });
  render(<BodyPage />, host);
}

export function unmountBodyPage(): void {
  const el = document.getElementById('body-host');
  if (el) render(null, el);
}
