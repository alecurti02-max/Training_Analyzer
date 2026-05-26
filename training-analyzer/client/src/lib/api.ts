// Centralized HTTP client. Auto-refresh on 401, JWT tokens, error shape parsing.
// The access token lives in memory; the refresh token persists in localStorage.
//
// Designed to be a drop-in replacement for the legacy client/js/api.js so
// migrated Preact pages can `import { api } from '@/lib/api'` without
// reimplementing fetch logic. Stays simple — no caching layer (signals
// in store/ are responsible for cache state).

import { signal } from '@preact/signals';
import type { ApiErrorShape } from '@/types';

const REFRESH_KEY = 'ta_refresh_token';
const accessToken = signal<string | null>(null);

export function getAccessToken(): string | null {
  return accessToken.value;
}

export function setTokens(access: string | null | undefined, refresh?: string | null): void {
  accessToken.value = access || null;
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else if (refresh === null) localStorage.removeItem(REFRESH_KEY);
}

export function clearTokens(): void {
  accessToken.value = null;
  localStorage.removeItem(REFRESH_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

interface RefreshResponseBody {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
}

async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json() as RefreshResponseBody;
    accessToken.value = data.accessToken || data.token || null;
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch (e) {
    console.error('Token refresh failed:', e);
    return false;
  }
}

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

function buildHeaders(options: FetchOptions): Record<string, string> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (accessToken.value) headers['Authorization'] = 'Bearer ' + accessToken.value;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function parseErrorCode(errorData: ApiErrorShape): string | null {
  if (errorData.code) return errorData.code;
  if (typeof errorData.error === 'object' && errorData.error?.code) return errorData.error.code;
  if (typeof errorData.error === 'string') return errorData.error;
  return null;
}

async function handle401(url: string, options: FetchOptions, errorData: ApiErrorShape): Promise<Response> {
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

interface ApiCallError extends Error {
  status: number;
  code: string | null;
  data: ApiErrorShape;
}

async function apiFetch<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  let res = await fetch(url, { ...options, headers: buildHeaders(options) });
  if (res.status === 401) {
    let errorData: ApiErrorShape;
    try { errorData = await res.json() as ApiErrorShape; } catch (_) { errorData = {}; }
    res = await handle401(url, options, errorData);
  }
  if (!res.ok) {
    let errorData: ApiErrorShape;
    try { errorData = await res.json() as ApiErrorShape; } catch (_) { errorData = { message: res.statusText }; }
    const nestedMsg = errorData.error && typeof errorData.error === 'object' ? errorData.error.message : null;
    const error: ApiCallError = Object.assign(
      new Error(
        errorData.message || nestedMsg
          || (typeof errorData.error === 'string' ? errorData.error : null)
          || res.statusText || 'API Error',
      ),
      {
        status: res.status,
        code: parseErrorCode(errorData),
        data: errorData,
      },
    );
    throw error;
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

interface ApiClient {
  get<T = any>(url: string): Promise<T>;
  post<T = any>(url: string, body?: unknown): Promise<T>;
  put<T = any>(url: string, body?: unknown): Promise<T>;
  del<T = any>(url: string): Promise<T>;
  upload<T = any>(url: string, formData: FormData): Promise<T>;
  analyzeWorkout<T = any>(id: string, opts?: { force?: boolean }): Promise<T>;
  clearWorkoutAnalysis<T = any>(id: string): Promise<T>;
}

export const api: ApiClient = {
  get: <T = any>(url: string) => apiFetch<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: unknown) => apiFetch<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: unknown) => apiFetch<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),
  upload: <T = any>(url: string, formData: FormData) => apiFetch<T>(url, { method: 'POST', body: formData }),
  analyzeWorkout: <T = any>(id: string, opts: { force?: boolean } = {}) => apiFetch<T>(
    `/api/workouts/${encodeURIComponent(id)}/analyze`,
    { method: 'POST', body: JSON.stringify({ force: opts.force ?? false }) },
  ),
  clearWorkoutAnalysis: <T = any>(id: string) => apiFetch<T>(
    `/api/workouts/${encodeURIComponent(id)}/analyze`,
    { method: 'DELETE' },
  ),
};

// Read-only signal export so components can react to login/logout.
// Don't mutate this directly — use setTokens()/clearTokens().
export { accessToken };
