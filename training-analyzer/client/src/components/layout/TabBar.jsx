// TabBar: switcher di sotto-tab controllato (stato locale al componente, via
// onClick) che emette i .bm-tab globali. Sostituisce la delega data-tab-group
// di ui.js quando una pagina possiede il proprio markup (modello Train).
export function TabBar({ tabs = [], value, onChange, class: extra = '' }) {
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
