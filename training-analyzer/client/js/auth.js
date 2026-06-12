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

  // CRM F4 — registrazione Personal Trainer: il path dedicato /register-pt
  // (servito dallo stesso index.html via SPA fallback) apre direttamente il
  // form di registrazione email con label dedicata e registra con asTrainer.
  // Nessun toggle nel form standard: un utente B2C non si auto-flagga per sbaglio.
  const isPtSignup = window.location.pathname === '/register-pt';

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
      const email = (document.getElementById('login-email-input') || document.getElementById('login-email'))?.value;
      const password = (document.getElementById('login-password-input') || document.getElementById('login-password'))?.value;
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
        await register({ firstName, lastName, email, password, asTrainer: isPtSignup });
        // Torna alla root: lo slug register-pt non è una pagina dell'app.
        if (isPtSignup) { window.location.href = '/'; return; }
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

  // /register-pt: attiva il tab email, mostra subito il form di registrazione
  // con l'intestazione PT (riusa la stessa logica dei listener sopra).
  if (isPtSignup) {
    const emailTab = [...document.querySelectorAll('.auth-tab-btn, .login-tab')]
      .find((b) => b.dataset.tab === 'email');
    if (emailTab) emailTab.click();
    const regForm = document.getElementById('register-form');
    const loginF = document.getElementById('login-form');
    if (regForm) {
      regForm.style.display = 'block';
      if (!document.getElementById('pt-signup-banner')) {
        const banner = document.createElement('p');
        banner.id = 'pt-signup-banner';
        banner.textContent = 'Registrazione Personal Trainer — il tuo account potrà gestire clienti e schede.';
        banner.style.cssText = 'font-size:.82rem;color:var(--accent);font-weight:600;margin-bottom:8px';
        regForm.parentNode.insertBefore(banner, regForm);
      }
    }
    if (loginF) loginF.style.display = 'none';
  }
}

export function loginWithGoogle() {
  window.location.href = '/api/auth/google';
}

export async function register({ firstName, lastName, email, password, asTrainer = false }) {
  const data = await api.post('/api/auth/register', {
    firstName, lastName, email, password,
    ...(asTrainer ? { asTrainer: true } : {}),
  });
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
