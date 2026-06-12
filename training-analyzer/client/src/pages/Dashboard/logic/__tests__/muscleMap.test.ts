import { describe, it, expect } from 'vitest';
import { normalizeMuscle, regionsFor, recoveryTone } from '../muscleMap';

// DEFAULT_MUSCLES di js/sports.js, senza 'Full Body' (escluso da getRecoveryStatus)
const DEFAULT_MUSCLES = [
  'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti',
  'Femorali', 'Glutei', 'Polpacci', 'Addominali', 'Avambracci', 'Trapezio',
];

describe('regionsFor', () => {
  it('mappa tutti i DEFAULT_MUSCLES', () => {
    for (const m of DEFAULT_MUSCLES) {
      expect(regionsFor(m), m).not.toBeNull();
      expect(regionsFor(m)!.length).toBeGreaterThan(0);
    }
  });
  it('è case-insensitive e ignora accenti/spazi', () => {
    expect(regionsFor('PETTO')).toEqual(['chest']);
    expect(regionsFor('  petto ')).toEqual(['chest']);
    expect(regionsFor('Glutèi')).toEqual(['glutes']);
  });
  it('risolve i sinonimi', () => {
    expect(regionsFor('Gambe')).toEqual(['quads', 'hamstrings', 'glutes', 'calves']);
    expect(regionsFor('Core')).toEqual(['abs']);
    expect(regionsFor('Addome')).toEqual(['abs']);
    expect(regionsFor('Pettorali')).toEqual(['chest']);
  });
  it('nome sconosciuto → null (fallback chip)', () => {
    expect(regionsFor('Collo')).toBeNull();
    expect(regionsFor('Grip')).toBeNull();
  });
});

describe('normalizeMuscle', () => {
  it('normalizza accenti, maiuscole e spazi', () => {
    expect(normalizeMuscle('  Glutèi ')).toBe('glutei');
  });
});

describe('recoveryTone', () => {
  it('replica le soglie della RecoveryList', () => {
    expect(recoveryTone(100)).toBe('ready');
    expect(recoveryTone(80)).toBe('ok');
    expect(recoveryTone(79)).toBe('mid');
    expect(recoveryTone(50)).toBe('mid');
    expect(recoveryTone(49)).toBe('low');
    expect(recoveryTone(0)).toBe('low');
  });
});
