import { useState } from 'preact/hooks';
import { todayStr } from '@/lib/utils';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import {
  monthGrid, lastNMonths, indexWorkouts, intensityLevel, DAY_LABELS,
} from './logic/calendar';
import type { WorkoutRecord } from '@/store/workouts';
import s from './WorkoutCalendar.module.css';

// Calendario Allenamenti: griglie degli ultimi 3 mesi, giorni allenati colorati
// per intensità (max score del giorno). Tap/click su un giorno → dettaglio sotto
// le griglie (mobile-first: niente tooltip hover; title come bonus desktop).
export function WorkoutCalendar({ workouts }: { workouts: WorkoutRecord[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayStr();
  const byDay = indexWorkouts(workouts);
  const months = lastNMonths(today, 3).map(({ year, month }) => monthGrid(year, month));

  const dayWorkouts = selected ? workouts.filter((w) => w.date === selected) : [];

  return (
    <div>
      <div class={s.months}>
        {months.map((m) => (
          <div key={m.label}>
            <div class={s.monthLabel}>{m.label}</div>
            <div class={s.dayHead}>
              {DAY_LABELS.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div class={s.grid}>
              {m.weeks.flat().map((date, i) => {
                if (!date) return <span key={i} />;
                const info = byDay.get(date);
                const level = info ? intensityLevel(info.best) : 0;
                const cls = [
                  s.day, s['lv' + level],
                  date === today ? s.today : '',
                  date === selected ? s.selected : '',
                  date > today ? s.future : '',
                ].join(' ');
                const title = info
                  ? `${info.count} allenament${info.count > 1 ? 'i' : 'o'}` +
                    (info.best !== null ? ` · score ${info.best.toFixed(1)}` : '')
                  : undefined;
                return (
                  <button
                    key={date}
                    type="button"
                    class={cls}
                    title={title}
                    disabled={!info}
                    onClick={() => setSelected(date === selected ? null : date)}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div class={s.legend}>
        <span>Meno</span>
        <i class={s.lv1} /><i class={s.lv2} /><i class={s.lv3} /><i class={s.lv4} />
        <span>Più</span>
      </div>

      {selected && (
        <div class={s.detail}>
          <div class={s.detailDate}>{formatSelected(selected)}</div>
          {dayWorkouts.map((w) => (
            <div key={w.id} class={s.detailRow}>
              <span class={s.detailIcon}>{SPORT_TEMPLATES[w.type]?.icon || '🏅'}</span>
              <span>{SPORT_TEMPLATES[w.type]?.name || w.type}</span>
              {typeof w.scores?.overall === 'number' && (
                <span class={s.detailScore}>{w.scores.overall.toFixed(1)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSelected(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}
