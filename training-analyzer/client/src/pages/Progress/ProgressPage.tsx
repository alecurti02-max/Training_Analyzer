import { render } from 'preact';
import { PageShell, Card } from '@/components/layout';

// Progressi — route .tsx (WRAP). Rende lo scheletro (tab Generali/Atletica +
// card con TUTTI i canvas/container che charts.js, bodyAvatar.js e i mount
// Preact athletic si aspettano). La logica legacy (ui.js::renderProgress /
// renderAthleticDetail) resta invariata e popola gli id dopo il mount.
// Tab via delega data-tab-group di ui.js. Look 1:1.
export function ProgressPage() {
  return (
    <PageShell eyebrow="04 · PROGRESSI" title="Progressi">
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="bm-tab active" data-tab-group="progress" data-tab="general">Generali</button>
        <button class="bm-tab" data-tab-group="progress" data-tab="athletic">Atletica</button>
      </div>

      <div data-tab-content="general">
        <Card><div class="card-title">Andamento Score</div><div class="chart-container"><canvas id="chart-scores" /></div></Card>
        <div class="card-grid">
          <Card><div class="card-title">Volume Palestra (tonnellaggio)</div><div class="chart-container"><canvas id="chart-gym-volume" /></div></Card>
          <Card><div class="card-title">Pace Corsa ponderato (min/km)</div><div class="chart-container"><canvas id="chart-run-pace" /></div></Card>
        </div>
        <Card><div class="card-title">1RM Stimato (Epley)</div><div id="orm-select-container" style="margin-bottom:8px" /><div class="chart-container"><canvas id="chart-1rm" /></div></Card>
        <Card><div class="card-title">Heart Rate Zones (Corse)</div><div id="hr-zones-container" /></Card>
        <Card><div class="card-title">Distribuzione Gruppi Muscolari (ultime 4 sett.)</div><div class="chart-container"><canvas id="chart-muscles" /></div></Card>
        <Card><div class="card-title">Frequenza Allenamenti per Settimana</div><div class="chart-container"><canvas id="chart-frequency" /></div></Card>
      </div>

      <div data-tab-content="athletic" style="display:none">
        <Card>
          <div class="card-title">Il tuo corpo</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Silhouette interattiva basata sulle tue misure. Clicca su una parte per i dettagli.</p>
          <div id="body-avatar-container" />
        </Card>
        <Card>
          <div class="card-title">Radar ultimi 30 giorni</div>
          <div class="chart-container" style="height:300px"><canvas id="chart-radar-detail" /></div>
        </Card>
        <div class="card-grid" id="athletic-detail-cards" />
        <Card>
          <div class="card-title">Valutazione Forma Fisica</div>
          <div id="athletic-fitness-assessment" />
        </Card>
      </div>
    </PageShell>
  );
}

export function mountProgress({ host }: { host: HTMLElement }) {
  if (host) render(<ProgressPage />, host);
}

export function unmountProgress(host?: HTMLElement) {
  const el = host || document.getElementById('progress-host');
  if (el) render(null, el);
}
