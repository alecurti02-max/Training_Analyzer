import type { ComponentChildren } from 'preact';

// SectionHeader: titolo di card/sezione. Avvolge la classe globale .card-title.
// `aside` opzionale = azione/nota allineata a destra (es. "Dettagli →").
interface SectionHeaderProps {
  children?: ComponentChildren;
  aside?: ComponentChildren;
}

export function SectionHeader({ children, aside = null }: SectionHeaderProps) {
  if (aside) {
    return (
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>{children}</span>
        <span class="card-title-aside">{aside}</span>
      </div>
    );
  }
  return <div class="card-title">{children}</div>;
}
