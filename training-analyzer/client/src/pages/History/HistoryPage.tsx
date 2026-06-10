import { render } from 'preact';
import { useState } from 'preact/hooks';
import { workouts } from '@/store/workouts';
import { PageShell, Card, Toolbar, FilterBar, EmptyState, SectionDivider } from '@/components/layout';
import { WorkoutItem } from '@/components/WorkoutItem/WorkoutItem';
import { toast } from '@/lib/toast';
import { SPORT_TEMPLATES } from '../../../js/sports.js';

// Storico — pagina .tsx autonoma. Redesign: lista raggruppata per MESE con
// divisori mono (lay-section) e striscia riepilogo per gruppo (sessioni ·
// score medio · km · tonnellaggio). Filtro/selezione invariati; il modale di
// dettaglio resta in ui.js (window.showWorkoutDetail), la delete passa per
// window.deleteWorkoutsByIds.
type W = Record<string, any> & { id: string; type: string; date: string };

function groupByMonth(list: W[]): Array<{ key: string; label: string; items: W[] }> {
  const groups = new Map<string, W[]>();
  for (const w of list) {
    const key = String(w.date || '').slice(0, 7); // YYYY-MM
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  }
  return [...groups.entries()].map(([key, items]) => {
    const d = new Date(key + '-01T00:00:00');
    const label = isNaN(d.getTime())
      ? key
      : d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return { key, label, items };
  });
}

function GroupSummary({ items }: { items: W[] }) {
  const scored = items.filter((w) => w.scores?.overall != null);
  const avg = scored.length ? scored.reduce((s, w) => s + w.scores.overall, 0) / scored.length : null;
  const km = items.filter((w) => w.type === 'running').reduce((s, w) => s + (Number(w.distance) || 0), 0);
  const ton = items.filter((w) => w.type === 'gym').reduce((s, w) => s + (Number(w._tonnage) || 0), 0) / 1000;
  return (
    <div class="hist-summary-strip">
      <span><b>{items.length}</b> sessioni</span>
      {avg != null && <span>score medio <b>{avg.toFixed(1)}</b></span>}
      {km > 0 && <span><b>{km.toFixed(1)}</b> km</span>}
      {ton > 0 && <span><b>{ton.toFixed(1)}</b> t</span>}
    </div>
  );
}

export function HistoryPage() {
  const [filter, setFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const all = workouts.value;
  const types = [...new Set(all.map((w) => w.type))];
  let list = [...all].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (filter !== 'all') list = list.filter((w) => w.type === filter);
  const groups = groupByMonth(list);

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
  const onItem = (w: W) => {
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
          left={<FilterBar options={options} value={filter} onChange={setFilter} />}
          right={
            <button class={`btn btn-secondary btn-sm${selectMode ? ' active' : ''}`} onClick={enterSelect}>
              {selectMode ? 'Annulla' : 'Seleziona'}
            </button>
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
          groups.map((g) => (
            <div class="hist-group" key={g.key}>
              <SectionDivider>{g.label}</SectionDivider>
              <GroupSummary items={g.items} />
              {g.items.map((w) => (
                <WorkoutItem key={w.id} w={w} selectMode={selectMode} selected={selectedIds.has(w.id)} onItemClick={onItem} />
              ))}
            </div>
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
