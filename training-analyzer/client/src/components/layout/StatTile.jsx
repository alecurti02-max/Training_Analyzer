import { useCountUp } from '@/lib/useCountUp.js';
import { Sparkline } from './Sparkline.jsx';

// StatTile: la "bento card" di telemetria (label mono + quadratino colore +
// numero animato + delta opzionale + sparkline + tick HUD). Estratta da
// Dashboard.jsx::StatCard. Riusa le classi cockpit (.cc-stat, .cc-hud...).
export function StatTile({
  label,
  color = 'var(--accent)',
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  goal = null,
  delta = null,
  series = [],
}) {
  const n = useCountUp(value, decimals);
  return (
    <div class="card cc-hud cc-stat">
      <div class="cc-stat-label"><i style={{ background: color }} />{label}</div>
      <div class="cc-stat-v">
        <span class="cc-num">{prefix}{n}</span>
        {goal != null && <span class="cc-unit">/ {goal}</span>}
        {suffix && <span class="cc-unit">{suffix}</span>}
        {delta != null && Math.abs(delta) >= 0.1 && (
          <span class={`cc-delta ${delta > 0 ? 'up' : 'down'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      <Sparkline data={series} color={color} />
    </div>
  );
}
