import { render } from 'preact';
import { PageShell, Card } from '@/components/layout';

// Corpo — route .tsx (WRAP). Scheletro con i 3 tab (Log rapido/Misure/Andamenti)
// e TUTTI gli id che bodyMeasurements.js, ui.js::renderWeightPage e il
// BmiBanner Preact usano. Input misure con data-settings → auto-save via
// wireDirectInputListeners (ui.js). Tab esterni via delega data-tab-group;
// sub-tab Peso/Misurazione via delega [data-bm-logtab]. Look 1:1.
export function BodyPage() {
  return (
    <PageShell eyebrow="04 · CORPO" title="Corpo">
      {/* N1: Corpo ingloba il Recupero (Alimentazione + Sonno come tab).
          La logica resta in js/recovery.js, richiamata da ui.js. */}
      <div class="lay-tabbar">
        <button class="bm-tab active" data-tab-group="body" data-tab="quicklog">Peso</button>
        <button class="bm-tab" data-tab-group="body" data-tab="measures">Misure</button>
        <button class="bm-tab" data-tab-group="body" data-tab="nutrition">Alimentazione</button>
        <button class="bm-tab" data-tab-group="body" data-tab="sleep">Sonno</button>
        <button class="bm-tab" data-tab-group="body" data-tab="trend">Andamenti</button>
      </div>

      <div data-tab-content="quicklog">
        <Card>
          <div class="card-title">Panoramica</div>
          <div id="bm-summary" />
          <div id="weight-bmi-section" style="margin-top:12px" />
        </Card>

        <Card>
          <div class="card-title">Registra</div>
          <div class="bm-log-tabs" style="display:flex;gap:6px;margin-bottom:12px">
            <button class="bm-tab active" data-bm-logtab="weight">Peso</button>
            <button class="bm-tab" data-bm-logtab="full">Misurazione completa</button>
          </div>
          <div id="bm-logtab-weight">
            <div class="weight-form">
              <div class="form-group"><label>Data</label><input type="date" id="weight-date" /></div>
              <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" id="weight-value" placeholder="75.0" style="font-size:1.1rem" /></div>
              <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary" data-action="saveWeight">Salva</button></div>
            </div>
          </div>
          <div id="bm-logtab-full" style="display:none">
            <div id="bm-form" />
          </div>
        </Card>

        <Card>
          <div class="card-title">Obiettivo e altezza</div>
          <div class="form-row">
            <div class="form-group"><label>Peso Target (kg)</label><input type="number" step="0.1" id="weight-target" placeholder="70.0" data-action="saveWeightTarget" /></div>
            <div class="form-group"><label>Altezza (cm) per BMI</label><input type="number" id="weight-height" placeholder="175" data-action="saveWeightHeight" /></div>
          </div>
        </Card>
      </div>

      <div data-tab-content="measures" style="display:none">
        <Card>
          <div class="card-title">Circonferenze Corporee (cm)</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Misurazioni per il profilo atletico e il monitoraggio della composizione corporea.</p>
          <div class="form-row">
            <div class="form-group"><label>Petto</label><input type="number" id="set-circ-chest" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group"><label>Vita</label><input type="number" id="set-circ-waist" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group"><label>Fianchi</label><input type="number" id="set-circ-hips" step="0.5" placeholder="cm" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Spalle</label><input type="number" id="set-circ-shoulders" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group"><label>Bicipite</label><input type="number" id="set-circ-bicep" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group"><label>Collo</label><input type="number" id="set-circ-neck" step="0.5" placeholder="cm" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Coscia</label><input type="number" id="set-circ-thigh" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group"><label>Polpaccio</label><input type="number" id="set-circ-calf" step="0.5" placeholder="cm" data-settings="true" /></div>
            <div class="form-group" />
          </div>
        </Card>
        <Card>
          <div class="card-title">Composizione Corporea (opzionale)</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Valori tipicamente forniti da bilance impedenziometriche. Compila solo i campi che puoi misurare.</p>
          <div class="form-row">
            <div class="form-group"><label>Massa grassa (%)</label><input type="number" id="set-body-fat" step="0.1" min="0" max="70" placeholder="%" data-settings="true" /></div>
            <div class="form-group"><label>Muscoli scheletrici (%)</label><input type="number" id="set-skeletal-muscle" step="0.1" min="0" max="70" placeholder="%" data-settings="true" /></div>
            <div class="form-group"><label>Acqua corporea (%)</label><input type="number" id="set-body-water" step="0.1" min="0" max="90" placeholder="%" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Grasso sottocutaneo (%)</label><input type="number" id="set-subcutaneous-fat" step="0.1" min="0" max="60" placeholder="%" data-settings="true" /></div>
            <div class="form-group"><label>Grasso viscerale</label><input type="number" id="set-visceral-fat" step="0.1" min="0" max="60" placeholder="indice" data-settings="true" /></div>
            <div class="form-group"><label>Proteine (%)</label><input type="number" id="set-protein" step="0.1" min="0" max="40" placeholder="%" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Massa muscolare (kg)</label><input type="number" id="set-muscle-mass" step="0.1" min="0" max="120" placeholder="kg" data-settings="true" /></div>
            <div class="form-group"><label>Massa ossea (kg)</label><input type="number" id="set-bone-mass" step="0.1" min="0" max="10" placeholder="kg" data-settings="true" /></div>
            <div class="form-group" />
          </div>
        </Card>
      </div>

      {/* ===== ALIMENTAZIONE (ex Recupero) — id usati da js/recovery.js ===== */}
      <div data-tab-content="nutrition" style="display:none">
        <Card hud>
          <div class="card-title">Oggi</div>
          <div id="nutrition-today-summary" />
        </Card>
        <Card>
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
        </Card>
        <Card>
          <div class="card-title">Storico</div>
          <div id="nutrition-history" />
        </Card>
      </div>

      {/* ===== SONNO (ex Recupero) ===== */}
      <div data-tab-content="sleep" style="display:none">
        <Card hud>
          <div class="card-title">Stanotte</div>
          <div id="sleep-today-summary" />
        </Card>
        <Card>
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
        </Card>
        <Card>
          <div class="card-title">Storico</div>
          <div id="sleep-history" />
        </Card>
      </div>

      <div data-tab-content="trend" style="display:none">
        <Card>
          <div class="card-title">Andamenti</div>
          <div id="bm-tabs-container" />
          <canvas id="chart-weight" style="display:none" />
          <div id="weight-stats" style="display:none" />
        </Card>
        <Card>
          <div class="card-title">Storico misurazioni</div>
          <div id="bm-history" />
        </Card>
      </div>
    </PageShell>
  );
}

export function mountBodyPage({ host }: { host: HTMLElement }) {
  if (host) render(<BodyPage />, host);
}

export function unmountBodyPage(host?: HTMLElement) {
  const el = host || document.getElementById('body-host');
  if (el) render(null, el);
}
