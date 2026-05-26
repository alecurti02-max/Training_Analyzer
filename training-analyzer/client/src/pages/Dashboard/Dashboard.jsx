// Dashboard page — Fase 5 of the strangler-fig migration.
//
// The legacy index.html has four placeholder containers in #page-dashboard
// (#dash-stats, #dash-streak, #dash-recovery, #dash-recent) that the old
// ui.js::renderDashboard() filled with innerHTML strings. This file replaces
// those four fills with Preact components — without touching the surrounding
// HTML (heatmap, weekly chart, radar chart still rendered imperatively by
// charts.js, as before).
//
// Charts and global click handlers (.workout-item -> showWorkoutDetail) stay
// in legacy land; we just emit the same markup so the existing delegation
// keeps working.

import { render } from 'preact';
import { calculateStreak, getRecoveryStatus } from '@/scoring';
import { todayStr, daysBetween } from '@/lib/utils.js';
import { WorkoutItem } from '@/components/WorkoutItem/WorkoutItem.jsx';

// ─────────────────────────────────────────────
// Stats: 4 cards (week workouts, avg score, week km, week tonnage)
// ─────────────────────────────────────────────
function StatsRow({ workouts, settings }) {
  const now = todayStr();
  const thisWeek = workouts.filter((w) => daysBetween(now, w.date) <= 7);
  const weekGoal = settings.weekgoal || 4;
  const avgScore = workouts.length
    ? (workouts.reduce((s, w) => s + (w.scores?.overall || 0), 0) / workouts.length).toFixed(1)
    : '--';
  const weekKm = thisWeek.filter((w) => w.type === 'running').reduce((s, w) => s + (w.distance || 0), 0).toFixed(1);
  const weekTonnage = thisWeek.filter((w) => w.type === 'gym').reduce((s, w) => s + (w._tonnage || 0), 0);

  const weekGoalColor = thisWeek.length >= weekGoal ? 'var(--green)' : 'var(--yellow)';

  return (
    <>
      <div class="card">
        <div class="stat-box">
          <div class="stat-value" style={{ color: weekGoalColor }}>{thisWeek.length}/{weekGoal}</div>
          <div class="stat-label">Allenamenti settimana</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-value" style={{ color: 'var(--accent)' }}>{avgScore}</div>
          <div class="stat-label">Score Medio</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-value" style={{ color: 'var(--green)' }}>{weekKm} km</div>
          <div class="stat-label">Km corsa settimana</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-value" style={{ color: 'var(--blue)' }}>{Math.round(weekTonnage / 1000 * 10) / 10}t</div>
          <div class="stat-label">Tonnellaggio settimana</div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Streak: current consecutive days + historical record
// ─────────────────────────────────────────────
function StreakBox({ workouts }) {
  const streak = calculateStreak(workouts);
  return (
    <>
      <div style={{ textAlign: 'center' }}>
        <div class="streak-num">{streak.current}</div>
        <div class="streak-info"><div class="streak-label">giorni consecutivi</div></div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div class="streak-num" style={{ color: 'var(--yellow)' }}>{streak.record}</div>
        <div class="streak-info"><div class="streak-label">record storico</div></div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Recovery: per-muscle recovery percentage bars
// ─────────────────────────────────────────────
function RecoveryList({ workouts, muscleGroups }) {
  const recovery = getRecoveryStatus(workouts, muscleGroups);
  const items = Object.entries(recovery.muscleRecovery)
    .filter(([_, info]) => info.pct < 100 && info.lastWorked);

  if (recovery.suggestedRestDays === 0 && items.length === 0) {
    return <p style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>Tutti i gruppi muscolari sono recuperati!</p>;
  }

  return (
    <>
      {recovery.suggestedRestDays > 0 && (
        <div class="advice-box" style={{ marginBottom: 12 }}>
          Carico alto ({recovery.workoutsLast7} in 7gg). Consigliati {recovery.suggestedRestDays} giorni di riposo.
        </div>
      )}
      {items.map(([muscle, info]) => {
        const color = info.pct >= 80 ? 'var(--green)' : info.pct >= 50 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div class="muscle-item" key={muscle}>
            <span>{muscle}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{info.daysAgo}g fa</span>
              <div class="muscle-bar-bg">
                <div class="muscle-bar-fill" style={{ width: `${info.pct}%`, background: color }} />
              </div>
              <span style={{ fontSize: '0.8rem', width: 35, textAlign: 'right' }}>{info.pct}%</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// Recent workouts: top 5 list. Click handled by legacy global delegation
// on .workout-item[data-workout-id] -> showWorkoutDetail (ui.js).
// Uses the shared <WorkoutItem/> primitive.
// ─────────────────────────────────────────────
function RecentList({ workouts }) {
  if (!workouts.length) {
    return (
      <div class="empty-state">
        <p>Nessun allenamento registrato</p>
        <p style={{ fontSize: '0.85rem' }}>Vai su "Log" per iniziare!</p>
      </div>
    );
  }
  return <>{workouts.slice(0, 5).map((w) => <WorkoutItem key={w.id} w={w} />)}</>;
}

// ─────────────────────────────────────────────
// Mount API: called by legacy ui.js::renderDashboard().
// Receives the current caches and renders all four Preact roots.
// ─────────────────────────────────────────────
export function mountDashboard({ workouts, settings, muscleGroups }) {
  const sorted = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));

  const elStats = document.getElementById('dash-stats');
  const elStreak = document.getElementById('dash-streak');
  const elRecovery = document.getElementById('dash-recovery');
  const elRecent = document.getElementById('dash-recent');

  if (elStats) render(<StatsRow workouts={sorted} settings={settings || {}} />, elStats);
  if (elStreak) render(<StreakBox workouts={sorted} />, elStreak);
  if (elRecovery) render(<RecoveryList workouts={sorted} muscleGroups={muscleGroups || []} />, elRecovery);
  if (elRecent) render(<RecentList workouts={sorted} />, elRecent);
}

export function unmountDashboard() {
  for (const id of ['dash-stats', 'dash-streak', 'dash-recovery', 'dash-recent']) {
    const el = document.getElementById(id);
    if (el) render(null, el);
  }
}
