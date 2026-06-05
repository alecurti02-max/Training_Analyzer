import { signal } from '@preact/signals';

// Pesi corporei (ordinati per data crescente, come in loadAllData).
export const weights = signal<any[]>([]);

export function setWeights(list: any[] | null | undefined): void {
  weights.value = Array.isArray(list) ? list : [];
}
