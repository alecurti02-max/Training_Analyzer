import { useEffect, useState } from 'preact/hooks';
import { Card, EmptyState } from '@/components/layout';
import { toast } from '@/lib/toast.js';
import { coachPrograms, loadPrograms, deleteProgram, duplicateProgram, saveProgram } from '@/store/coach';
import type { Program } from '@/store/coach';

const STATUS_LABEL: Record<string, string> = { draft: 'Bozza', active: 'Attiva', archived: 'Archiviata' };

// Libreria schede del coach (tab "Schede" della pagina Clienti).
export function ProgramList({ onEdit }: { onEdit: (p: Program | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { loadPrograms(); }, []);
  const rows = coachPrograms.value;

  async function act(id: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(id);
    try { await fn(); if (okMsg) toast(okMsg, 'success'); }
    catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      toast(err?.status === 409 ? (err.message || 'Scheda assegnata: archiviala') : 'Errore', 'error');
    }
    setBusy(null);
  }

  return (
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" type="button" onClick={() => onEdit(null)}>+ Nuova scheda</button>
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="Nessuna scheda"
          hint="Crea una scheda con le giornate (A/B/C…) e le progressioni: potrai assegnarla a più clienti."
        />
      )}

      {rows.map((p) => (
        <Card key={p.id} style="margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-weight:700">{p.title}
                <span style={`margin-left:8px;font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--border-strong);color:${p.status === 'archived' ? 'var(--text2)' : 'var(--accent)'}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>
              <div style="font-size:.75rem;color:var(--text2)">
                {p.weeks} settimane · {(p.days || []).length} giornate
                {p.goal ? ` · ${p.goal}` : ''}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" disabled={busy === p.id} onClick={() => onEdit(p)}>Modifica</button>
            <button class="btn btn-secondary btn-sm" type="button" disabled={busy === p.id}
              onClick={() => act(p.id, () => duplicateProgram(p.id), 'Scheda duplicata')}>Duplica</button>
            <button class="btn btn-secondary btn-sm" type="button" disabled={busy === p.id}
              onClick={() => act(p.id, () => saveProgram({ id: p.id, status: p.status === 'archived' ? 'draft' : 'archived' }), p.status === 'archived' ? 'Ripristinata' : 'Archiviata')}>
              {p.status === 'archived' ? 'Ripristina' : 'Archivia'}
            </button>
            <button class="btn btn-secondary btn-sm" type="button" disabled={busy === p.id}
              onClick={() => { if (window.confirm(`Eliminare "${p.title}"?`)) act(p.id, () => deleteProgram(p.id), 'Scheda eliminata'); }}>
              Elimina
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
