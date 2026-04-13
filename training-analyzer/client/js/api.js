// ==================== API MODULE ====================
// Centralized HTTP layer. The ONLY file that calls fetch() for backend API.

let _accessToken = null;

function getRefreshToken() {
  return localStorage.getItem('ta_refresh_token');
}

function setRefreshToken(token) {
  if (token) localStorage.setItem('ta_refresh_token', token);
  else localStorage.removeItem('ta_refresh_token');
}

export function setTokens(access, refresh) {
  _accessToken = access;
  setRefreshToken(refresh);
}

export function getAccessToken() {
  return _accessToken;
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('ta_refresh_token');
}

async function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh })
    });
    if (!res.ok) return false;
    const data = await res.json();
    _accessToken = data.accessToken || data.token;
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return true;
  } catch (e) {
    console.error('Token refresh failed:', e);
    return false;
  }
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  // Add Authorization header if we have a token
  if (_accessToken) {
    headers['Authorization'] = 'Bearer ' + _accessToken;
  }

  // Set Content-Type for JSON bodies (but not for FormData uploads)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = { ...options, headers };

  let res = await fetch(url, fetchOptions);

  // Auto-refresh on 401 token_expired (retry once)
  if (res.status === 401) {
    let errorData;
    try { errorData = await res.json(); } catch (e) { errorData = {}; }

    if (errorData.code === 'token_expired' || errorData.error === 'token_expired') {
      const refreshed = await refreshTokens();
      if (refreshed) {
        // Retry the request with the new token
        headers['Authorization'] = 'Bearer ' + _accessToken;
        const retryOptions = { ...options, headers };
        res = await fetch(url, retryOptions);
      } else {
        // Persistent 401: clear tokens and redirect to login
        clearTokens();
        window.location.reload();
        throw new Error('Session expired');
      }
    } else {
      // Non-token 401: clear and redirect
      clearTokens();
      window.location.reload();
      throw new Error('Unauthorized');
    }
  }

  if (!res.ok) {
    let errorData;
    try { errorData = await res.json(); } catch (e) { errorData = { message: res.statusText }; }
    const error = new Error(errorData.message || errorData.error || 'API Error');
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  // Return parsed JSON, or null for 204
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get(url) {
    return apiFetch(url, { method: 'GET' });
  },

  post(url, body) {
    return apiFetch(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  },

  put(url, body) {
    return apiFetch(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  },

  del(url) {
    return apiFetch(url, { method: 'DELETE' });
  },

  upload(url, formData) {
    return apiFetch(url, {
      method: 'POST',
      body: formData
      // No Content-Type header — browser sets it with boundary for multipart
    });
  }
};
