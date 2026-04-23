// ==================== PLAN HELPERS ====================
// Client-side gating for premium features. Server-side enforcement lives in
// server/src/middleware/requirePremium.js — this module is UX only.

export function isPremium(user) {
  return !!(user && user.plan === 'premium');
}

export function requirePremiumUI(user, { onLocked } = {}) {
  if (isPremium(user)) return true;
  if (typeof onLocked === 'function') onLocked();
  return false;
}
