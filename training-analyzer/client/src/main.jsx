import { render } from 'preact';
import { App } from './App.jsx';
import { mountDashboard, unmountDashboard } from './pages/Dashboard/Dashboard.jsx';

const root = document.getElementById('app');
if (root) render(<App />, root);

// Bridge API for the legacy js/ui.js during the strangler-fig migration.
// As pages migrate to Preact, ui.js delegates rendering to window.Preact.<page>.
// Removed in Fase 8 once ui.js itself is gone.
globalThis.Preact = globalThis.Preact || {};
globalThis.Preact.dashboard = { mount: mountDashboard, unmount: unmountDashboard };
