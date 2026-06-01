// Dynamic sport-field form, driven by SPORT_TEMPLATES[type].fields + FIELD_DEFS.
// Mirrors the legacy renderSportFields (ui.js ~462) and liveRenderSportFields
// (~1479). `values` is a flat { fieldKey: rawString }; onChange(key, value).
// `skipDuration` true for live (duration comes from the timer).
// Muscle chips (non-gym) reuse .filter-btn like the legacy renderMuscleChipsHTML.

import { SPORT_TEMPLATES, FIELD_DEFS, DEFAULT_MUSCLES } from '../../../../js/sports.js';

export function SportFields({ type, values, onChange, skipDuration = false, muscles, onToggleMuscle, showMuscles = false }) {
  const tmpl = SPORT_TEMPLATES[type];
  if (!tmpl) return null;
  const fields = (tmpl.fields || []).filter((f) => !(skipDuration && f === 'duration'));
  const selected = new Set(muscles || []);
  return (
    <>
      <div class="form-row">
        {fields.map((fKey) => {
          const f = FIELD_DEFS[fKey];
          if (!f) return null;
          const val = values[fKey] ?? '';
          return (
            <div class="form-group" key={fKey}>
              <label>{f.label}</label>
              {f.type === 'select' ? (
                <select value={val} onChange={(e) => onChange(fKey, e.target.value)}>
                  {(f.options || []).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.step} min={f.min} max={f.max}
                  placeholder={f.ph || ''} value={val}
                  onInput={(e) => onChange(fKey, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {showMuscles && type !== 'gym' && (
        <div class="form-group" style="margin-top:12px">
          <label>Muscoli coinvolti <span style="font-size:.72rem;color:var(--text2);font-weight:400">(usati per il recupero in dashboard)</span></label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            {DEFAULT_MUSCLES.map((m) => (
              <button
                type="button" key={m}
                class={`filter-btn${selected.has(m) ? ' active' : ''}`}
                onClick={() => onToggleMuscle(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
