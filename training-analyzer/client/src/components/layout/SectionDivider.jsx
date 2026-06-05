// SectionDivider: etichetta-eyebrow mono che separa zone tematiche di una
// pagina (es. "▸ Prontezza & corpo"). Stile in css/layout.css (.lay-section).
export function SectionDivider({ children }) {
  return <div class="lay-section">{children}</div>;
}
