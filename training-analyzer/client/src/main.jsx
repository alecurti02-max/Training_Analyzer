import { render } from 'preact';
import { App } from './App.jsx';
import { initThemeToggle } from './components/ThemeToggle/ThemeToggle.jsx';
import { mountDashboard, unmountDashboard } from './pages/Dashboard/DashboardPage';
import { mountHistory, unmountHistory, mountHistoryPage } from './pages/History/HistoryPage';
import { registerPage } from './lib/router';
import {
  mountFitnessAssessment,
  mountAthleticDetail,
  computeAthleticMetrics,
  unmountProfile,
} from './pages/Profile/Profile.jsx';
import { mountSports, mountMuscleGroups, unmountSetup } from './pages/Setup/Setup.jsx';
import { mountTrain, unmountTrain } from './pages/Train/Train.jsx';
import { mountAdmin, unmountAdmin } from './pages/Admin/AdminPage';
import { mountClienti, unmountClienti } from './pages/Clienti/ClientiPage';
import { mountBodyPage, unmountBodyPage } from './pages/Body/BodyPage';
import { mountSetupPage, unmountSetupPage } from './pages/Setup/SetupPage';
import { mountProfilePage, unmountProfilePage } from './pages/Profile/ProfilePage';

// Skin "carbon" — fallback difensivo. Normalmente lo imposta lo <script> inline
// anti-FOUC in index.html (prima del paint, via hash CSP). Se quell'inline viene
// bloccato dalla CSP, qui lo riapplichiamo da JS esterno (consentito da 'self'),
// così lo skin si attiva comunque. Idempotente: non sovrascrive se già presente.
try {
  const de = document.documentElement;
  if (!de.dataset.skin) {
    let sk = null;
    try { sk = localStorage.getItem('ta_skin'); } catch (e) { /* storage bloccato */ }
    de.dataset.skin = sk || 'carbon';
  }
} catch (e) { /* no-op */ }

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
// M3: registry router-driven. History è la prima pagina con mount self-contained
// (host+render in src/); ui.js::showPage lo prende dal registry invece del
// proprio branch legacy. Le altre pagine seguiranno una alla volta.
registerPage('history', mountHistoryPage);
globalThis.Preact.profile = {
  mount: mountProfilePage,
  unmountPage: unmountProfilePage,
  mountFitness: mountFitnessAssessment,
  mountAthletic: mountAthleticDetail,
  computeAthleticMetrics,
  unmount: unmountProfile,
};
globalThis.Preact.setup = {
  mount: mountSetupPage,
  unmountPage: unmountSetupPage,
  mountSports,
  mountMuscleGroups,
  unmount: unmountSetup,
};
// Corpo (M3): pagina autonoma registrata nel router. Niente più bridge BMI/wrap.
registerPage('body', mountBodyPage);
globalThis.Preact.body = { mount: mountBodyPage, unmount: unmountBodyPage };
// N1/N2: Recupero è fuso in Corpo (tab) e Progressi è sciolto in Dashboard
// (Analisi) + Profilo (Atletica): niente più bridge progress/recovery.
// Train (wizard + live) — behind the ta_train_preact flag in ui.js. Unlike the
// snapshot pages above, Train owns its own interactive state once mounted.
globalThis.Preact.train = {
  mount: mountTrain,
  unmount: unmountTrain,
};
globalThis.Preact.admin = { mount: mountAdmin, unmount: unmountAdmin };
globalThis.Preact.clienti = { mount: mountClienti, unmount: unmountClienti };
