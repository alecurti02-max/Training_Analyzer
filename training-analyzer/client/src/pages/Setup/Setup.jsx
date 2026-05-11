// Setup page — sports manager + muscle groups manager.
//
// Exercise Library, Settings form, and Import tabs stay in legacy ui.js
// for now (large + intricate state). Migrated only the small "chip list"
// managers that are pure presentation over the activeSports / muscleGroups
// arrays in ui.js.

import { render } from 'preact';
import { SPORT_TEMPLATES, DEFAULT_MUSCLES } from '../../../js/sports.js';

function SportsManager({ activeSports }) {
  const available = Object.keys(SPORT_TEMPLATES).filter((k) => !activeSports.includes(k));

  return (
    <>
      <div id="active-sports-list" class="sport-chip-row">
        {activeSports.map((key) => {
          const s = SPORT_TEMPLATES[key];
          if (!s) return null;
          return (
            <span class="sport-chip active" key={key}>
              {s.icon} {s.name}
              {!s.fixed && (
                <span
                  class="remove-sport"
                  onClick={() => globalThis.removeSport?.(key)}
                  role="button"
                >×</span>
              )}
            </span>
          );
        })}
      </div>
      <div id="available-sports-pool" class="sport-chip-row" style={{ marginTop: 8 }}>
        {available.map((key) => {
          const s = SPORT_TEMPLATES[key];
          return (
            <span
              class="sport-chip"
              key={key}
              onClick={() => globalThis.addSport?.(key)}
              role="button"
            >
              {s.icon} {s.name}
            </span>
          );
        })}
      </div>
    </>
  );
}

function MuscleGroupsManager({ muscleGroups }) {
  return (
    <>
      {muscleGroups.map((m) => {
        const isDefault = DEFAULT_MUSCLES.includes(m);
        return (
          <span class="muscle-chip" key={m}>
            {m}
            {!isDefault && (
              <span
                class="remove-muscle"
                onClick={() => globalThis.removeMuscleGroup?.(m)}
                role="button"
              >×</span>
            )}
          </span>
        );
      })}
    </>
  );
}

// Sports manager has two separate containers (#active-sports-list +
// #available-sports-pool) in the legacy HTML — we render a single fragment
// into the first one and Preact's reconciler ignores the other; to keep
// markup parity we instead render both via a single component into the
// outer wrapper. The legacy code populated the two divs separately, so we
// reproduce that here.
export function mountSports({ activeSports }) {
  // The two legacy divs are siblings; we'll target their parent and replace
  // both with a single fragment. To avoid touching index.html, we render
  // into each div separately keeping the same IDs.
  const activeEl = document.getElementById('active-sports-list');
  const poolEl = document.getElementById('available-sports-pool');

  if (activeEl) {
    render(
      <>
        {activeSports.map((key) => {
          const s = SPORT_TEMPLATES[key];
          if (!s) return null;
          return (
            <span class="sport-chip active" key={key}>
              {s.icon} {s.name}
              {!s.fixed && (
                <span class="remove-sport" onClick={() => globalThis.removeSport?.(key)} role="button">×</span>
              )}
            </span>
          );
        })}
      </>,
      activeEl
    );
  }

  if (poolEl) {
    const available = Object.keys(SPORT_TEMPLATES).filter((k) => !activeSports.includes(k));
    render(
      <>
        {available.map((key) => {
          const s = SPORT_TEMPLATES[key];
          return (
            <span
              class="sport-chip"
              key={key}
              onClick={() => globalThis.addSport?.(key)}
              role="button"
            >
              {s.icon} {s.name}
            </span>
          );
        })}
      </>,
      poolEl
    );
  }
}

export function mountMuscleGroups({ muscleGroups }) {
  const el = document.getElementById('muscle-groups-list');
  if (el) render(<MuscleGroupsManager muscleGroups={muscleGroups} />, el);
}

export function unmountSetup() {
  for (const id of ['active-sports-list', 'available-sports-pool', 'muscle-groups-list']) {
    const el = document.getElementById(id);
    if (el) render(null, el);
  }
}
