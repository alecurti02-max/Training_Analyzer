// Strangler-fig entry point.
// During the migration, this Preact app coexists with the legacy js/ui.js,
// which still owns the DOM outside of <div id="app">. As pages are migrated
// (Fase 5+), this component will start taking over routes.
//
// For Fase 1, App renders nothing visible — it's a passthrough that proves
// the build pipeline works. Open ?preact=1 to see the smoke banner.

export function App() {
  const enabled = new URLSearchParams(globalThis.location?.search || '').get('preact') === '1';
  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'var(--race, #E11D2C)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}
    >
      Preact ON · Fase 1 OK
    </div>
  );
}
