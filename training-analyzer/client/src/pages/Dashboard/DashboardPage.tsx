import { render } from 'preact';
import { workouts as workoutsSig } from '@/store/workouts';
import { settings as settingsSig, muscleGroups as muscleGroupsSig } from '@/store/settings';
import { exercises as exercisesSig } from '@/store/exercises';
import { BentoGrid, Card, SectionDivider } from '@/components/layout';
import { Hero, NextUp, StatsRow, StreakBox, RecentList } from './Dashboard';
import { WorkoutCalendar } from './WorkoutCalendar';
import { RecoveryBodyMap } from './RecoveryBodyMap';

// Dashboard — route .tsx autonoma (Tier-2). Possiede tutto il markup (header
// editoriale + hero + telemetria + zone Prontezza/Registro + canvas Chart.js) e
// legge i dati dai signal store (reattiva). I componenti dinamici sono riusati
// da Dashboard.jsx. I canvas (weekly/radar) restano disegnati da
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

      {/* N2: la Dashboard ospita anche l'Analisi (ex Progressi → Generali).
          Tab via delega data-tab-group di ui.js; showTab('dashboard','analisi')
          fa partire renderProgress() che disegna i canvas qui sotto. */}
      <div class="lay-tabbar">
        <button class="bm-tab active" data-tab-group="dashboard" data-tab="overview">Panoramica</button>
        <button class="bm-tab" data-tab-group="dashboard" data-tab="analisi">Analisi</button>
      </div>

      <div data-tab-content="overview">
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
          <div class="card-title">Mappa del corpo</div>
          <RecoveryBodyMap workouts={sorted} muscleGroups={mg} />
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
          <div class="card-title">Calendario Allenamenti <span style="font-size:.72rem;color:var(--text2);font-weight:400">ultimi 3 mesi</span></div>
          <WorkoutCalendar workouts={sorted} />
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
      </div>

      {/* ===== ANALISI (ex Progressi → Generali): canvas disegnati da
           ui.js::renderProgress (charts.js) quando il tab viene aperto ===== */}
      <div data-tab-content="analisi" style="display:none">
        <SectionDivider>Andamento</SectionDivider>
        <BentoGrid cols="split">
          <Card hud><div class="card-title">Volume Palestra (tonnellaggio)</div><div class="chart-container"><canvas id="chart-gym-volume" /></div></Card>
          <Card hud><div class="card-title">Pace Corsa ponderato (min/km)</div><div class="chart-container"><canvas id="chart-run-pace" /></div></Card>
        </BentoGrid>

        <SectionDivider>Forza &amp; condizione</SectionDivider>
        <BentoGrid cols="split">
          <Card hud><div class="card-title">1RM Stimato (Epley)</div><div id="orm-select-container" style="margin-bottom:8px" /><div class="chart-container"><canvas id="chart-1rm" /></div></Card>
          <Card hud><div class="card-title">Heart Rate Zones (Corse)</div><div id="hr-zones-container" /></Card>
        </BentoGrid>

        <SectionDivider>Distribuzione</SectionDivider>
        <Card hud><div class="card-title">Gruppi Muscolari (ultime 4 sett.)</div><div class="chart-container"><canvas id="chart-muscles" /></div></Card>
      </div>
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
