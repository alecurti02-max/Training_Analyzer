import { useEffect, useState } from 'preact/hooks';
import { Card } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { loadClientProfile, saveClientProfile, addClientNote, deleteClientNote } from '@/store/coach';
import type { CrmProfile } from '@/store/coach';

// Tab "Note" del dettaglio cliente: anagrafica CRM (obiettivi, anamnesi,
// contatti, tag) + timeline di note private. TUTTO privato del coach: il
// cliente non vede mai questi dati (hard rule lato server).

function AnagraficaForm({ clientId, profile, onSaved }: {
  clientId: string;
  profile: CrmProfile;
  onSaved: (p: CrmProfile) => void;
}) {
  const [goals, setGoals] = useState(profile.goals || '');
  const [anamnesis, setAnamnesis] = useState(profile.anamnesis || '');
  const [phone, setPhone] = useState(profile.contacts?.phone || '');
  const [emergencyName, setEmergencyName] = useState(profile.contacts?.emergencyName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile.contacts?.emergencyPhone || '');
  const [tags, setTags] = useState((profile.tags || []).join(', '));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const saved = await saveClientProfile(clientId, {
        goals: goals || null,
        anamnesis: anamnesis || null,
        contacts: { phone, emergencyName, emergencyPhone },
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      onSaved(saved);
      // Riallinea il form alla verità del server (es. troncamenti dei bound):
      // gli useState non si risincronizzano da soli al cambio della prop.
      setGoals(saved.goals || '');
      setAnamnesis(saved.anamnesis || '');
      setPhone(saved.contacts?.phone || '');
      setEmergencyName(saved.contacts?.emergencyName || '');
      setEmergencyPhone(saved.contacts?.emergencyPhone || '');
      setTags((saved.tags || []).join(', '));
      toast('Anagrafica salvata', 'success');
    } catch (e) { toast('Errore', 'error'); }
    setBusy(false);
  }

  return (
    <Card style="margin-bottom:10px">
      <div class="card-title">Anagrafica (visibile solo a te)</div>
      <div class="login-form-group">
        <label>Obiettivi</label>
        <input type="text" value={goals} placeholder="es. Ricomposizione, gara a ottobre"
          onInput={(e) => setGoals((e.target as HTMLInputElement).value)} />
      </div>
      <div class="login-form-group">
        <label>Anamnesi / infortuni</label>
        <textarea
          style="min-height:70px;width:100%;font-size:.88rem"
          placeholder="es. pregressa lombalgia, evitare carichi assiali pesanti"
          value={anamnesis}
          onInput={(e) => setAnamnesis((e.target as HTMLTextAreaElement).value)} />
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="login-form-group" style="flex:1;min-width:140px">
          <label>Telefono</label>
          <input type="tel" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
        </div>
        <div class="login-form-group" style="flex:1;min-width:140px">
          <label>Contatto d'emergenza</label>
          <input type="text" value={emergencyName} placeholder="nome"
            onInput={(e) => setEmergencyName((e.target as HTMLInputElement).value)} />
        </div>
        <div class="login-form-group" style="flex:1;min-width:140px">
          <label>Tel. emergenza</label>
          <input type="tel" value={emergencyPhone} onInput={(e) => setEmergencyPhone((e.target as HTMLInputElement).value)} />
        </div>
      </div>
      <div class="login-form-group">
        <label>Tag (separati da virgola)</label>
        <input type="text" value={tags} placeholder="es. principiante, mattina"
          onInput={(e) => setTags((e.target as HTMLInputElement).value)} />
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-primary" type="button" disabled={busy} onClick={save}>Salva anagrafica</button>
      </div>
    </Card>
  );
}

function NotesTimeline({ clientId, profile, onChanged }: {
  clientId: string;
  profile: CrmProfile;
  onChanged: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try { await addClientNote(clientId, text.trim()); setText(''); onChanged(); }
    catch (e) { toast('Errore', 'error'); }
    setBusy(false);
  }
  async function remove(noteId: string) {
    try { await deleteClientNote(clientId, noteId); onChanged(); }
    catch (e) { toast('Errore', 'error'); }
  }

  return (
    <Card>
      <div class="card-title">Note private</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input type="text" style="flex:1" value={text} placeholder="es. Oggi ottima panca, aumentare 2.5kg la prossima"
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button class="btn btn-primary btn-sm" type="button" disabled={busy} onClick={add}>Aggiungi</button>
      </div>
      {(profile.notes || []).length === 0 && (
        <p style="font-size:.8rem;color:var(--text2)">Nessuna nota. Le note restano private: il cliente non le vede.</p>
      )}
      {(profile.notes || []).map((n) => (
        <div key={n.id} style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.72rem;color:var(--text2)">{new Date(n.date).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div style="font-size:.86rem;white-space:pre-wrap">{n.text}</div>
          </div>
          <button class="btn-link-sm" type="button" style="color:var(--text2)" onClick={() => remove(n.id)}>Elimina</button>
        </div>
      ))}
    </Card>
  );
}

export function ClientCrm({ clientId }: { clientId: string }) {
  const [profile, setProfile] = useState<CrmProfile | null>(null);

  function reload() {
    loadClientProfile(clientId).then(setProfile).catch(() => setProfile(null));
  }
  useEffect(() => { setProfile(null); reload(); }, [clientId]);

  if (profile == null) return <Card><p style="color:var(--text2)">Caricamento…</p></Card>;

  return (
    <div>
      <AnagraficaForm clientId={clientId} profile={profile} onSaved={setProfile} />
      <NotesTimeline clientId={clientId} profile={profile} onChanged={reload} />
    </div>
  );
}
