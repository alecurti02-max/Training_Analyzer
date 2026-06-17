// Badge BMI sull'ultimo peso + altezza (port da Body.jsx, ora componente puro).
export function BmiBanner({ latestWeight, height }: { latestWeight?: number | null; height?: number | null }) {
  if (!height) return <p style="font-size:0.8rem;color:var(--text2)">Inserisci l'altezza per il BMI.</p>;
  if (!latestWeight) return null;
  const heightM = height / 100;
  const bmi = +(latestWeight / (heightM * heightM)).toFixed(1);
  let cat: string; let cls: string;
  if (bmi < 18.5) { cat = 'Sottopeso'; cls = 'bmi-underweight'; }
  else if (bmi < 25) { cat = 'Normopeso'; cls = 'bmi-normal'; }
  else if (bmi < 30) { cat = 'Sovrappeso'; cls = 'bmi-overweight'; }
  else { cat = 'Obeso'; cls = 'bmi-obese'; }
  return <span class={`bmi-badge ${cls}`}>BMI {bmi} — {cat}</span>;
}
