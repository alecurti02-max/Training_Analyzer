// Shared list-item for a workout. Used by Dashboard "recent" and History.
//
// Click handling stays in legacy js/ui.js via global delegation on
// [data-workout-id] (open detail, or toggle selection in select mode).
// This component only emits the same markup the legacy used to produce.

import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { formatDate, scoreColor, secondsToPace } from '@/lib/utils.js';

function workoutDetail(w) {
  if (w.type === 'gym') return `${(w.exercises || []).length} esercizi · ${Math.round((w._tonnage || 0) / 1000 * 10) / 10}t`;
  if (w.type === 'running') {
    let s = `${w.distance || 0} km · ${secondsToPace(w._pace)}`;
    if (w.avghr) s += ` · FC ${w.avghr}`;
    return s;
  }
  if (w.type === 'walking' || w.type === 'cycling') {
    let s = `${w.distance || 0} km · ${w.duration || 0} min`;
    if (w.avghr) s += ` · FC ${w.avghr}`;
    return s;
  }
  if (w.type === 'swimming') {
    let s = `${w.distance ? w.distance + ' km · ' : ''}${w.duration || 0} min`;
    if (w.strokes) s += ` · ${w.strokes} bracciate`;
    return s;
  }
  if (w.type === 'karting') return `${w.track || ''} · Best: ${w.bestLap || '--'}s`;
  const parts = [];
  if (w.duration) parts.push(w.duration + ' min');
  if (w.distance) parts.push(w.distance + ' km');
  if (w.avghr) parts.push('FC ' + w.avghr);
  return parts.join(' · ');
}

export function WorkoutItem({ w, selectMode = false, selected = false }) {
  const tmpl = SPORT_TEMPLATES[w.type];
  const typeName = tmpl?.name || w.type;
  const score = w.scores?.overall ?? '--';
  const scoreLabel = typeof score === 'number' ? score.toFixed(1) : score;
  const typeClass = tmpl ? `type-${w.type}` : 'type-custom';
  const itemClass = `workout-item${selected ? ' selected' : ''}`;
  return (
    <div class={itemClass} data-workout-id={w.id}>
      {selectMode && (
        <input
          type="checkbox"
          class="select-workout-cb"
          checked={selected}
          style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
          readonly
        />
      )}
      <div class="score-sm" style={{ background: scoreColor(score), color: '#fff' }}>{scoreLabel}</div>
      <div class="workout-info">
        <h4>
          {formatDate(w.date)}{' '}
          <span class={`workout-type-badge ${typeClass}`}>{typeName}</span>
        </h4>
        <p>{workoutDetail(w)}</p>
      </div>
    </div>
  );
}
