// PageShell: cornice di pagina. Rende la classe .cc-surface sul proprio root —
// l'hook che (dopo il de-scope dei cc-* in skin-carbon.css) abilita le
// decorazioni cockpit su QUALSIASI pagina, non solo la Dashboard.
//
// Header opzionale: se passi `eyebrow`/`title` rende l'header generico
// (.lay-eyebrow/.lay-title, stesso look del .page::before/::after attuale).
// Pagine con header proprio (es. Dashboard con .dash-header editoriale) non
// passano eyebrow/title e rendono il loro header come primo child.
export function PageShell({ eyebrow = null, title = null, toolbar = null, class: extra = '', children }) {
  const hasHead = eyebrow || title || toolbar;
  return (
    <div class={`cc-surface lay-shell ${extra}`.trim()}>
      {hasHead && (
        <header class="lay-page-head">
          <div class="lay-page-head-text">
            {eyebrow && <p class="lay-eyebrow">{eyebrow}</p>}
            {title && <h1 class="lay-title">{title}</h1>}
          </div>
          {toolbar && <div class="lay-page-head-tools">{toolbar}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
