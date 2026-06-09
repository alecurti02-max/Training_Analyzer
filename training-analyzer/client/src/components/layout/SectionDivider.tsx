import type { ComponentChildren } from 'preact';

// SectionDivider: etichetta-eyebrow mono che separa zone tematiche di una
// pagina (es. "Prontezza & corpo"). Stile in css/layout.css (.lay-section).
interface SectionDividerProps {
  children?: ComponentChildren;
}

export function SectionDivider({ children }: SectionDividerProps) {
  return <div class="lay-section">{children}</div>;
}
