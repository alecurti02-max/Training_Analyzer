import { render } from 'preact';
import { useState } from 'preact/hooks';
import { workouts } from '@/store/workouts';
import { PageShell, Card, Toolbar, FilterBar, EmptyState } from '@/components/layout';
import { WorkoutItem } from '@/components/WorkoutItem/WorkoutItem';
import { toast } from '@/lib/toast';
import { SPORT_TEMPLATES } from '../../../js/sports.js';

// Storico — prima pagina migrata a route .tsx autonoma (pattern Train):
// possiede il proprio markup (kit) + stato (filtro/selezione) e legge i workout
// dal signal store (reattiva). Il modale di dettaglio resta in ui.js, invocato
// via window.showWorkoutDetail; la delete passa per window.deleteWorkoutsByIds
// (ui.js mantiene la cache legacy in pari finché esiste).
export function HistoryPage() {
  const [filter, setFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const all = workouts.value;
  const types = [...new Set(all.map((w) => w.type))];
  let list = [...all].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (filter !== 'all') list = list.filter((w) => w.type === filter);

  const options = [
    { key: 'all', label: 'Tutti' },
    ...types.map((t) => ({ key: t, label: (SPORT_TEMPLATES as any)[t]?.name || t })),
  ];

  const toggleSel = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const onItem = (w: any) => {
    if (selectMode) toggleSel(w.id);
    else (window as any).showWorkoutDetail?.(w.id);
  };
  const enterSelect = () => { setSelectMode((s) => !s); setSelectedIds(new Set()); };
  const del = async () => {
    if (!selectedIds.size) { toast('Nessun allenamento selezionato', 'error'); return; }
    if (!confirm(`Eliminare ${selectedIds.size} allenamenti?`)) return;
    await (window as any).deleteWorkoutsByIds?.([...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  return (
    <PageShell eyebrow="03 · STORICO" title="Storico">
      <Card>
        <Toolbar
          left={<span class="card-title" style="margin:0">Storico Allenamenti</span>}
          right={
            <>
              <FilterBar options={options} value={filter} onChange={setFilter} />
              <button class={`btn btn-secondary btn-sm${selectMode ? ' active' : ''}`} onClick={enterSelect}>
                {selectMode ? 'Annulla' : 'Seleziona'}
              </button>
            </>
          }
        />
        {selectMode && (
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;margin-bottom:8px">
            <button class="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set(list.map((w) => w.id)))}>Seleziona tutti</button>
            <button class="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>Deseleziona tutti</button>
            <span style="font-size:.82rem;color:var(--text2)">{selectedIds.size} selezionati</span>
            <button class="btn btn-danger btn-sm" style="margin-left:auto" onClick={del}>Elimina selezionati</button>
          </div>
        )}
        {list.length === 0 ? (
          <EmptyState title="Nessun allenamento trovato" />
        ) : (
          list.map((w) => (
            <WorkoutItem key={w.id} w={w} selectMode={selectMode} selected={selectedIds.has(w.id)} onItemClick={onItem} />
          ))
        )}
      </Card>
    </PageShell>
  );
}

export function mountHistory({ host }: { host: HTMLElement }) {
  if (host) render(<HistoryPage />, host);
}

export function unmountHistory(host?: HTMLElement) {
  const el = host || document.getElementById('history-preact-host');
  if (el) render(null, el);
}
