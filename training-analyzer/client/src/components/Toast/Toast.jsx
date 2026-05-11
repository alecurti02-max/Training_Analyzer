// Singleton toast notification.
// Usage:
//   import { toast, Toast } from '@/components/Toast/Toast.jsx';
//   <Toast />              // mount once near the root
//   toast('Saved!');       // anywhere
//   toast('Failed', 'error');
//
// Signal-driven: no event bus, no portals, just a global signal that <Toast/>
// renders into a fixed element.

import { signal, effect } from '@preact/signals';
import s from './Toast.module.css';

const toastState = signal({ msg: '', type: '', visible: false });
let hideTimer = null;

export function toast(msg, type = '') {
  if (hideTimer) clearTimeout(hideTimer);
  toastState.value = { msg: String(msg || ''), type, visible: true };
  hideTimer = setTimeout(() => {
    toastState.value = { ...toastState.value, visible: false };
  }, 3000);
}

export function Toast() {
  const { msg, type, visible } = toastState.value;
  return (
    <div
      class={[s.toast, visible && s.show, type && s[type]].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      {msg}
    </div>
  );
}

// Cleanup helper for HMR / tests.
export function _resetToast() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  toastState.value = { msg: '', type: '', visible: false };
}
