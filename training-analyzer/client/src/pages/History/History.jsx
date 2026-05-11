// History page — filters bar + workout list.
//
// State (current filter, select mode, selected ids) is still owned by
// legacy js/ui.js. Each mount() call receives the current snapshot and
// re-renders. Filter button clicks and workout-item clicks are handled by
// legacy global delegation; this component only emits the markup.

import { render } from 'preact';
import { SPORT_TEMPLATES } from '../../../js/sports.js';
import { WorkoutItem } from '@/components/WorkoutItem/WorkoutItem.jsx';

function HistoryFilters({ workouts, filter }) {
  const types = [...new Set(workouts.map((w) => w.type))];
  return (
    <>
      <button
        class={`filter-btn${filter === 'all' ? ' active' : ''}`}
        data-hist-filter="all"
      >
        Tutti
      </button>
      {types.map((t) => {
        const name = SPORT_TEMPLATES[t]?.name || t;
        return (
          <button
            key={t}
            class={`filter-btn${filter === t ? ' active' : ''}`}
            data-hist-filter={t}
          >
            {name}
          </button>
        );
      })}
    </>
  );
}

function HistoryList({ workouts, selectMode, selectedIds }) {
  if (!workouts.length) {
    return (
      <div class="empty-state">
        <p>Nessun allenamento trovato</p>
      </div>
    );
  }
  const selectedSet = new Set(selectedIds || []);
  return (
    <>
      {workouts.map((w) => (
        <WorkoutItem
          key={w.id}
          w={w}
          selectMode={selectMode}
          selected={selectedSet.has(w.id)}
        />
      ))}
    </>
  );
}

export function mountHistory({ workouts, filter = 'all', selectMode = false, selectedIds = [] }) {
  let list = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filter !== 'all') list = list.filter((w) => w.type === filter);

  const elFilters = document.getElementById('history-filters');
  const elList = document.getElementById('history-list');

  if (elFilters) render(<HistoryFilters workouts={workouts} filter={filter} />, elFilters);
  if (elList) {
    render(
      <HistoryList workouts={list} selectMode={selectMode} selectedIds={selectedIds} />,
      elList
    );
  }
}

export function unmountHistory() {
  for (const id of ['history-filters', 'history-list']) {
    const el = document.getElementById(id);
    if (el) render(null, el);
  }
}
