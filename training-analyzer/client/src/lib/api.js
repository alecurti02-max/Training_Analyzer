// Centralized HTTP client. Auto-refresh on 401, JWT tokens, error shape parsing.
// The access token lives in memory; the refresh token persists in localStorage.
//
// Designed to be a drop-in replacement for the legacy client/js/api.js so
// migrated Preact pages can `import { api } from '@/lib/api.js'` without
// reimplementing fetch logic. Stays simple — no caching layer (signals
// in store/ are responsible for cache state).

import { signal } from '@preact/signals';

const REFRESH_KEY = 'ta_refresh_token';
const accessToken = signal(null);

export function getAccessToken() {
  return accessToken.value;
}

export function setTokens(access, refresh) {
  accessToken.value = access || null;
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else if (refresh === null) localStorage.removeItem(REFRESH_KEY);
}

export function clearTokens() {
  accessToken.value = null;
  localStorage.removeItem(REFRESH_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

async function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken.value = data.accessToken || data.token || null;
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch (e) {
    console.error('Token refresh failed:', e);
    return false;
  }
}

function buildHeaders(options) {
  const headers = { ...(options.headers || {}) };
  if (accessToken.value) headers['Authorization'] = 'Bearer ' + accessToken.value;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function parseErrorCode(errorData) {
  return errorData.code
    || errorData.error?.code
    || (typeof errorData.error === 'string' ? errorData.error : null);
}

async function handle401(url, options, errorData) {
  const code = parseErrorCode(errorData);
  // Server's authenticate middleware nests code as `error.code`, hence the
  // double check — the legacy flat-only lookup silently booted users after
  // 15 min idle (fixed by reading from both shapes).
  const isAuthIssue = code === 'token_expired' || code === 'no_token' || code === 'invalid_token' || !code;
  if (!isAuthIssue) {
    clearTokens();
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('Unauthorized');
  }
  const refreshed = await refreshTokens();
  if (!refreshed) {
    clearTokens();
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('Session expired');
  }
  const retry = await fetch(url, { ...options, headers: buildHeaders(options) });
  if (retry.status === 401) {
    clearTokens();
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('Session expired');
  }
  return retry;
}

async function apiFetch(url, options = {}) {
  let res = await fetch(url, { ...options, headers: buildHeaders(options) });
  if (res.status === 401) {
    let errorData;
    try { errorData = await res.json(); } catch (_) { errorData = {}; }
    res = await handle401(url, options, errorData);
  }
  if (!res.ok) {
    let errorData;
    try { errorData = await res.json(); } catch (_) { errorData = { message: res.statusText }; }
    const nestedMsg = errorData.error && typeof errorData.error === 'object' ? errorData.error.message : null;
    const error = new Error(
      errorData.message || nestedMsg
        || (typeof errorData.error === 'string' ? errorData.error : null)
        || res.statusText || 'API Error'
    );
    error.status = res.status;
    error.code = parseErrorCode(errorData);
    error.data = errorData;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (url) => apiFetch(url, { method: 'GET' }),
  post: (url, body) => apiFetch(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: (url) => apiFetch(url, { method: 'DELETE' }),
  upload: (url, formData) => apiFetch(url, { method: 'POST', body: formData }),
  analyzeWorkout: (id, { force = false } = {}) => apiFetch(
    `/api/workouts/${encodeURIComponent(id)}/analyze`,
    { method: 'POST', body: JSON.stringify({ force }) }
  ),
  clearWorkoutAnalysis: (id) => apiFetch(
    `/api/workouts/${encodeURIComponent(id)}/analyze`,
    { method: 'DELETE' }
  ),
};

// Read-only signal export so components can react to login/logout.
// Don't mutate this directly — use setTokens()/clearTokens().
export { accessToken };
