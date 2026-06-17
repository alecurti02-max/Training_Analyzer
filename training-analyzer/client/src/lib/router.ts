// Router URL minimale per la navigazione a pagine (Fase 8a).
// Path canonico: '/' = dashboard, '/<page>' per le altre. Gli slug alias
// (es. /live, /athletic) vengono risolti da ui.js::showPage via PAGE_ALIAS,
// dopodiché syncUrl scrive il path canonico. Il fallback SPA lato server
// (app.get('*') → index.html) esiste già; Vite dev è SPA di default.

// Primo segmento del path corrente ('' → 'dashboard').
export function initialSegment(): string {
  try {
    const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
    return seg || 'dashboard';
  } catch {
    return 'dashboard';
  }
}

// Allinea l'URL al path canonico della pagina. pushState solo se il path
// cambia: dopo un popstate il path è già quello giusto → nessun nuovo entry,
// quindi back/forward non si auto-inquinano.
export function syncUrl(page: string): void {
  try {
    const path = page === 'dashboard' ? '/' : '/' + page;
    if (location.pathname !== path) history.pushState({ page }, '', path);
  } catch {
    /* no-op: history non disponibile (vecchi browser / contesti particolari) */
  }
}

// Back/forward del browser → showPage. showPage risolve eventuali alias e
// ri-sincronizza l'URL (senza push, vedi sopra).
export function initRouter(showPage: (page: string) => void): void {
  try {
    addEventListener('popstate', () => {
      showPage(initialSegment());
    });
  } catch {
    /* no-op */
  }
}

// ── Registry mount per-pagina (M3, smantellamento ui.js) ───────────────────
// Le pagine migrate a Preact registrano qui il proprio mount self-contained
// (host + render + wiring + tab restore). showPage (ancora in ui.js mentre lo
// si smonta) consulta il registry: se la pagina è registrata usa quel mount,
// altrimenti cade sul branch legacy. Una pagina alla volta passa dal branch al
// registry, finché showPage non diventa pura navigazione generica.
export type PageMount = () => void;
const pageHandlers: Record<string, PageMount> = {};

export function registerPage(name: string, mount: PageMount): void {
  pageHandlers[name] = mount;
}

export function getPageHandler(name: string): PageMount | undefined {
  return pageHandlers[name];
}
