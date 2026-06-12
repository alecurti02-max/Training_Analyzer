import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { loadClientPackages, createClientPackage, updateClientPackage, useClientPackage } from '@/store/coach';
import type { ClientPackage } from '@/store/coach';

// Tab "Pacchetti": pacchetti lezioni/abbonamenti del cliente, tracking manuale.
// "+1 seduta" = lezione fatta col PT (non un allenamento qualsiasi).

const STATUS_LABEL: Record<string, string> = {
  active: 'Attivo', completed: 'Completato', expired: 'Scaduto', cancelled: 'Annullato',
};

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function daysTo(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function NewPackageForm({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [type, setType] = useState<'package' | 'subscription'>('package');
  const [title, setTitle] = useState('');
  const [totalSessions, setTotalSessions] = useState('10');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) { toast('Dai un nome al pacchetto', 'error'); return; }
    setBusy(true);
    try {
      await createClientPackage(clientId, {
        type, title,
        totalSessions: type === 'package' ? Number(totalSessions) || null : null,
        startDate,
        expiryDate: expiryDate || null,
        price: price === '' ? null : Number(price),
      });
      toast('Pacchetto creato', 'success');
      setTitle(''); setPrice('');
      onCreated();
    } catch (e) { toast('Errore', 'error'); }
    setBusy(false);
  }

  return (
    <Card style="margin-bottom:10px">
      <div class="card-title">Nuovo pacchetto</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="login-form-group" style="min-width:130px">
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value as 'package' | 'subscription')}>
            <option value="package">Pacchetto lezioni</option>
            <option value="subscription">Abbonamento</option>
          </select>
        </div>
        <div class="login-form-group" style="flex:1;min-width:150px">
          <label>Nome</label>
          <input type="text" value={title} placeholder="es. 10 lezioni PT" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </div>
        {type === 'package' && (
          <div class="login-form-group" style="width:90px">
            <label>Sedute</label>
            <input type="number" min="1" max="1000" value={totalSessions} onInput={(e) => setTotalSessions((e.target as HTMLInputElement).value)} />
          </div>
        )}
        <div class="login-form-group" style="width:150px">
          <label>Inizio</label>
          <input type="date" value={startDate} onInput={(e) => setStartDate((e.target as HTMLInputElement).value)} />
        </div>
        <div class="login-form-group" style="width:150px">
          <label>Scadenza</label>
          <input type="date" value={expiryDate} onInput={(e) => setExpiryDate((e.target as HTMLInputElement).value)} />
        </div>
        <div class="login-form-group" style="width:100px">
          <label>Prezzo €</label>
          <input type="number" min="0" step="0.5" value={price} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} />
        </div>
        <button class="btn btn-primary" type="button" disabled={busy} onClick={create} style="margin-bottom:14px">Crea</button>
      </div>
    </Card>
  );
}

function PackageRow({ p, onChanged }: { p: ClientPackage; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const left = p.totalSessions != null ? p.totalSessions - p.usedSessions : null;
  const days = daysTo(p.expiryDate);
  const expiring = p.status === 'active' && ((days != null && days <= 14) || (left != null && left <= 2));

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChanged(); }
    catch (e: unknown) { toast((e as { message?: string })?.message || 'Errore', 'error'); }
    setBusy(false);
  }

  return (
    <Card style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:700">{p.title}
            <span style={`margin-left:8px;font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--border-strong);color:${p.status === 'active' ? 'var(--accent)' : 'var(--text2)'}`}>
              {STATUS_LABEL[p.status] || p.status}
            </span>
          </div>
          <div style="font-size:.75rem;color:var(--text2)">
            {p.totalSessions != null && <span>{p.usedSessions}/{p.totalSessions} sedute · </span>}
            {fmtDate(p.startDate)} → <span style={expiring ? 'color:var(--redline,#e54);font-weight:700' : ''}>{fmtDate(p.expiryDate)}</span>
            {p.price != null && ` · ${Number(p.price).toFixed(0)}€`}
            {expiring && <span style="color:var(--redline,#e54);font-weight:700"> · in scadenza</span>}
          </div>
        </div>
        {p.status === 'active' && p.totalSessions != null && (
          <button class="btn btn-primary btn-sm" type="button" disabled={busy}
            onClick={() => act(() => useClientPackage(p.id))}>+1 seduta</button>
        )}
        {p.status === 'active' && (
          <button class="btn btn-secondary btn-sm" type="button" disabled={busy}
            onClick={() => { if (window.confirm('Annullare il pacchetto?')) act(() => updateClientPackage(p.id, { status: 'cancelled' })); }}>
            Annulla
          </button>
        )}
      </div>
    </Card>
  );
}

export function PackagesPanel({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<ClientPackage[] | null>(null);

  function reload() {
    loadClientPackages(clientId).then(setRows).catch(() => setRows([]));
  }
  useEffect(() => { setRows(null); reload(); }, [clientId]);

  return (
    <div>
      <NewPackageForm clientId={clientId} onCreated={reload} />
      {rows == null && <Card><p style="color:var(--text2)">Caricamento…</p></Card>}
      {rows != null && rows.length === 0 && <EmptyState title="Nessun pacchetto" hint="Crea il primo pacchetto o abbonamento del cliente." />}
      {(rows || []).map((p) => <PackageRow key={p.id} p={p} onChanged={reload} />)}
    </div>
  );
}
