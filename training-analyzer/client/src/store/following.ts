import { signal } from '@preact/signals';

// Mappa "persone che seguo" (social). Forma legacy: oggetto keyed.
export const following = signal<Record<string, any>>({});

export function setFollowing(f: Record<string, any> | null | undefined): void {
  following.value = f || {};
}
