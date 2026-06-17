import { render } from 'preact';
import { useState } from 'preact/hooks';
import { PageShell } from '@/components/layout';
import { MeTab } from './MeTab';
import { AthleticTab } from './AthleticTab';
import { FriendsTab } from './FriendsTab';
import { CoachTab } from './CoachTab';

// Profilo — route .tsx AUTONOMA (M3): 4 tab Preact (Mio profilo, Atletica, Amici,
// Coach). Niente più wrap: renderProfile/renderAthleticDetail/renderFriendsPageLocal
// rimossi da ui.js. Atletica usa i componenti di Profile.jsx + bodyAvatar.js
// (wrap) + radar Chart.js; Amici legge il signal following.
const TABS = [
  { key: 'me', label: 'Mio profilo' },
  { key: 'athletic', label: 'Atletica' },
  { key: 'friends', label: 'Amici' },
  { key: 'coach', label: 'Coach' },
];

export function ProfilePage() {
  const [tab, setTab] = useState('me');
  return (
    <PageShell eyebrow="05 · PROFILO" title="Profilo">
      <div class="lay-tabbar">
        {TABS.map((t) => (
          <button key={t.key} class={`bm-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'me' && <MeTab />}
      {tab === 'athletic' && <AthleticTab />}
      {tab === 'friends' && <FriendsTab />}
      {tab === 'coach' && <CoachTab />}
    </PageShell>
  );
}

// Mount self-contained (registry router): host in #page-profile, nasconde il
// markup legacy fratello, render. Registrato in main.jsx.
export function mountProfilePage(): void {
  const pageEl = document.getElementById('page-profile');
  if (!pageEl) return;
  let host = document.getElementById('profile-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'profile-host';
    pageEl.appendChild(host);
  }
  Array.from(pageEl.children).forEach((c) => { (c as HTMLElement).style.display = c === host ? '' : 'none'; });
  render(<ProfilePage />, host);
}

export function unmountProfilePage(): void {
  const el = document.getElementById('profile-host');
  if (el) render(null, el);
}
