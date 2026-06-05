// Hud: wrapper che applica i tick angolari del cockpit (.cc-hud) a un blocco
// qualsiasi (es. hero, next-up). Token-driven via skin Carbon.
export function Hud({ class: extra = '', children }) {
  return <div class={`cc-hud ${extra}`.trim()}>{children}</div>;
}
