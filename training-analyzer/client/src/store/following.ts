import { signal } from '@preact/signals';
import { api } from '@/lib/api';

// Mappa "persone che seguo" (social). Forma legacy: oggetto keyed per uid.
export const following = signal<Record<string, any>>({});
let loaded = false;

export function setFollowing(f: Record<string, any> | null | undefined): void {
  following.value = f || {};
}

// Carica una sola volta per sessione (alimentato anche da loadAllData/setFollowing).
export async function loadFollowing(force = false): Promise<void> {
  if (loaded && !force) return;
  loaded = true;
  try {
    const f = await api.get<Record<string, any>>('/api/users/me/following').catch(() => ({}));
    following.value = f || {};
  } catch (e) {
    console.error('Failed to load following:', e);
  }
}

// Segui un utente (oggetto con uid/displayName/photoURL): POST + signal.
export async function followUser(user: { uid: string; displayName?: string; photoURL?: string }): Promise<void> {
  await api.post('/api/users/' + user.uid + '/follow');
  following.value = { ...following.value, [user.uid]: user };
}

export async function unfollowUser(uid: string): Promise<void> {
  await api.del('/api/users/' + uid + '/follow');
  const next = { ...following.value };
  delete next[uid];
  following.value = next;
}
