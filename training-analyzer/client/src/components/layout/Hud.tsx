import type { ComponentChildren } from 'preact';

// Hud: wrapper che applica i tick angolari del cockpit (.cc-hud) a un blocco
// qualsiasi (es. hero, next-up). Token-driven via skin Carbon.
interface HudProps {
  class?: string;
  children?: ComponentChildren;
}

export function Hud({ class: extra = '', children }: HudProps) {
  return <div class={`cc-hud ${extra}`.trim()}>{children}</div>;
}
