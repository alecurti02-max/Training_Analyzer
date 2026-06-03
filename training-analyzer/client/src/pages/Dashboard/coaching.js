// Frase di coaching della Dashboard hero.
//
// VERSIONE A REGOLE (gratis, istantanea, sempre disponibile): compone una frase
// breve da streak + recupero muscolare + ultimo allenamento (getAdvice).
//
// === SEAM AI (TODO, attivazione futura) ===
// In futuro arricchire/sostituire con il coach AI premium:
//   POST /api/profile/coach-summary  → { summary, recommendations[] }  (premium-gated, 1/giorno).
// Mantenere QUESTA firma e il campo `source`: un futuro buildCoachingAI() potrà
// restituire { text, source: 'ai' } con fallback a buildCoaching() (rules) se
// l'utente non è premium o la chiamata fallisce.

import { getAdvice } from '@/scoring';

export function buildCoaching({ workouts = [], recovery, streak, settings = {} } = {}) {
  const parts = [];

  if (streak && streak.current > 0) {
    parts.push(`${streak.current} ${streak.current === 1 ? 'giorno' : 'giorni'} di striscia`);
  }

  let tail = null;
  if (recovery && recovery.suggestedRestDays > 0) {
    tail = `carico alto negli ultimi 7gg, consigliati ${recovery.suggestedRestDays} gg di scarico`;
  } else if (workouts.length) {
    try {
      const a = getAdvice(workouts[0], workouts, settings);
      const sug = (a && a.suggestions || []).find((s) => s.priority === 'high') || (a && a.suggestions || [])[0];
      if (sug && sug.text) tail = sug.text.charAt(0).toLowerCase() + sug.text.slice(1);
    } catch (e) { /* rules fallback below */ }
  }
  if (!tail && recovery) {
    const ready = Object.entries(recovery.muscleRecovery || {})
      .filter(([, i]) => i.pct >= 90)
      .map(([m]) => m);
    if (ready.length) tail = `${ready.slice(0, 2).join(' e ')} pront${ready.length > 1 ? 'i' : 'o'} per un nuovo stimolo`;
  }
  if (tail) parts.push(tail);

  if (!parts.length) parts.push('sistema pronto — registra una sessione per attivare la telemetria');

  let text = parts.join('. ');
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return { text, source: 'rules' };
}
