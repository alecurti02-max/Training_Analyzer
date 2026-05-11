// User signal + auth actions.
//
// Components subscribe with `currentUser.value` — they auto re-render on change.
// Don't mutate currentUser directly outside this module. Use login/logout/setUser.

import { signal } from '@preact/signals';
import { api, setTokens, clearTokens } from '@/lib/api.js';

export const currentUser = signal(null);

export async function login({ email, password }) {
  const res = await api.post('/api/auth/login', { email, password });
  setTokens(res.accessToken, res.refreshToken);
  currentUser.value = res.user;
  return res.user;
}

export async function register({ email, password, firstName, lastName }) {
  const res = await api.post('/api/auth/register', { email, password, firstName, lastName });
  setTokens(res.accessToken, res.refreshToken);
  currentUser.value = res.user;
  return res.user;
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (_) {
    // Best-effort: even if server fails, clear local state.
  }
  clearTokens();
  currentUser.value = null;
}

// Set the current user from an already-issued token (page reload after refresh, etc.)
export function setUser(user) {
  currentUser.value = user;
}
