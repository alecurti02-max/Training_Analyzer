import { render } from 'preact';
import { PageShell } from '@/components/layout';

// Recupero — route .tsx (WRAP). Rende lo scheletro (tab + form + container con
// gli id che recovery.js si aspetta); la logica legacy (js/recovery.js:
// renderRecoveryPage / saveNutritionLog / saveSleepLog) resta INVARIATA. I tab
// (data-tab-group="recovery") e i pulsanti (data-action) continuano via la
// delega globale di ui.js. Look 1:1.
export function RecoveryPage() {
  return (
    <PageShell eyebrow="06 · RECUPERO" title="Recupero">
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="bm-tab active" data-tab-group="recovery" data-tab="nutrition">Alimentazione</button>
        <button class="bm-tab" data-tab-group="recovery" data-tab="sleep">Sonno</button>
      </div>

      <div data-tab-content="nutrition">
        <div class="card">
          <div class="card-title">Oggi</div>
          <div id="nutrition-today-summary" />
        </div>
        <div class="card">
          <div class="card-title">Registra giornata</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Inserisci i totali della giornata. Se esiste gi&agrave; un record per la data, viene aggiornato.</p>
          <div class="form-row">
            <div class="form-group"><label>Data</label><input type="date" id="nut-date" /></div>
            <div class="form-group"><label>Calorie (kcal)</label><input type="number" min="0" step="1" id="nut-calories" placeholder="es. 2200" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Proteine (g)</label><input type="number" min="0" step="0.1" id="nut-protein" placeholder="es. 140" /></div>
            <div class="form-group"><label>Carboidrati (g)</label><input type="number" min="0" step="0.1" id="nut-carbs" placeholder="es. 250" /></div>
            <div class="form-group"><label>Grassi (g)</label><input type="number" min="0" step="0.1" id="nut-fat" placeholder="es. 70" /></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Note (opz.)</label><input type="text" id="nut-notes" placeholder="es. cena fuori, surplus weekend..." /></div>
            <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" data-action="saveNutritionLog">Salva</button></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Storico</div>
          <div id="nutrition-history" />
        </div>
      </div>

      <div data-tab-content="sleep" style="display:none">
        <div class="card">
          <div class="card-title">Stanotte</div>
          <div id="sleep-today-summary" />
        </div>
        <div class="card">
          <div class="card-title">Registra notte</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">La data si riferisce al <strong>giorno del risveglio</strong>. Se esiste gi&agrave; un record per la data, viene aggiornato.</p>
          <div class="form-row">
            <div class="form-group"><label>Data</label><input type="date" id="slp-date" /></div>
            <div class="form-group"><label>Durata (ore)</label><input type="number" min="0" max="24" step="0.25" id="slp-duration" placeholder="es. 7.5" /></div>
            <div class="form-group"><label>Qualit&agrave; (1-10)</label><input type="number" min="1" max="10" step="1" id="slp-quality" placeholder="es. 7" /></div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1"><label>Note (opz.)</label><input type="text" id="slp-notes" placeholder="es. risveglio notturno, sogni vividi..." /></div>
            <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" data-action="saveSleepLog">Salva</button></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Storico</div>
          <div id="sleep-history" />
        </div>
      </div>
    </PageShell>
  );
}

export function mountRecovery({ host }: { host: HTMLElement }) {
  if (host) render(<RecoveryPage />, host);
}

export function unmountRecovery(host?: HTMLElement) {
  const el = host || document.getElementById('recovery-host');
  if (el) render(null, el);
}
