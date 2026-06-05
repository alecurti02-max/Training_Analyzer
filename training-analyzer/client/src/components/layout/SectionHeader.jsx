// SectionHeader: titolo di card/sezione. Avvolge la classe globale .card-title
// (accent, uppercase, font heading). `aside` opzionale = azione/nota allineata
// a destra (es. "Dettagli →").
export function SectionHeader({ children, aside = null }) {
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
