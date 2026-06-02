// Theme toggle: light/dark con persistenza in localStorage.
//
// Pattern: il button vive in index.html (nav-right) per essere mostrato anche
// prima che Preact monti. Lo script anti-FOUC in <head> applica il tema iniziale.
// Qui aggiungiamo solo il click handler + sync con un signal per HMR-safety.

import { signal, effect } from '@preact/signals';

const STORAGE_KEY = 'ta_theme';
// dark-first (skin Carbon): solo una preferenza OS esplicitamente "light" sceglie light,
// altrimenti dark. Deve combaciare con lo script anti-FOUC in index.html.
const systemPrefersLight = () => window.matchMedia('(prefers-color-scheme: light)').matches;

const initialTheme = localStorage.getItem(STORAGE_KEY)
  || (systemPrefersLight() ? 'light' : 'dark');

export const themeSignal = signal(initialTheme);

effect(() => {
  document.documentElement.dataset.theme = themeSignal.value;
  localStorage.setItem(STORAGE_KEY, themeSignal.value);
});

export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    themeSignal.value = themeSignal.value === 'dark' ? 'light' : 'dark';
    // Forza redraw dei chart se Dashboard e' attiva: rileggono le CSS custom
    // properties via getComputedStyle. Re-invocare renderDashboard via showPage.
    if (document.documentElement.dataset.activePage === 'dashboard'
        && typeof window.showPage === 'function') {
      window.showPage('dashboard');
    }
  });
}
