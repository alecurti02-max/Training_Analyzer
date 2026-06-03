// Store degli allenamenti PROGRAMMATI (PlannedWorkout). Usa l'api Preact
// (token condiviso con il login legacy via setTokens).
import { signal } from '@preact/signals';
import { api } from '@/lib/api';

export const plannedWorkouts = signal([]);
let loaded = false;

export async function loadPlans(force = false) {
  if (loaded && !force) return plannedWorkouts.value;
  try {
    const rows = await api.get('/api/planned-workouts');
    plannedWorkouts.value = Array.isArray(rows) ? rows : [];
    loaded = true;
  } catch (e) {
    plannedWorkouts.value = [];
  }
  return plannedWorkouts.value;
}

export async function savePlan(plan) {
  const saved = await api.post('/api/planned-workouts', plan); // upsert (userId, date)
  await loadPlans(true);
  return saved;
}

export async function deletePlan(id) {
  await api.del('/api/planned-workouts/' + encodeURIComponent(id));
  await loadPlans(true);
}

// Allenamento programmato più imminente (date >= today), altrimenti null.
export function nextPlan(plans, today) {
  return (plans || [])
    .filter((p) => p.date >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] || null;
}
