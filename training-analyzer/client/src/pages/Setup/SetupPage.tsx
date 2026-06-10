import { render } from 'preact';
import { PageShell, Card } from '@/components/layout';

// Setup — route .tsx (WRAP). Scheletro con i 3 tab (Libreria/Import/Impostazioni)
// e TUTTI gli id che ui.js (libreria esercizi, settings) e import.js (drop zone)
// usano. I listener diretti (drop zone, file input, lib-filter, lib-barbell,
// data-settings) vengono riagganciati da ui.js::wireDirectInputListeners dopo
// il mount. Pulsanti via delega data-action. Look 1:1.
export function SetupPage() {
  return (
    <PageShell eyebrow="06 · SETUP" title="Setup">
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="bm-tab active" data-tab-group="setup" data-tab="library">Libreria</button>
        <button class="bm-tab" data-tab-group="setup" data-tab="import">Import</button>
        <button class="bm-tab" data-tab-group="setup" data-tab="settings">Impostazioni</button>
      </div>

      <div data-tab-content="library">
        <Card>
          <div class="card-title">Aggiungi Esercizio</div>
          <div class="form-row">
            <div class="form-group"><label>Nome Esercizio</label><input type="text" id="lib-name" placeholder="Squat" /></div>
            <div class="form-group"><label>Gruppo Muscolare (primario)</label><select id="lib-muscle" /></div>
            <div class="form-group"><label>Parametro principale</label>
              <select id="lib-param">
                <option value="reps">Ripetizioni (reps)</option>
                <option value="duration">Durata (secondi)</option>
                <option value="distance">Distanza (metri)</option>
                <option value="calories">Calorie (kcal)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Muscoli secondari (opzionale)</label>
              <div id="lib-secondary-muscles" class="muscle-chips" />
            </div>
          </div>
          <div class="form-row" id="lib-weight-options">
            <div class="form-group"><label>Modalita peso</label>
              <select id="lib-weightmode">
                <option value="total">Peso totale</option>
                <option value="per_side">Peso per lato</option>
              </select>
            </div>
            <div class="form-group"><label>Bilanciere</label>
              <select id="lib-barbell">
                <option value="">Nessun bilanciere</option>
                <option value="20">Olimpico (20 kg)</option>
                <option value="10">EZ (10 kg)</option>
                <option value="25">Trap Bar (25 kg)</option>
                <option value="custom">Personalizzato...</option>
              </select>
            </div>
            <div class="form-group" id="lib-barbell-custom-group" style="display:none">
              <label>Peso bilanciere (kg)</label>
              <input type="number" step="0.5" id="lib-barbell-custom" placeholder="15" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="align-self:flex-end">
              <label style="display:flex;align-items:center;gap:6px;margin-bottom:0">
                <input type="checkbox" id="lib-unilateral" style="width:auto" />
                <span>Esercizio unilaterale (un lato alla volta)</span>
              </label>
            </div>
            <div class="form-group" style="align-self:flex-end"><button class="btn btn-primary btn-sm" data-action="addExerciseToLibrary">Aggiungi</button></div>
          </div>
        </Card>
        <Card>
          <div class="card-title">Gruppi Muscolari</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Gestisci i gruppi muscolari. Quelli predefiniti non si possono rimuovere.</p>
          <div id="muscle-groups-list" style="margin-bottom:12px" />
          <div class="form-row" style="margin-bottom:0">
            <div class="form-group" style="margin-bottom:0"><input type="text" id="new-muscle-group" placeholder="Nuovo gruppo muscolare..." /></div>
            <div class="form-group" style="align-self:flex-end;margin-bottom:0"><button class="btn btn-primary btn-sm" data-action="addMuscleGroup">Aggiungi</button></div>
          </div>
        </Card>
        <Card>
          <div class="card-title">Libreria Esercizi</div>
          <div class="form-group" style="margin-bottom:12px">
            <input type="text" id="lib-filter" placeholder="Filtra esercizi..." />
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="lib-muscle-filters" />
          <div id="exercise-library-list" />
        </Card>
      </div>

      <div data-tab-content="import" style="display:none">
        <div class="lay-section">Sorgenti dati</div>
        <div class="lay-bento lay-bento-pair">
        <Card>
          <div class="card-title">Import GPX (Garmin Running)</div>
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">Esporta i file .gpx da Garmin Connect e trascinali qui.</p>
          <div class="drop-zone" id="gpx-drop">
            <p>Trascina qui i file .gpx oppure clicca per selezionare</p>
            <input type="file" id="gpx-file" accept=".gpx" multiple style="display:none" />
          </div>
          <div id="gpx-preview" style="margin-top:12px" />
        </Card>
        <Card>
          <div class="card-title">Import CSV (Dati Palestra)</div>
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:8px">Formato: <code>data,esercizio,serie,reps,peso_kg,rpe</code></p>
          <div class="drop-zone" id="csv-drop">
            <p>Trascina qui un file .csv</p>
            <input type="file" id="csv-file" accept=".csv" style="display:none" />
          </div>
          <div id="csv-preview" style="margin-top:12px" />
        </Card>
        <Card>
          <div class="card-title">Import Apple Health (export.xml)</div>
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">Da iPhone: Salute &gt; profilo &gt; Esporta dati Salute.</p>
          <div class="drop-zone" id="health-drop">
            <p>Trascina qui export.xml da Apple Health</p>
            <input type="file" id="health-file" accept=".xml" style="display:none" />
          </div>
          <div class="import-progress" id="health-progress" style="display:none"><div class="import-progress-fill" id="health-progress-fill" /></div>
          <div id="health-preview" style="margin-top:12px" />
        </Card>
        <Card>
          <div class="card-title">Import FIT (Apple Watch / Garmin)</div>
          <div class="drop-zone" id="fit-drop">
            <p>Trascina qui file .fit</p>
            <input type="file" id="fit-file" accept=".fit" style="display:none" />
          </div>
          <div id="fit-preview" style="margin-top:12px" />
        </Card>
        </div>
        <div class="lay-section">Backup</div>
        <Card>
          <div class="card-title">Export / Backup</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary" data-action="exportAllData">Export JSON</button>
            <button class="btn btn-secondary" data-action="triggerImportJSON">Import JSON</button>
            <button class="btn btn-danger btn-sm" data-action="deleteAllWorkouts">Cancella tutti gli allenamenti</button>
            <input type="file" id="import-json" accept=".json" style="display:none" />
          </div>
        </Card>
      </div>

      <div data-tab-content="settings" style="display:none">
        <Card>
          <div class="card-title">Profilo Atletico</div>
          <div class="form-row">
            <div class="form-group"><label>FC Max</label><input type="number" id="set-maxhr" placeholder="190" data-settings="true" /></div>
            <div class="form-group"><label>FC Riposo</label><input type="number" id="set-resthr" placeholder="55" data-settings="true" /></div>
            <div class="form-group"><label>Peso corporeo (kg)</label><input type="number" step="0.1" id="set-bodyweight" placeholder="75" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Altezza (cm)</label><input type="number" id="set-height" placeholder="175" data-settings="true" /></div>
            <div class="form-group"><label>VO2 Max (ml/kg/min)</label><input type="number" step="0.1" id="set-vo2max" placeholder="45" data-settings="true" /></div>
            <div class="form-group"><label>Eta'</label><input type="number" id="set-age" placeholder="25" data-settings="true" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Obiettivo settimanale allenamenti</label><input type="number" id="set-weekgoal" placeholder="4" data-settings="true" /></div>
            <div class="form-group"><label>Obiettivo km/settimana (corsa)</label><input type="number" id="set-kmgoal" placeholder="20" data-settings="true" /></div>
            <div class="form-group"><label>Sesso</label>
              <select id="set-gender" data-settings="true">
                <option value="">--</option><option value="M">Maschio</option><option value="F">Femmina</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Flessibilità / Mobilità (1-10)</label><input type="number" id="set-flexibility" min="1" max="10" placeholder="5" data-settings="true" /></div>
            <div class="form-group" />
            <div class="form-group" />
          </div>
          <p style="font-size:.78rem;color:var(--text2);margin-top:8px">La flessibilità non può essere calcolata automaticamente. Inserisci un'auto-valutazione da 1 (scarsa) a 10 (eccellente).</p>
        </Card>
        <Card>
          <div class="card-title">I Miei Sport</div>
          <p style="font-size:.82rem;color:var(--text2);margin-bottom:12px">Palestra e Corsa sono sempre attivi. Aggiungi gli sport che pratichi.</p>
          <div id="active-sports-list" style="margin-bottom:12px" />
          <div class="card-title" style="font-size:.8rem;margin-top:16px">Sport Disponibili</div>
          <div id="available-sports-pool" />
        </Card>
        <Card>
          <div class="card-title">Notifiche</div>
          <div id="notifications-list" />
        </Card>
        <Card>
          <div class="card-title">Info</div>
          <p style="font-size:.85rem;color:var(--text2)">Training Analyzer v3.2</p>
        </Card>
      </div>
    </PageShell>
  );
}

export function mountSetupPage({ host }: { host: HTMLElement }) {
  if (host) render(<SetupPage />, host);
}

export function unmountSetupPage(host?: HTMLElement) {
  const el = host || document.getElementById('setup-host');
  if (el) render(null, el);
}
