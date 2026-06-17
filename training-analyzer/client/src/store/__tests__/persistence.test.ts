import { describe, it, expect, beforeEach } from 'vitest';
import { weights, setWeights, upsertWeight } from '../weights';
import { workouts, setWorkouts, fillDefaultMuscles } from '../workouts';

// Le azioni con API (postWorkout/persist*/delete*) non sono unit-testate qui
// (toccano la rete); copriamo le trasformazioni PURE sui signal.

describe('upsertWeight', () => {
  beforeEach(() => setWeights([]));

  it('inserisce e tiene la lista ordinata per data crescente', () => {
    upsertWeight({ id: 'a', date: '2026-06-10', value: 80 });
    upsertWeight({ id: 'b', date: '2026-06-01', value: 81 });
    upsertWeight({ id: 'c', date: '2026-06-20', value: 79 });
    expect(weights.value.map((w) => w.date)).toEqual(['2026-06-01', '2026-06-10', '2026-06-20']);
  });

  it('aggiorna in upsert il peso di una data già presente (no duplicati)', () => {
    upsertWeight({ id: 'a', date: '2026-06-10', value: 80 });
    upsertWeight({ id: 'a2', date: '2026-06-10', value: 78.5 });
    expect(weights.value).toHaveLength(1);
    expect(weights.value[0].value).toBe(78.5);
  });

  it('non muta l\'array precedente del signal (nuovo riferimento)', () => {
    setWeights([{ id: 'a', date: '2026-06-10', value: 80 }]);
    const before = weights.value;
    upsertWeight({ id: 'b', date: '2026-06-11', value: 79 });
    expect(weights.value).not.toBe(before);
    expect(before).toHaveLength(1); // il vecchio array è intatto
  });
});

describe('fillDefaultMuscles', () => {
  beforeEach(() => setWorkouts([]));

  it('gym → invariato (i muscoli vengono dagli esercizi)', () => {
    const w = { id: '1', type: 'gym', date: '2026-06-10' };
    expect(fillDefaultMuscles(w).muscles).toBeUndefined();
  });

  it('non-gym senza muscles → riempito coi default dello sport', () => {
    const w: any = { id: '2', type: 'running', date: '2026-06-10' };
    fillDefaultMuscles(w);
    expect(Array.isArray(w.muscles)).toBe(true);
    expect(w.muscles.length).toBeGreaterThan(0);
  });

  it('non-gym con muscles espliciti → invariato', () => {
    const w: any = { id: '3', type: 'running', date: '2026-06-10', muscles: ['Quadricipiti'] };
    fillDefaultMuscles(w);
    expect(w.muscles).toEqual(['Quadricipiti']);
  });
});
