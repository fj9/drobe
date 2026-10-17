import { useMemo, useState } from 'preact/hooks';
import { useStore } from '../store/store';
import { FITS, LABELS, SEASONS, STATES } from '../types';
import { Chip } from './common';

export function ItemsScreen() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [state, setState] = useState('');
  const [season, setSeason] = useState('');
  const [fit, setFit] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.items
      .filter((i) => {
        if (i.state === 'archived' && !showArchived && state !== 'archived') return false;
        if (cat && i.category !== cat) return false;
        if (state && i.state !== state) return false;
        if (fit && i.fit !== fit) return false;
        if (season && !i.seasons.includes(season as never)) return false;
        if (!needle) return true;
        return [i.name, i.brand, i.size, i.notes].some((f) => f?.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.items, q, cat, state, season, fit, showArchived]);

  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '?';

  return (
    <section>
      <h1>Items</h1>
      <p class="muted small"><a href="#/settings/csv">Bulk import items from a CSV</a></p>
      <input type="search" class="search" placeholder="Search name, brand, size, notes" aria-label="Search items" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="filters">
        <select aria-label="Category" value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="State" value={state} onChange={(e) => setState((e.target as HTMLSelectElement).value)}>
          <option value="">Any state</option>
          {STATES.map((s) => <option value={s} key={s}>{LABELS[s]}</option>)}
        </select>
        <select aria-label="Season" value={season} onChange={(e) => setSeason((e.target as HTMLSelectElement).value)}>
          <option value="">Any season</option>
          {SEASONS.map((s) => <option value={s} key={s}>{LABELS[s]}</option>)}
        </select>
        <select aria-label="Fit" value={fit} onChange={(e) => setFit((e.target as HTMLSelectElement).value)}>
          <option value="">Any fit</option>
          {FITS.map((f) => <option value={f} key={f}>{LABELS[f]}</option>)}
        </select>
      </div>
      <label class="check">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived((e.target as HTMLInputElement).checked)} />
        Show archived
      </label>
      <p class="muted small">{list.length} {list.length === 1 ? 'item' : 'items'}</p>
      <ul class="cards">
        {list.map((i) => (
          <li class="card item" key={i.id}>
            <a href={`#/edit/${i.id}`} class="item-name">{i.name}</a>
            <div class="meta">
              <span>{catName(i.category)}</span>
              {i.brand && <span>{i.brand}</span>}
              {i.size && <span>size {i.size}</span>}
              <Chip tone={i.state === 'on-rail' ? 'ok' : 'muted'}>{LABELS[i.state]}{i.archivedReason ? ` (${i.archivedReason})` : ''}</Chip>
              {i.fit !== 'not-checked' && <Chip tone={i.fit === 'doesnt-fit' ? 'warn' : undefined}>{LABELS[i.fit]}</Chip>}
            </div>
          </li>
        ))}
      </ul>
      {data.items.length === 0 && <p class="muted">No items yet. <a href="#/add">Add your first</a>.</p>}
    </section>
  );
}
