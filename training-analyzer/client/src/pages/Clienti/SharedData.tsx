import { useEffect, useState } from 'preact/hooks';
import { Card } from '@/components/layout';
import { loadSharedData } from '@/store/coach';

// Tab "Dati" del dettaglio cliente: letture READ-ONLY dei dati sensibili che il
// CLIENTE ha scelto di condividere (peso/misure, nutrizione, sonno). Se l'opt-in
// è spento il server risponde 403 (sharing_disabled) e qui si mostra il hint.

type Row = Record<string, unknown> & { date: string };

const SECTIONS: Array<{
  key: 'weights' | 'body-measurements' | 'nutrition' | 'sleep';
  title: string;
  hint: string;
  render: (r: Row) => string;
}> = [
  {
    key: 'weights', title: 'Peso', hint: 'peso e misure',
    render: (r) => `${r.value} kg`,
  },
  {
    key: 'body-measurements', title: 'Misure corporee', hint: 'peso e misure',
    render: (r) => ['waist', 'chest', 'hips', 'bodyFatPct']
      .filter((k) => r[k] != null)
      .map((k) => `${k === 'bodyFatPct' ? 'BF%' : k}: ${r[k]}`)
      .join(' · ') || 'misure registrate',
  },
  {
    key: 'nutrition', title: 'Nutrizione', hint: 'la nutrizione',
    render: (r) => [r.calories != null ? `${r.calories} kcal` : null, r.proteinG != null ? `${r.proteinG}g pro` : null]
      .filter(Boolean).join(' · ') || 'diario compilato',
  },
  {
    key: 'sleep', title: 'Sonno', hint: 'il sonno',
    render: (r) => [r.durationHours != null ? `${r.durationHours}h` : null, r.quality != null ? `qualità ${r.quality}/10` : null]
      .filter(Boolean).join(' · ') || 'notte registrata',
  },
];

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function Section({ clientId, section }: { clientId: string; section: typeof SECTIONS[number] }) {
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    setState('loading');
    loadSharedData(clientId, section.key)
      .then((data: Row[]) => { setRows((data || []).slice(-14).reverse()); setState('ok'); })
      .catch((e: { code?: string; status?: number }) => {
        setState(e?.code === 'sharing_disabled' || e?.status === 403 ? 'forbidden' : 'error');
      });
  }, [clientId, section.key]);

  return (
    <Card style="margin-bottom:8px">
      <div class="card-title">{section.title}</div>
      {state === 'loading' && <p style="font-size:.8rem;color:var(--text2)">Caricamento…</p>}
      {state === 'forbidden' && (
        <p style="font-size:.8rem;color:var(--text2)">
          Non condiviso. Il cliente può attivare la condivisione ({section.hint}) dal suo Profilo → Coach.
        </p>
      )}
      {state === 'error' && <p style="font-size:.8rem;color:var(--text2)">Errore di caricamento.</p>}
      {state === 'ok' && rows.length === 0 && <p style="font-size:.8rem;color:var(--text2)">Nessun dato registrato.</p>}
      {state === 'ok' && rows.map((r) => (
        <div key={r.date} style="display:flex;gap:10px;padding:3px 0;font-size:.82rem;border-bottom:1px solid var(--border)">
          <span style="min-width:64px;color:var(--text2)">{fmtDate(r.date)}</span>
          <span>{section.render(r)}</span>
        </div>
      ))}
    </Card>
  );
}

export function SharedData({ clientId }: { clientId: string }) {
  return (
    <div>
      {SECTIONS.map((s) => <Section key={s.key} clientId={clientId} section={s} />)}
    </div>
  );
}
