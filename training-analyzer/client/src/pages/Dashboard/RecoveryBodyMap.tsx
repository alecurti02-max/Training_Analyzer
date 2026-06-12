import { getRecoveryStatus } from '@/scoring/scoring';
import type { WorkoutRecord } from '@/store/workouts';
import { BodyMapSvg, type RegionFill } from './BodyMapSvg';
import { regionsFor, recoveryTone, TONE_COLORS, type RegionId } from './logic/muscleMap';
import s from './RecoveryBodyMap.module.css';

// Recovery Status come mappa anatomica: regioni colorate per stato di recupero
// (stesse soglie/dati della vecchia RecoveryList: getRecoveryStatus resta la
// fonte unica, condivisa col coaching di NextUp). I gruppi muscolari custom
// non mappabili sulla silhouette finiscono nei chip sotto la mappa.
export function RecoveryBodyMap({ workouts, muscleGroups }: {
  workouts: WorkoutRecord[];
  muscleGroups: string[];
}) {
  const recovery = getRecoveryStatus(workouts as never, muscleGroups);
  const entries = Object.entries(recovery.muscleRecovery);

  const fills: Partial<Record<RegionId, RegionFill>> = {};
  const fillPct: Partial<Record<RegionId, number>> = {};
  const chips: { muscle: string; pct: number; daysAgo: number; color: string }[] = [];

  for (const [muscle, info] of entries) {
    if (!info.lastWorked || info.pct >= 100) continue; // recuperato → neutro
    const tone = recoveryTone(info.pct);
    const color = TONE_COLORS[tone];
    const regions = regionsFor(muscle);
    const title = `${muscle} · ${info.daysAgo}g fa · ${info.pct}%`;
    if (regions) {
      for (const r of regions) {
        // Più gruppi sulla stessa regione (es. "Gambe" + "Glutei"): vince il meno recuperato
        if (fillPct[r] === undefined || info.pct < fillPct[r]!) {
          fillPct[r] = info.pct;
          fills[r] = { color, opacity: 0.45 + 0.55 * ((100 - info.pct) / 100), title };
        }
      }
    } else {
      chips.push({ muscle, pct: info.pct, daysAgo: info.daysAgo, color });
    }
  }

  const allReady = Object.keys(fills).length === 0 && chips.length === 0;

  return (
    <div>
      {recovery.suggestedRestDays > 0 && (
        <div class="advice-box" style={{ marginBottom: 12 }}>
          Carico alto ({recovery.workoutsLast7} in 7gg). Consigliati {recovery.suggestedRestDays} giorni di riposo.
        </div>
      )}

      <BodyMapSvg fills={fills} />

      {allReady && (
        <p class={s.allReady}>Tutti i gruppi muscolari sono recuperati!</p>
      )}

      {chips.length > 0 && (
        <div class={s.chips}>
          {chips.map((c) => (
            <span key={c.muscle} class={s.chip}>
              <i class={s.dot} style={{ background: c.color }} />
              {c.muscle} · {c.daysAgo}g fa · {c.pct}%
            </span>
          ))}
        </div>
      )}

      <div class={s.legend}>
        <span><i class={s.dot} style="background:color-mix(in srgb, var(--text2) 30%, transparent)" /> Recuperato</span>
        <span><i class={s.dot} style="background:var(--green)" /> ≥80%</span>
        <span><i class={s.dot} style="background:var(--yellow)" /> 50–79%</span>
        <span><i class={s.dot} style="background:var(--red)" /> &lt;50%</span>
      </div>
    </div>
  );
}
