import { render } from 'preact';
import { App } from './App.jsx';
import { initThemeToggle } from './components/ThemeToggle/ThemeToggle.jsx';
import { mountDashboard, unmountDashboard } from './pages/Dashboard/Dashboard.jsx';
import { mountHistory, unmountHistory } from './pages/History/History.jsx';
import {
  mountFitnessAssessment,
  mountAthleticDetail,
  computeAthleticMetrics,
  unmountProfile,
} from './pages/Profile/Profile.jsx';
import { mountSports, mountMuscleGroups, unmountSetup } from './pages/Setup/Setup.jsx';
import { mountBmiBanner, unmountBody } from './pages/Body/Body.jsx';
import { mountTrain, unmountTrain } from './pages/Train/Train.jsx';

const root = document.getElementById('app');
if (root) render(<App />, root);

// Wire the theme toggle button (markup in index.html nav-right).
initThemeToggle();

// Bridge API for the legacy js/ui.js during the strangler-fig migration.
// As pages migrate to Preact, ui.js delegates rendering to window.Preact.<page>.
// Removed in Fase 8 once ui.js itself is gone.
globalThis.Preact = globalThis.Preact || {};
globalThis.Preact.dashboard = { mount: mountDashboard, unmount: unmountDashboard };
globalThis.Preact.history = { mount: mountHistory, unmount: unmountHistory };
globalThis.Preact.profile = {
  mountFitness: mountFitnessAssessment,
  mountAthletic: mountAthleticDetail,
  computeAthleticMetrics,
  unmount: unmountProfile,
};
globalThis.Preact.setup = {
  mountSports,
  mountMuscleGroups,
  unmount: unmountSetup,
};
globalThis.Preact.body = {
  mountBmiBanner,
  unmount: unmountBody,
};
// Train (wizard + live) — behind the ta_train_preact flag in ui.js. Unlike the
// snapshot pages above, Train owns its own interactive state once mounted.
globalThis.Preact.train = {
  mount: mountTrain,
  unmount: unmountTrain,
};
