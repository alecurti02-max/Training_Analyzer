import { render } from 'preact';
import { workouts as workoutsSig } from '@/store/workouts';
import { settings as settingsSig, muscleGroups as muscleGroupsSig } from '@/store/settings';
import { exercises as exercisesSig } from '@/store/exercises';
import { BentoGrid, Card, SectionDivider } from '@/components/layout';
import { Hero, NextUp, StatsRow, StreakBox, RecoveryList, RecentList } from './Dashboard';

// Dashboard — route .tsx autonoma (Tier-2). Possiede tutto il markup (header
// editoriale + hero + telemetria + zone Prontezza/Registro + canvas Chart.js) e
// legge i dati dai signal store (reattiva). I componenti dinamici sono riusati
// da Dashboard.jsx. I canvas (heatmap/weekly/radar) restano disegnati da
// charts.js: ui.js li ridisegna dopo il mount. Montata dentro #page-dashboard,
// così gli stili cockpit (cc-*, scoped a #page-dashboard) si applicano.
export function DashboardPage() {
  const all = workoutsSig.value;
  const settings = settingsSig.value;
  const mg = muscleGroupsSig.value;
  const exLib = exercisesSig.value;
  const sorted = [...all].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <header class="dash-header">
        <p class="dash-eyebrow">Daemon · Dashboard</p>
        <h1 class="dash-title">Buon <span class="dash-title-hl">allenamento</span></h1>
      </header>

      <section class="dash-hero" id="dash-hero">
        <Hero workouts={sorted} settings={settings} muscleGroups={mg} />
        <NextUp workouts={sorted} muscleGroups={mg} exercises={exLib} />
      </section>

      <div class="card-grid" id="dash-stats">
        <StatsRow workouts={sorted} settings={settings} />
      </div>

      <SectionDivider>Prontezza &amp; corpo</SectionDivider>
      <BentoGrid cols="triple">
        <Card hud>
          <div class="card-title">Recovery Status</div>
          <RecoveryList workouts={sorted} muscleGroups={mg} />
        </Card>
        <Card hud>
          <div class="card-title">Streak &amp; Consistenza</div>
          <div class="streak-display"><StreakBox workouts={sorted} /></div>
        </Card>
        <Card hud clickable dataPage="athletic">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">Profilo Atletico <span style="font-size:.72rem;color:var(--text2);font-weight:400">Dettagli →</span></div>
          <div class="chart-container" style="height:260px"><canvas id="chart-radar" /></div>
        </Card>
      </BentoGrid>

      <SectionDivider>Registro attività</SectionDivider>
      <BentoGrid cols="split">
        <Card hud>
          <div class="card-title">Calendario Allenamenti</div>
          <div class="heatmap-container"><canvas id="heatmap-canvas" class="heatmap-canvas" /></div>
          <div class="heatmap-legend">
            <span>Meno</span>
            <span style="background:var(--bg3)" />
            <span style="background:color-mix(in srgb,var(--pulse) 25%,transparent)" />
            <span style="background:color-mix(in srgb,var(--pulse) 50%,transparent)" />
            <span style="background:color-mix(in srgb,var(--pulse) 75%,transparent)" />
            <span style="background:var(--pulse)" />
            <span>Più</span>
          </div>
        </Card>
        <Card hud>
          <div class="card-title">Volume Settimanale</div>
          <div class="chart-container"><canvas id="chart-weekly" /></div>
        </Card>
      </BentoGrid>

      <Card hud>
        <div class="card-title">Ultimi Allenamenti</div>
        <RecentList workouts={sorted} />
      </Card>
    </>
  );
}

export function mountDashboard({ host }: { host: HTMLElement }) {
  if (host) render(<DashboardPage />, host);
}

export function unmountDashboard(host?: HTMLElement) {
  const el = host || document.getElementById('dashboard-host');
  if (el) render(null, el);
}
