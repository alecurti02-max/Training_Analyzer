import { signal } from '@preact/signals';

// Stub Fase 7a: stato vista Storico (filtro + selezione). La logica completa
// (selezione multipla, bulk delete) verrà migrata in Fase 7c.
export const historyFilter = signal<string>('all');

export function setHistoryFilter(f: string): void {
  historyFilter.value = f || 'all';
}
