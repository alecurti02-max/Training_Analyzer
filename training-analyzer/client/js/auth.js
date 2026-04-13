// ==================== AUTH MODULE ====================
// Authentication: login, register, Google OAuth, session management

import { api, setTokens, getAccessToken, clearTokens } from './api.js';

/**
 * initAuth: check for OAuth return tokens in URL, try silent refresh, or call onLogout.
 */
export async function initAuth(onLogin, onLogout) {
  // 1. Check URL for ?token=xxx&refresh=yyy (Google OAuth redirect return)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refresh = params.get('refresh');

  if (token && refresh) {
    setTokens(token, refresh);
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const user = await api.get('/api/users/me/profile');
      onLogin(user);
      return;
    } catch (e) {
      console.error('Failed to fetch profile after OAuth:', e);
      clearTokens();
    }
  }

  // 2. Try silent refresh from localStorage
  const savedRefresh = localStorage.getItem('ta_refresh_token');
  if (savedRefresh) {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefresh })
      });
      if (res.ok) {
        const data = await res.json();
        setTokens(data.accessToken || data.token, data.refreshToken || savedRefresh);
        const user = await api.get('/api/users/me/profile');
        onLogin(user);
        return;
      }
    } catch (e) {
      console.warn('Silent refresh failed:', e);
    }
    clearTokens();
  }

  // 3. Neither worked
  onLogout();
}

/**
 * setupLoginUI: set up login screen tabs and handlers
 */
export function setupLoginUI() {
  const statusEl = document.getElementById('login-status');

  // Google login button
  const googleBtn = document.getElementById('btn-google-login');
  if (googleBtn) {
    googleBtn.onclick = () => {
      if (statusEl) statusEl.textContent = 'Connessione in corso...';
      loginWithGoogle();
    };
  }

  // Tab switching for login/register
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('auth-panel-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // Email login form
  const loginForm = document.getElementById('email-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      if (statusEl) statusEl.textContent = 'Accesso in corso...';
      try {
        await login(email, password);
        window.location.reload();
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Errore: ' + (err.message || 'Login fallito');
      }
    });
  }

  // Register form
  const registerForm = document.getElementById('email-register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const displayName = document.getElementById('register-name').value;
      if (statusEl) statusEl.textContent = 'Registrazione in corso...';
      try {
        await register(email, password, displayName);
        window.location.reload();
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Errore: ' + (err.message || 'Registrazione fallita');
      }
    });
  }
}

export function loginWithGoogle() {
  window.location.href = '/api/auth/google';
}

export async function register(email, password, displayName) {
  const data = await api.post('/api/auth/register', { email, password, displayName });
  setTokens(data.accessToken || data.token, data.refreshToken);
  return data.user || data;
}

export async function login(email, password) {
  const data = await api.post('/api/auth/login', { email, password });
  setTokens(data.accessToken || data.token, data.refreshToken);
  return data.user || data;
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (e) {
    console.warn('Logout API call failed:', e);
  }
  clearTokens();
}
