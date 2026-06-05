// Toolbar: riga "contenuto a sinistra / controlli a destra" ripetuta in
// Storico, Setup, Corpo. FilterBar: gruppo di chip-filtro controllato che
// emette i .filter-btn globali (così resta coerente con lo stile attuale).
export function Toolbar({ left = null, right = null, children }) {
  return (
    <div class="lay-toolbar">
      <div class="lay-toolbar-left">{left ?? children}</div>
      {right && <div class="lay-toolbar-right">{right}</div>}
    </div>
  );
}

export function FilterBar({ options = [], value, onChange }) {
  return (
    <div class="lay-filterbar">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          class={`filter-btn${value === o.key ? ' active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
