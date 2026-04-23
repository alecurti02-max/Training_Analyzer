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

  // Tab switching for login/register (supports both class conventions)
  const tabBtns = document.querySelectorAll('.auth-tab-btn, .login-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.auth-tab-panel, .login-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('auth-panel-' + btn.dataset.tab)
        || document.getElementById('login-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // Email login form (supports both ID conventions)
  const loginForm = document.getElementById('email-login-form') || document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') || document.getElementById('login-email-input'))?.value;
      const password = (document.getElementById('login-password') || document.getElementById('login-password-input'))?.value;
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
  const registerForm = document.getElementById('email-register-form') || document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('reg-firstname')?.value?.trim();
      const lastName = document.getElementById('reg-lastname')?.value?.trim();
      const email = (document.getElementById('register-email') || document.getElementById('reg-email'))?.value?.trim();
      const password = (document.getElementById('register-password') || document.getElementById('reg-password'))?.value;
      if (statusEl) statusEl.textContent = 'Registrazione in corso...';
      try {
        await register({ firstName, lastName, email, password });
        window.location.reload();
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Errore: ' + (err.message || 'Registrazione fallita');
      }
    });
  }

  // Toggle show register form
  const showRegLink = document.getElementById('show-register');
  if (showRegLink) {
    showRegLink.addEventListener('click', (e) => {
      e.preventDefault();
      const regForm = document.getElementById('register-form');
      const loginF = document.getElementById('login-form');
      if (regForm) regForm.style.display = regForm.style.display === 'none' ? 'block' : 'none';
      if (loginF) loginF.style.display = loginF.style.display === 'none' ? 'block' : 'none';
    });
  }
}

export function loginWithGoogle() {
  window.location.href = '/api/auth/google';
}

export async function register({ firstName, lastName, email, password }) {
  const data = await api.post('/api/auth/register', { firstName, lastName, email, password });
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
