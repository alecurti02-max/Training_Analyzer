import { useState } from 'preact/hooks';
import { toast } from '@/lib/toast.js';
import { inviteClient } from '@/store/coach';

// Invito per email esatta (stesso overlay-pattern di PlannerModal). Il cliente
// deve già avere un account: il server risponde 404 altrimenti.
export function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const value = email.trim();
    if (!value) { setError('Inserisci una email'); return; }
    setBusy(true);
    setError('');
    try {
      await inviteClient(value);
      toast('Invito inviato', 'success');
      onClose();
    } catch (e: any) {
      setBusy(false);
      if (e?.status === 404) setError('Nessun account con questa email. Chiedi al cliente di registrarsi prima.');
      else if (e?.status === 409) setError(e.message || 'Invito già presente');
      else if (e?.status === 400) setError(e.message || 'Email non valida');
      else setError('Errore nell\'invio, riprova');
    }
  }

  return (
    <div class="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style={{ maxWidth: '420px' }}>
        <div class="modal-header">Invita un cliente</div>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:10px">
          Inserisci l'email con cui il cliente si è registrato all'app. Riceverà l'invito
          nel suo profilo e dovrà accettarlo prima che tu possa vedere i suoi dati.
        </p>
        <div class="login-form-group">
          <label>Email del cliente</label>
          <input
            type="email"
            value={email}
            placeholder="cliente@esempio.it"
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
        {error && <p style="font-size:.8rem;color:var(--redline,#e54);margin:4px 0 0">{error}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button class="btn btn-secondary" type="button" onClick={onClose}>Annulla</button>
          <button class="btn btn-primary" type="button" disabled={busy} onClick={submit}>Invita</button>
        </div>
      </div>
    </div>
  );
}
