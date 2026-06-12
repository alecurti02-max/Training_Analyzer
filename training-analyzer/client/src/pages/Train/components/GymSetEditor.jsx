// Shared gym set/exercise editor — used by BOTH the wizard (step 3) and the live
// session. Mirrors the legacy renderWizSets (ui.js ~616) and liveRenderExercises
// (~1320) markup exactly (same CSS classes: .exercise-card, .set-inline, .set-num,
// .weight-uni, .bw-toggle, .drop-inline, .weight-opts-summary, .weight-opts-override)
// so css/style.css keeps working. All mutations go through the verified setModel.
//
// `live` enables the per-set "Fatto" / done flow + auto-advance. `onChange(exIdx,
// nextExercise)` hands a NEW exercise object back to the parent (immutable).

import {
  updateSetField, addSet, removeSet, addDrop, removeDrop, updateDropField,
  applyWeightOption, completeSet,
} from '../logic/setModel.js';

const PARAM_LABELS = { reps: 'Reps', duration: 'Sec', distance: 'm', calories: 'Kcal' };
const PARAM_PH = { reps: 'Reps', duration: 'Secondi', distance: 'Metri', calories: 'Kcal' };
const BARBELL_OPTS = [{ v: '', t: 'Nessuno' }, { v: '20', t: 'Olimpico 20kg' }, { v: '10', t: 'EZ 10kg' }, { v: '25', t: 'Trap 25kg' }];

function weightOptionsSummary(ex) {
  const parts = [];
  if (ex.weightMode === 'per_side') parts.push('Peso per lato');
  if (ex.barbellWeight) parts.push(`+${ex.barbellWeight}kg bilanciere`);
  if (ex.isUnilateral) parts.push('Unilaterale');
  return parts.length ? parts.join(' · ') : 'Peso totale';
}

function WeightOptions({ ex, open, onToggle, onOpt }) {
  const curBW = ex.barbellWeight;
  const preset = curBW != null && BARBELL_OPTS.some((o) => o.v === String(curBW));
  const bSel = curBW == null ? '' : (preset ? String(curBW) : 'custom');
  return (
    <>
      <div class="weight-opts-summary">
        <span>{weightOptionsSummary(ex)}</span>
        <button type="button" class="btn-link-sm" onClick={onToggle}>Modifica</button>
      </div>
      <div class="weight-opts-override" style={open ? '' : 'display:none'}>
        <div class="wopts-row">
          <label>Modalita</label>
          <select value={ex.weightMode === 'per_side' ? 'per_side' : 'total'} onChange={(e) => onOpt('weightMode', e.target.value)}>
            <option value="total">Totale</option>
            <option value="per_side">Per lato</option>
          </select>
        </div>
        <div class="wopts-row">
          <label>Bilanciere</label>
          <select value={bSel} onChange={(e) => onOpt('barbellSel', e.target.value)}>
            {BARBELL_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            <option value="custom">Custom</option>
          </select>
          {bSel === 'custom' && (
            <input type="number" step="0.5" placeholder="kg" class="wopts-custom"
              value={curBW || ''} onInput={(e) => onOpt('barbellCustom', e.target.value)} />
          )}
        </div>
        <div class="wopts-row">
          <label style="display:flex;align-items:center;gap:6px;margin:0">
            <input type="checkbox" checked={!!ex.isUnilateral} onChange={(e) => onOpt('isUnilateral', e.target.checked)} />
            <span>Unilaterale</span>
          </label>
        </div>
      </div>
    </>
  );
}

function SetRow({ ex, s, sIdx, live, onSet, onDrop, onAddDrop, onRemoveDrop, onRemoveSet, onDone }) {
  const param = ex.param || 'reps';
  const isReps = param === 'reps';
  const uni = !!ex.isUnilateral;
  const perSide = ex.weightMode === 'per_side';
  const paramPh = PARAM_PH[param] || 'Reps';
  const kgPlaceholder = isReps ? `Kg${perSide ? '/lato' : ''}` : 'Kg (opz.)';
  const doneClass = live && s.done ? ' done' : '';

  const repsInput = (uni && !isReps) ? (
    <div class="weight-uni">
      <input type="number" placeholder={`${paramPh} SX`} value={s.repsLeft || ''} class="w-uni" onChange={(e) => onSet('repsLeft', e.target.value)} />
      <input type="number" placeholder={`${paramPh} DX`} value={s.repsRight || ''} class="w-uni" onChange={(e) => onSet('repsRight', e.target.value)} />
    </div>
  ) : (
    <input type="number" placeholder={paramPh} value={s.reps || ''} onChange={(e) => onSet('reps', e.target.value)} />
  );

  const weightInputs = uni ? (
    <div class="weight-uni">
      <input type="number" step="0.5" placeholder="SX" value={s.weightLeft || ''} class="w-uni" onChange={(e) => onSet('weightLeft', e.target.value)} />
      <input type="number" step="0.5" placeholder="DX" value={s.weightRight || ''} class="w-uni" onChange={(e) => onSet('weightRight', e.target.value)} />
    </div>
  ) : (
    <input type="number" step="0.5" placeholder={kgPlaceholder} value={s.weight || ''} onChange={(e) => onSet('weight', e.target.value)} />
  );

  return (
    <div class="set-block">
      <div class={`set-inline${doneClass}`}>
        <div class="set-num">{sIdx + 1}</div>
        {repsInput}
        {!uni && (
          <label class="bw-toggle" title="Corpo libero (peso = zavorra aggiunta)">
            <input type="checkbox" checked={!!s.bodyweight} onChange={(e) => onSet('bodyweight', e.target.checked)} />
            <span>BW</span>
          </label>
        )}
        {weightInputs}
        <select value={s.rpe || ''} onChange={(e) => onSet('rpe', e.target.value)}>
          <option value="">RPE</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {live && (s.done
          ? <span class="set-done-check">✓</span>
          : <button class="btn-fatto" onClick={onDone}>Fatto</button>)}
        <button class="btn-icon" onClick={onRemoveSet}>🗑</button>
      </div>
      {!uni && Array.isArray(s.drops) && s.drops.map((d, dIdx) => (
        <div class="drop-inline" key={dIdx}>
          <span class="drop-arrow">↳</span>
          <input type="number" placeholder="Reps" value={d.reps || ''} onChange={(e) => onDrop(dIdx, 'reps', e.target.value)} />
          <input type="number" step="0.5" placeholder="Kg" value={d.weight || ''} onChange={(e) => onDrop(dIdx, 'weight', e.target.value)} />
          <button class="btn-icon" title="Rimuovi drop" onClick={() => onRemoveDrop(dIdx)}>×</button>
        </div>
      ))}
      {!uni && <button class="btn-link-sm" title="Aggiungi un drop set" onClick={onAddDrop}>+ drop</button>}
    </div>
  );
}

// One exercise card. `ex` is the exercise object; `onChange(nextEx)` returns a new one.
export function ExerciseCard({ ex, exIdx, live, optsOpen, onToggleOpts, onChange, onRemove, onCopyLast }) {
  const param = ex.param || 'reps';
  const paramLabel = PARAM_LABELS[param] || 'Reps';
  const bw = ex.barbellWeight || 0;

  const setSets = (nextSets) => onChange({ ...ex, sets: nextSets });

  const lastSet0 = ex.lastPerf?.sets?.[0];
  let lastStr = '';
  if (ex.lastPerf && lastSet0) {
    if (lastSet0.repsLeft != null || lastSet0.repsRight != null) {
      lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x SX ${lastSet0.repsLeft || '?'} / DX ${lastSet0.repsRight || '?'} ${paramLabel}`;
    } else if (lastSet0.weightLeft != null || lastSet0.weightRight != null) {
      lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x${lastSet0.reps || '?'} @ SX ${lastSet0.weightLeft || '?'} / DX ${lastSet0.weightRight || '?'} kg`;
    } else {
      lastStr = `Ultima volta: ${ex.lastPerf.sets.length}x${lastSet0.reps || '?'} @ ${lastSet0.weight || '?'}kg`;
    }
  }

  return (
    <div class="exercise-card">
      <div class="exercise-card-header">
        <span class="exercise-card-name">{ex.name}</span>
        <span class="exercise-card-muscle">{ex.muscle} <span style="font-size:.72rem;color:var(--blue)">{paramLabel}</span></span>
        {live && <button class="btn-icon" style="margin-left:auto" onClick={onRemove}>×</button>}
      </div>
      {lastStr && <div class="exercise-card-last" style="font-size:.75rem;color:var(--text2);margin-bottom:6px">{lastStr}</div>}
      <WeightOptions ex={ex} open={optsOpen} onToggle={onToggleOpts}
        onOpt={(field, value) => onChange(applyWeightOption(ex, field, value, { live }))} />
      {bw ? <div class="barbell-tag">+ {bw}kg bilanciere</div> : null}
      {ex.sets.map((s, sIdx) => (
        <SetRow
          key={sIdx} ex={ex} s={s} sIdx={sIdx} live={live}
          onSet={(field, value) => setSets(ex.sets.map((x, i) => (i === sIdx ? updateSetField(x, field, value) : x)))}
          onDrop={(dIdx, field, value) => setSets(ex.sets.map((x, i) => (i === sIdx ? updateDropField(x, dIdx, field, value) : x)))}
          onAddDrop={() => setSets(ex.sets.map((x, i) => (i === sIdx ? addDrop(x) : x)))}
          onRemoveDrop={(dIdx) => setSets(ex.sets.map((x, i) => (i === sIdx ? removeDrop(x, dIdx) : x)))}
          onRemoveSet={() => setSets(removeSet(ex.sets, sIdx, ex, { live }))}
          onDone={() => onChange({ ...ex, sets: completeSet(ex.sets, sIdx, ex).sets })}
        />
      ))}
      <div style="display:flex;gap:6px;margin-top:4px">
        <button class="btn btn-sm btn-secondary" onClick={() => setSets(addSet(ex.sets, ex, { live }))}>+ Serie</button>
        {/* In live sparisce appena una serie è "Fatto": copiare sovrascriverebbe lavoro completato. */}
        {ex.lastPerf && !(live && ex.sets.some((s) => s.done)) && <button class="copy-set-btn" onClick={onCopyLast}>Copia precedente</button>}
      </div>
    </div>
  );
}
