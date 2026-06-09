import type { ComponentChildren } from 'preact';

// Toolbar: riga "contenuto a sinistra / controlli a destra" ripetuta in
// Storico, Setup, Corpo. FilterBar: gruppo di chip-filtro controllato che
// emette i .filter-btn globali.
interface ToolbarProps {
  left?: ComponentChildren;
  right?: ComponentChildren;
  children?: ComponentChildren;
}

export function Toolbar({ left = null, right = null, children }: ToolbarProps) {
  return (
    <div class="lay-toolbar">
      <div class="lay-toolbar-left">{left ?? children}</div>
      {right && <div class="lay-toolbar-right">{right}</div>}
    </div>
  );
}

interface FilterOption {
  key: string;
  label: string;
}

interface FilterBarProps {
  options?: FilterOption[];
  value: string;
  onChange: (key: string) => void;
}

export function FilterBar({ options = [], value, onChange }: FilterBarProps) {
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
