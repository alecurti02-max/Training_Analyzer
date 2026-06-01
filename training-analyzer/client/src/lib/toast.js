// Toast notification — DOM side-effect helper (targets #toast in index.html).
// Extracted from the legacy js/ modules (ui.js, import.js, friends.js) so the
// legacy code and new Preact components share a single implementation.
// Kept out of utils.js, which is intentionally pure (no DOM access).
export function toast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 3000);
}
