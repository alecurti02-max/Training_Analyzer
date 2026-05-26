// Profile page — fitness assessment (basic + athletic) and athletic detail metrics.
//
// renderProfile() (avatar/name/email/uid fills) stays in ui.js: it's 6 lines
// of textContent updates, no value in converting. Migrating here only the
// pieces that build complex HTML (#fitness-assessment, #athletic-fitness-assessment,
// #athletic-detail-cards). The radar Chart.js stays imperative in ui.js.

import { render } from 'preact';
import { getFitnessAssessment } from '@/scoring';
import { todayStr, daysBetween, scoreColor } from '@/lib/utils.js';

// Detail row inside the fitness card (label + progress bar + value).
function FitnessBar({ label, pct, value, color, sublabel }) {
  return (
    <>
      <div class="fitness-bar-row">
        <span class="fb-label">{label}</span>
        <div class="fb-track">
          <div class="fb-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span style={{ fontSize: '0.75rem', width: 80, textAlign: 'right', color: 'var(--text2)' }}>
          {value}
        </span>
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginLeft: 90, marginBottom: 8 }}>
          {sublabel}
        </div>
      )}
    </>
  );
}

// ── Profile main: small fitness card (no body-comp breakdown) ──
function FitnessAssessmentBasic({ fa }) {
  return (
    <div class="fitness-card">
      <div class="fitness-score" style={{ color: fa.levelColor }}>{fa.score}%</div>
      <div class="fitness-label" style={{ color: fa.levelColor }}>{fa.level}</div>
      <div class="fitness-detail">
        Valutazione basata su forza, cardio, endurance, composizione corporea, flessibilita e atleticita
      </div>
      <div class="fitness-bars">
        {fa.details.map((d) => (
          <FitnessBar key={d.label} {...d} />
        ))}
      </div>
    </div>
  );
}

// ── Athletic detail: fitness card with sublabels + body composition breakdown ──
function FitnessAssessmentAthletic({ fa }) {
  const bc = fa.bodyComp;
  return (
    <>
      <div class="fitness-card">
        <div class="fitness-score" style={{ color: fa.levelColor }}>{fa.score}%</div>
        <div class="fitness-label" style={{ color: fa.levelColor }}>{fa.level}</div>
        <div class="fitness-bars" style={{ marginTop: 16 }}>
          {fa.details.map((d) => (
            <FitnessBar key={d.label} {...d} />
          ))}
        </div>
      </div>

      {bc && bc.components && bc.components.length > 0 && (
        <div class="card" style={{ marginTop: 12 }}>
          <div class="card-title">Composizione Corporea — Dettaglio</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 12 }}>
            Peso nel punteggio totale: <strong>{bc.weight}%</strong> (più dati inserisci, più peso ha).
          </p>
          <div class="fitness-bars">
            {bc.components.map((c) => {
              const pct = Math.round((c.score / 10) * 100);
              const color = c.score >= 7 ? 'var(--green)' : c.score >= 4 ? 'var(--yellow)' : 'var(--red)';
              return (
                <div class="fitness-bar-row" key={c.label}>
                  <span class="fb-label">
                    {c.label}
                    {c.fallback && (
                      <span style={{ color: 'var(--text2)', fontSize: '0.7rem' }}> (fallback)</span>
                    )}
                  </span>
                  <div class="fb-track">
                    <div class="fb-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', width: 80, textAlign: 'right', color: 'var(--text2)' }}>
                    {c.value} · {c.score.toFixed(1)}/10
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bc && bc.reason === 'gender-missing' && (
        <div class="advice-box" style={{ marginTop: 12, borderLeft: '3px solid var(--yellow)' }}>
          <strong>Composizione corporea non valutata:</strong> imposta il <strong>sesso</strong> in Impostazioni per attivare la valutazione (le soglie di riferimento sono differenti per uomo e donna).
        </div>
      )}

      <div class="advice-box" style={{ marginTop: 12 }}>
        <strong>Calcolati automaticamente:</strong> Forza (1RM e carichi), Cardio (pace e FC), Endurance (consistenza e km), Atleticita (varieta sport).<br />
        <strong>Da inserire manualmente:</strong> VO2 Max, FC Riposo, Peso, Altezza, Flessibilita (Impostazioni).<br />
        <strong>Composizione corporea (opzionale):</strong> circonferenze e valori bilancia impedenziometrica aumentano il peso del sub-score nel punteggio totale (15% → 35%).
      </div>
    </>
  );
}

// ── Athletic Detail metric cards (forza, resistenza, ...) ──
function AthleticMetricCard({ label, value, icon, desc }) {
  return (
    <div class="card athletic-metric-card">
      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{icon}</div>
      <div class="athletic-metric-value" style={{ color: scoreColor(value) }}>{value.toFixed(1)}</div>
      <div class="athletic-metric-label">{label}</div>
      <div class="athletic-metric-desc">{desc}</div>
    </div>
  );
}

function AthleticMetrics({ metrics }) {
  return <>{metrics.map((m) => <AthleticMetricCard key={m.label} {...m} />)}</>;
}

// ── Compute the metrics shown in the athletic detail page ──
function computeAthleticMetrics({ workouts, settings }) {
  const now = todayStr();
  const last30 = workouts.filter((w) => daysBetween(now, w.date) <= 30);
  const gymW = last30.filter((w) => w.type === 'gym');
  const runW = last30.filter((w) => w.type === 'running');

  const forza = gymW.length ? Math.min(10, gymW.reduce((s, w) => s + (w.scores?.volume || 5), 0) / gymW.length) : 3;
  const totalKm = runW.reduce((s, w) => s + (w.distance || 0), 0);
  const resistenza = Math.min(10, Math.max(2, totalKm / 5));
  const uniqueDays = new Set(last30.map((w) => w.date)).size;
  const consistenza = Math.min(10, Math.max(2, uniqueDays / 3));
  const highRPE = last30.filter((w) => (w.rpe || w.scores?.overall || 5) >= 8).length;
  const recupero = Math.max(3, 10 - highRPE);
  const progressione = gymW.length
    ? gymW.reduce((s, w) => s + (w.scores?.progression || 5), 0) / gymW.length
    : 5;
  const muscleSet = new Set();
  gymW.forEach((w) => (w.exercises || []).forEach((e) => { if (e.muscle) muscleSet.add(e.muscle); }));
  const typesUsed = new Set(last30.map((w) => w.type)).size;
  const varieta = Math.min(10, Math.max(2, muscleSet.size + typesUsed * 2));

  const circ = {
    chest: settings.circChest, waist: settings.circWaist, hips: settings.circHips,
    bicep: settings.circBicep, thigh: settings.circThigh, calf: settings.circCalf,
    neck: settings.circNeck, shoulders: settings.circShoulders,
  };
  const circCount = Object.values(circ).filter((v) => v && v > 0).length;
  let proporzioni = 5;
  let circDesc = 'Inserisci le circonferenze corporee nelle Impostazioni per una valutazione completa.';
  if (circCount >= 3) {
    let circScore = 5;
    if (circ.waist && circ.hips) {
      const whr = circ.waist / circ.hips;
      const isMale = settings.gender !== 'F';
      const idealWHR = isMale ? 0.9 : 0.8;
      circScore += whr <= idealWHR ? 2 : (whr <= idealWHR + 0.1 ? 1 : -1);
    }
    if (circ.shoulders && circ.waist) {
      const swr = circ.shoulders / circ.waist;
      circScore += swr >= 1.6 ? 2 : (swr >= 1.4 ? 1 : 0);
    }
    if (circ.bicep) circScore += circ.bicep >= 35 ? 1 : 0;
    proporzioni = Math.min(10, Math.max(2, circScore));
    const parts = [];
    if (circ.waist && circ.hips) parts.push(`WHR: ${(circ.waist / circ.hips).toFixed(2)}`);
    if (circ.shoulders && circ.waist) parts.push(`Spalle/Vita: ${(circ.shoulders / circ.waist).toFixed(2)}`);
    parts.push(`${circCount} misurazioni inserite`);
    circDesc = parts.join(' | ') + '. ' + (proporzioni >= 7 ? 'Ottime proporzioni atletiche!' : 'Continua a lavorare sulle proporzioni.');
  }

  return {
    radarValues: [forza, resistenza, consistenza, recupero, progressione, varieta, proporzioni],
    metrics: [
      { label: 'Forza', value: forza, icon: '\u{1F4AA}', desc: gymW.length
        ? `Basato sul volume medio di ${gymW.length} sessioni palestra negli ultimi 30 giorni. Tonnellaggio medio: ${Math.round(gymW.reduce((s, w) => s + (w._tonnage || 0), 0) / gymW.length)} kg.`
        : 'Nessuna sessione palestra negli ultimi 30 giorni.' },
      { label: 'Resistenza', value: resistenza, icon: '\u{1FAC0}',
        desc: `${totalKm.toFixed(1)} km totali corsi negli ultimi 30 giorni.${runW.length ? ' Media ' + Math.round(totalKm / runW.length * 10) / 10 + ' km/sessione.' : ''}` },
      { label: 'Consistenza', value: consistenza, icon: '\u{1F4C5}',
        desc: `${uniqueDays} giorni di allenamento su 30. ${uniqueDays >= 15 ? 'Ottima costanza!' : uniqueDays >= 8 ? 'Buona regolarita.' : 'Prova ad allenarti piu spesso.'}` },
      { label: 'Recupero', value: recupero, icon: '\u{1F50B}',
        desc: `${highRPE} sessioni ad alta intensita (RPE >= 8) negli ultimi 30 giorni. ${recupero >= 7 ? 'Buon equilibrio intensita/recupero.' : 'Attenzione al sovrallenamento.'}` },
      { label: 'Progressione', value: progressione, icon: '\u{1F4C8}',
        desc: gymW.length ? `Score medio di progressione carichi: ${progressione.toFixed(1)}/10. ${progressione >= 7 ? 'Stai migliorando costantemente!' : 'Prova a incrementare gradualmente i carichi.'}` : 'Serve almeno una sessione palestra.' },
      { label: 'Varieta', value: varieta, icon: '\u{1F3AF}',
        desc: `${muscleSet.size} gruppi muscolari allenati, ${typesUsed} sport diversi praticati. ${varieta >= 7 ? 'Allenamento ben bilanciato!' : 'Prova a variare di piu gli stimoli.'}` },
      { label: 'Proporzioni', value: proporzioni, icon: '\u{1F4D0}', desc: circDesc },
    ],
  };
}

// ── Public mount APIs ──
export function mountFitnessAssessment({ workouts, settings, weights, muscleGroups }) {
  const fa = getFitnessAssessment(workouts, settings, weights, muscleGroups);
  const el = document.getElementById('fitness-assessment');
  if (el) render(<FitnessAssessmentBasic fa={fa} />, el);
}

export function mountAthleticDetail({ workouts, settings, weights, muscleGroups }) {
  const fa = getFitnessAssessment(workouts, settings, weights, muscleGroups);
  const { metrics } = computeAthleticMetrics({ workouts, settings });

  const elAthleticFa = document.getElementById('athletic-fitness-assessment');
  if (elAthleticFa) render(<FitnessAssessmentAthletic fa={fa} />, elAthleticFa);

  const elCards = document.getElementById('athletic-detail-cards');
  if (elCards) render(<AthleticMetrics metrics={metrics} />, elCards);
}

export { computeAthleticMetrics };

export function unmountProfile() {
  for (const id of ['fitness-assessment', 'athletic-fitness-assessment', 'athletic-detail-cards']) {
    const el = document.getElementById(id);
    if (el) render(null, el);
  }
}
