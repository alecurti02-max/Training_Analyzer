// Train page container — "Manuale" (wizard) + "Live" tabs. Mounts the Preact
// Train UI into a single host element when the ta_train_preact flag is on. Legacy
// #page-train markup stays in index.html and is hidden by the bridge while this
// renders, so flipping the flag off restores the vanilla path instantly.

import { render } from 'preact';
import { useState } from 'preact/hooks';
import { currentUser } from '@/store/user.js';
import { setTrainData, setTrainBridge } from '@/store/train.js';
import { LogWizard } from './LogWizard.jsx';
import { LiveSession } from './LiveSession.jsx';

function TrainApp() {
  const [tab, setTab] = useState('manual');
  const userId = currentUser.value?.uid || 'anon';
  return (
    <div>
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class={`bm-tab${tab === 'manual' ? ' active' : ''}`} onClick={() => setTab('manual')}>Manuale</button>
        <button class={`bm-tab${tab === 'live' ? ' active' : ''}`} onClick={() => setTab('live')}>Live</button>
      </div>
      {tab === 'manual'
        ? <LogWizard key={`wiz-${userId}`} userId={userId} />
        : <LiveSession key={`live-${userId}`} userId={userId} />}
    </div>
  );
}

// Bridge-facing mount. `host` is the element to render into; `data` is the
// {workouts, settings, exercises} snapshot; `bridge` supplies saveWorkout/onSaved.
export function mountTrain({ host, data, bridge }) {
  if (!host) return;
  if (data) setTrainData(data);
  if (bridge) setTrainBridge(bridge);
  render(<TrainApp />, host);
}

export function unmountTrain(host) {
  if (host) render(null, host);
}
