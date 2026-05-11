// Body page — BMI banner only for now.
//
// The bulk of Body page (weight log, measurements table, charts, avatar)
// is delegated to bodyMeasurements.js + bodyAvatar.js — already modular,
// so we don't migrate them here. Only the small BMI banner moves to Preact
// because it's pure presentation over latest weight + height.

import { render } from 'preact';

function BmiBanner({ latestWeight, height }) {
  if (!height) {
    return <p style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>Inserisci l'altezza per il BMI.</p>;
  }
  if (!latestWeight) return null;
  const heightM = height / 100;
  const bmi = (latestWeight / (heightM * heightM)).toFixed(1);
  let cat, cls;
  if (bmi < 18.5) { cat = 'Sottopeso'; cls = 'bmi-underweight'; }
  else if (bmi < 25) { cat = 'Normopeso'; cls = 'bmi-normal'; }
  else if (bmi < 30) { cat = 'Sovrappeso'; cls = 'bmi-overweight'; }
  else { cat = 'Obeso'; cls = 'bmi-obese'; }
  return <span class={`bmi-badge ${cls}`}>BMI {bmi} — {cat}</span>;
}

export function mountBmiBanner({ weights, settings }) {
  const el = document.getElementById('weight-bmi-section');
  if (!el) return;
  const latest = weights.length ? weights[weights.length - 1] : null;
  const heightInput = document.getElementById('weight-height');
  const height = settings.height || parseInt(heightInput?.value);
  render(<BmiBanner latestWeight={latest?.value} height={height} />, el);
}

export function unmountBody() {
  const el = document.getElementById('weight-bmi-section');
  if (el) render(null, el);
}
