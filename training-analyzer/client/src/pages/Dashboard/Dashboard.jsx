// Dashboard page — Carbon Cockpit.
//
// Monta componenti Preact nei container placeholder di index.html #page-dashboard:
//   #dash-hero-main  → <Hero>      (score 30gg gigante + coaching + sub-stat)   [NEW]
//   #dash-hero-next  → <NextUp>    (prossima sessione + INIZIA ORA)             [NEW]
//   #dash-stats      → <StatsRow>  (4 bento card con sparkline + tick HUD)
//   #dash-streak     → <StreakBox>
//   #dash-recovery   → <RecoveryList>
//   #dash-recent     → <RecentList>
// Heatmap/weekly/radar restano canvas legacy (charts.js). Markup workout-item
// invariato per la click-delegation legacy.

import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { calculateStreak, getRecoveryStatus } from '@/scoring';
import { todayStr, daysBetween, weeklyBuckets } from '@/lib/utils.js';
import { WorkoutItem } from '@/components/WorkoutItem/WorkoutItem.jsx';
import { buildCoaching } from './coaching.js';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { plannedWorkouts, loadPlans, nextPlan } from '@/store/plans.js';
import { startLiveFromPlan, startFromPlan, setRequestedTab } from '@/store/train.js';
import { PlannerModal } from './PlannerModal.jsx';

// ─────────────────────────────────────────────
// useCountUp: anima 0→target al mount, e current→target su cambio dato.
// Rispetta prefers-reduced-motion (snap). Preact preserva lo stato fra i
// re-render nello stesso container, quindi il count-up parte una sola volta
// per "ingresso" in Dashboard, non a ogni aggiornamento dati.
// ─────────────────────────────────────────────
function useCountUp(target, decimals = 0, dur = 900) {
  const to = Number(target) || 0;
  const [val, setVal] = useState(to);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to); fromRef.current = to; return;
    }
    const from = fromRef.current;
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setVal(to); fromRef.current = to; }
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [to]);
  return Number(val).toFixed(decimals);
}

// ─────────────────────────────────────────────
// Sparkline: barre mini da una serie numerica.
// ─────────────────────────────────────────────
function Sparkline({ data, color }) {
  const max = Math.max(1, ...data.map((v) => Number(v) || 0));
  return (
    <div class="cc-spark" aria-hidden="true">
      {data.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(10, ((Number(v) || 0) / max) * 100)}%`, background: color, animationDelay: `${i * 55}ms` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Hero: telemetria principale (score medio 30gg gigante + delta + coaching + sub-stat)
// ─────────────────────────────────────────────
export function Hero({ workouts, settings, muscleGroups }) {
  const now = todayStr();
  const avgOf = (arr) => {
    const s = arr.filter((w) => w.scores && w.scores.overall != null);
    return s.length ? s.reduce((a, w) => a + w.scores.overall, 0) / s.length : 0;
  };
  const l30 = workouts.filter((w) => daysBetween(now, w.date) <= 30);
  const p30 = workouts.filter((w) => { const d = daysBetween(now, w.date); return d > 30 && d <= 60; });
  const avg30 = avgOf(l30);
  const delta = avgOf(p30) ? avg30 - avgOf(p30) : 0;

  const thisWeek = workouts.filter((w) => daysBetween(now, w.date) <= 7);
  const streak = calculateStreak(workouts);
  const recovery = getRecoveryStatus(workouts, muscleGroups);
  const weekKm = thisWeek.filter((w) => w.type === 'running').reduce((s, w) => s + (w.distance || 0), 0);
  const weekT = thisWeek.filter((w) => w.type === 'gym').reduce((s, w) => s + (w._tonnage || 0), 0) / 1000;
  const coaching = buildCoaching({ workouts, recovery, streak, settings });

  const score = useCountUp(avg30, 1);
  const kmS = useCountUp(weekKm, 1);
  const tS = useCountUp(weekT, 1);

  return (
    <div class="cc-hud cc-hero">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div class="cc-hero-eyebrow" style={{ marginBottom: 0 }}>Sistema pronto · <b>{thisWeek.length} sessioni</b> questa settimana</div>
        <span class="px-status"><i />Ready</span>
      </div>
      <div class="cc-hero-big">
        <span class="cc-num cc-hero-score">{avg30 ? score : '--'}</span>
        <div class="cc-hero-meta">
          <div class="cc-hero-lab">Score medio · 30gg</div>
          {avg30 > 0 && Math.abs(delta) >= 0.1 && (
            <div class={`cc-delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</div>
          )}
        </div>
      </div>
      {avg30 > 0 && (
        <>
          {/* Barra di sforzo: score/10 sulla scala dello strumento; la zona
              finale è il "redline" (oltre 8.2 stai spingendo davvero). */}
          <div class="px-effort"><i style={{ width: `${Math.min(100, Math.round(avg30 * 10))}%` }} /></div>
          <div class="px-effort-scale"><span>Potenza</span><b>Redline</b></div>
        </>
      )}
      <p class="cc-hero-line">{coaching.text}</p>
      <div class="cc-hero-sub">
        <div><span class="cc-num">{streak.current}</span><span class="cc-sub-lab">Streak · gg</span></div>
        <div><span class="cc-num">{kmS}</span><span class="cc-sub-lab">Corsa · km 7gg</span></div>
        <div><span class="cc-num">{tS}</span><span class="cc-sub-lab">Tonnellaggio · t</span></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// NextUp: "Prossima sessione". (Parte A: suggerimento a regole dal recupero.
// Parte B aggancerà i PlannedWorkout: piano programmato → override del suggerimento.)
// ─────────────────────────────────────────────
export function NextUp({ workouts, muscleGroups, exercises }) {
  const [planner, setPlanner] = useState(null); // null = chiusa; {} = nuova; plan = modifica
  const plans = plannedWorkouts.value;          // signal reattivo
  useEffect(() => { loadPlans(); }, []);

  const today = todayStr();
  const planned = nextPlan(plans, today);

  const suggested = Object.entries(getRecoveryStatus(workouts, muscleGroups).muscleRecovery)
    .sort((a, b) => b[1].pct - a[1].pct)
    .map(([m]) => m)
    .filter((m) => m && m !== 'Full Body')
    .slice(0, 2);

  const startTrain = (plan) => {
    if (plan) { startLiveFromPlan(plan); setRequestedTab('live'); }
    if (typeof window.showPage === 'function') window.showPage('train');
  };
  // Stesso piano, percorso manuale: wizard pre-compilato (tipo+muscoli+esercizi)
  // per registrare la sessione a posteriori invece di farla partire live.
  const startManual = (plan) => {
    startFromPlan(plan);
    setRequestedTab('manual');
    if (typeof window.showPage === 'function') window.showPage('train');
  };
  const sportName = (t) => (SPORT_TEMPLATES[t] && SPORT_TEMPLATES[t].name) || t;
  const fmtWhen = (d) => {
    if (d === today) return 'oggi';
    const t = new Date(today); t.setDate(t.getDate() + 1);
    if (d === t.toISOString().slice(0, 10)) return 'domani';
    return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div class="cc-hud cc-nextup">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div class="cc-nextup-eyebrow">▸ Prossima sessione{planned && <span class="cc-nextup-when"> · {fmtWhen(planned.date)}</span>}</div>
          <span class="px-status rl"><i />Push</span>
        </div>
        {planned ? (
          <>
            <h3 class="cc-nextup-title">{planned.muscleGroups && planned.muscleGroups.length ? planned.muscleGroups.join(' & ') : sportName(planned.type)}</h3>
            <div class="cc-nextup-meta">{planned.note || sportName(planned.type)} · <button type="button" class="cc-link" onClick={() => setPlanner(planned)}>modifica</button> · <button type="button" class="cc-link" onClick={() => startManual(planned)}>registra</button></div>
            <div class="cc-nextup-chips">
              <span class="cc-chip">{sportName(planned.type)}</span>
              {(planned.muscleGroups || []).slice(0, 3).map((m) => <span class="cc-chip" key={m}>{m}</span>)}
            </div>
          </>
        ) : (
          <>
            <h3 class="cc-nextup-title">{suggested.length ? suggested.join(' & ') : 'Sessione libera'}</h3>
            <div class="cc-nextup-meta">Suggerita dal recupero · <button type="button" class="cc-link" onClick={() => setPlanner({})}>programma</button></div>
            <div class="cc-nextup-chips">{suggested.map((m) => <span class="cc-chip" key={m}>{m}</span>)}</div>
          </>
        )}
      </div>
      <button class="btn btn-primary cc-start" type="button"
        onClick={() => startTrain(planned || { type: 'gym', muscleGroups: suggested })}>Inizia ora ▸</button>
      {planner !== null && (
        <PlannerModal muscleGroups={muscleGroups} exercises={exercises} workouts={workouts}
          plan={planner && planner.id ? planner : null} onClose={() => setPlanner(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat bento card (label mono + quadratino + numero + delta + sparkline + tick HUD)
// ─────────────────────────────────────────────
function StatCard({ label, color, value, decimals = 0, prefix = '', suffix = '', goal = null, delta = null, series }) {
  const n = useCountUp(value, decimals);
  return (
    <div class="card cc-hud cc-stat">
      <div class="cc-stat-label"><i style={{ background: color }} />{label}</div>
      <div class="cc-stat-v">
        <span class="cc-num">{prefix}{n}</span>
        {goal != null && <span class="cc-unit">/ {goal}</span>}
        {suffix && <span class="cc-unit">{suffix}</span>}
        {delta != null && Math.abs(delta) >= 0.1 && (
          <span class={`cc-delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</span>
        )}
      </div>
      <Sparkline data={series} color={color} />
    </div>
  );
}

export function StatsRow({ workouts, settings }) {
  const now = todayStr();
  const thisWeek = workouts.filter((w) => daysBetween(now, w.date) <= 7);
  const weekGoal = settings.weekgoal || 4;
  const avgScore = workouts.length
    ? workouts.reduce((s, w) => s + (w.scores?.overall || 0), 0) / workouts.length
    : 0;
  const weekKm = thisWeek.filter((w) => w.type === 'running').reduce((s, w) => s + (w.distance || 0), 0);
  const weekTonnage = thisWeek.filter((w) => w.type === 'gym').reduce((s, w) => s + (w._tonnage || 0), 0) / 1000;

  const series = weeklyBuckets(workouts, 7);
  const last = series[series.length - 1] || {};
  const prev = series[series.length - 2] || {};
  const scoreDelta = last.score && prev.score ? last.score - prev.score : 0;

  return (
    <>
      <StatCard label="Sessioni · settimana" color="var(--accent)" value={thisWeek.length} goal={weekGoal}
        series={series.map((b) => b.sessions)} />
      <StatCard label="Score medio" color="var(--accent)" value={avgScore} decimals={1} delta={scoreDelta}
        series={series.map((b) => b.score)} />
      <StatCard label="Corsa · 7gg" color="var(--green)" value={weekKm} decimals={1} suffix="km"
        series={series.map((b) => b.km)} />
      <StatCard label="Tonnellaggio" color="var(--blue)" value={weekTonnage} decimals={1} suffix="t"
        series={series.map((b) => b.tonnage)} />
    </>
  );
}

// ─────────────────────────────────────────────
// Streak
// ─────────────────────────────────────────────
export function StreakBox({ workouts }) {
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
// Recovery
// ─────────────────────────────────────────────
export function RecoveryList({ workouts, muscleGroups }) {
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
// Recent workouts
// ─────────────────────────────────────────────
export function RecentList({ workouts }) {
  if (!workouts.length) {
    return (
      <div class="empty-state">
        <p>Nessun allenamento registrato</p>
        <p style={{ fontSize: '0.85rem' }}>Vai su "Allenamento" per iniziare!</p>
      </div>
    );
  }
  return <>{workouts.slice(0, 5).map((w) => <WorkoutItem key={w.id} w={w} />)}</>;
}

// ─────────────────────────────────────────────
// Mount API
// ─────────────────────────────────────────────
export function mountDashboard({ workouts, settings, muscleGroups, exercises }) {
  const sorted = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const s = settings || {};
  const mg = muscleGroups || [];
  const exLib = exercises || [];

  const byId = (id) => document.getElementById(id);
  const elHeroMain = byId('dash-hero-main');
  const elHeroNext = byId('dash-hero-next');
  const elStats = byId('dash-stats');
  const elStreak = byId('dash-streak');
  const elRecovery = byId('dash-recovery');
  const elRecent = byId('dash-recent');

  if (elHeroMain) render(<Hero workouts={sorted} settings={s} muscleGroups={mg} />, elHeroMain);
  if (elHeroNext) render(<NextUp workouts={sorted} muscleGroups={mg} exercises={exLib} />, elHeroNext);
  if (elStats) render(<StatsRow workouts={sorted} settings={s} />, elStats);
  if (elStreak) render(<StreakBox workouts={sorted} />, elStreak);
  if (elRecovery) render(<RecoveryList workouts={sorted} muscleGroups={mg} />, elRecovery);
  if (elRecent) render(<RecentList workouts={sorted} />, elRecent);
}

export function unmountDashboard() {
  for (const id of ['dash-hero-main', 'dash-hero-next', 'dash-stats', 'dash-streak', 'dash-recovery', 'dash-recent']) {
    const el = document.getElementById(id);
    if (el) render(null, el);
  }
}
