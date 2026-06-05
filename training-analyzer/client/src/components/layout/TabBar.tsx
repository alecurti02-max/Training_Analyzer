// TabBar: switcher di sotto-tab controllato (stato locale al componente, via
// onClick) che emette i .bm-tab globali. Sostituisce la delega data-tab-group
// di ui.js quando una pagina possiede il proprio markup.
interface TabDef {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs?: TabDef[];
  value: string;
  onChange: (key: string) => void;
  class?: string;
}

export function TabBar({ tabs = [], value, onChange, class: extra = '' }: TabBarProps) {
  return (
    <div class={`lay-tabbar ${extra}`.trim()}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          class={`bm-tab${value === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
