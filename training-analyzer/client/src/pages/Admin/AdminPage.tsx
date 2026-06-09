import { render } from 'preact';
import { PageShell, Card } from '@/components/layout';

// Admin — route .tsx (WRAP). Rende lo scheletro (PageShell + i container con gli
// id che admin.js si aspetta); la logica legacy (js/admin.js::renderAdmin) resta
// invariata e popola gli id dopo il mount (chiamata da ui.js). Look 1:1; il
// porting completo (stats/tabella/grafici in .tsx) potrà arrivare in seguito.
export function AdminPage() {
  return (
    <PageShell eyebrow="09 · ADMIN" title="Admin">
      <div class="card-grid" id="admin-stats" />
      <div class="dash-layout">
        <div class="dash-col-main">
          <Card>
            <div class="card-title">Registrazioni ultimi 30 giorni</div>
            <div class="chart-container"><canvas id="admin-chart-signups" /></div>
          </Card>
          <Card>
            <div class="card-title">Utenti registrati</div>
            <div id="admin-users-table" />
            <div id="admin-users-pager" style="margin-top:12px;display:flex;gap:8px;justify-content:center;align-items:center" />
          </Card>
        </div>
        <div class="dash-col-side">
          <Card>
            <div class="card-title">Allenamenti per sport</div>
            <div class="chart-container" style="height:260px"><canvas id="admin-chart-sports" /></div>
          </Card>
          <Card>
            <div class="card-title">Provider login</div>
            <div id="admin-providers" />
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

export function mountAdmin({ host }: { host: HTMLElement }) {
  if (host) render(<AdminPage />, host);
}

export function unmountAdmin(host?: HTMLElement) {
  const el = host || document.getElementById('admin-host');
  if (el) render(null, el);
}
