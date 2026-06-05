// BentoGrid: griglia responsive riusabile. Varianti (css/layout.css):
//   auto   → auto-fit minmax(220px,1fr)   (rimpiazza .card-grid)
//   stats  → 4 colonne → 2 (≤900) → 1 (≤480)   (riga telemetria)
//   triple → 3 colonne → 1 (≤900)
//   split  → 1.6fr / 1fr → 1 (≤900)        (zona attività / main-side)
// BentoGrid.Item permette lo span su più colonne.
export function BentoGrid({ cols = 'auto', class: extra = '', children }) {
  return <div class={`lay-bento lay-bento-${cols} ${extra}`.trim()}>{children}</div>;
}

BentoGrid.Item = function BentoItem({ span = 1, children }) {
  return (
    <div class="lay-bento-item" style={span > 1 ? `grid-column:span ${span}` : undefined}>
      {children}
    </div>
  );
};
