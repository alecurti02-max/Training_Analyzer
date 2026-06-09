import type { ComponentChildren } from 'preact';

// PageShell: cornice di pagina. Rende la classe .cc-surface sul proprio root —
// l'hook che (dopo il de-scope dei cc-* in skin-carbon.css) abilita le
// decorazioni cockpit su QUALSIASI pagina, non solo la Dashboard.
//
// Header opzionale: se passi `eyebrow`/`title` rende l'header generico
// (.lay-eyebrow/.lay-title). Pagine con header proprio (es. Dashboard
// editoriale) non passano eyebrow/title e rendono il loro header come child.
interface PageShellProps {
  eyebrow?: string | null;
  title?: string | null;
  toolbar?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function PageShell({
  eyebrow = null,
  title = null,
  toolbar = null,
  class: extra = '',
  children,
}: PageShellProps) {
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
