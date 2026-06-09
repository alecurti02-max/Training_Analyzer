import type { ComponentChildren } from 'preact';

// BentoGrid: griglia responsive riusabile. Varianti (css/layout.css):
//   auto   → auto-fit minmax(220px,1fr)   (rimpiazza .card-grid)
//   stats  → 4 colonne → 2 (≤900) → 1 (≤480)   (riga telemetria)
//   triple → 3 colonne → 1 (≤900)
//   split  → 1.6fr / 1fr → 1 (≤900)        (zona attività / main-side)
type BentoCols = 'auto' | 'stats' | 'triple' | 'split';

interface BentoGridProps {
  cols?: BentoCols;
  class?: string;
  children?: ComponentChildren;
}

function BentoGridBase({ cols = 'auto', class: extra = '', children }: BentoGridProps) {
  return <div class={`lay-bento lay-bento-${cols} ${extra}`.trim()}>{children}</div>;
}

interface BentoItemProps {
  span?: number;
  children?: ComponentChildren;
}

function BentoItem({ span = 1, children }: BentoItemProps) {
  return (
    <div class="lay-bento-item" style={span > 1 ? `grid-column:span ${span}` : undefined}>
      {children}
    </div>
  );
}

// BentoGrid.Item per lo span su più colonne.
export const BentoGrid = Object.assign(BentoGridBase, { Item: BentoItem });
