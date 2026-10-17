import { useMemo, useState } from 'preact/hooks';
import { actions, useStore } from '../store/store';
import { FITS, LABELS, SEASONS, STATES } from '../types';
import { Chip } from './common';
import { ItemImage, hasPicture, webImagesOn } from './art';
import { ItemTile } from './ItemTile';
import { REASONS, type ArchivedReason } from '../types';

export function ItemsScreen() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [state, setState] = useState('');
  const [season, setSeason] = useState('');
  const [fit, setFit] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [view, setViewState] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('itemsView') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const setView = (v: 'grid' | 'list') => { setViewState(v); try { localStorage.setItem('itemsView', v); } catch { /* optional */ } };
  const [noPhoto, setNoPhoto] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [letGo, setLetGo] = useState(false);

  const showWeb = webImagesOn(data);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.items
      .filter((i) => {
        if (i.state === 'archived' && !showArchived && state !== 'archived') return false;
        if (cat && i.category !== cat) return false;
        if (state && i.state !== state) return false;
        if (fit && i.fit !== fit) return false;
        if (noPhoto && hasPicture(i, showWeb)) return false;
        if (season && !i.seasons.includes(season as never)) return false;
        if (!needle) return true;
        return [i.name, i.brand, i.size, i.notes].some((f) => f?.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.items, q, cat, state, season, fit, showArchived, noPhoto, showWeb]);

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
        <input type="checkbox" checked={noPhoto} onChange={(e) => setNoPhoto((e.target as HTMLInputElement).checked)} />
        No photo
      </label>
      <label class="check">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived((e.target as HTMLInputElement).checked)} />
        Show archived
      </label>
      {showWeb && !data.settings.webImagesNoteSeen && data.items.some((i) => i.imageUrl) && (
        <div class="banner" role="status">
          <p>Linked product images load from the retailer's website, which tells that site this device asked for the picture. You can turn this off in Settings.</p>
          <div class="actions">
            <button onClick={() => actions.dismissWebImagesNote()}>OK</button>
            <button class="ghost" onClick={() => { actions.setWebImages(false); actions.dismissWebImagesNote(); }}>Turn off</button>
          </div>
        </div>
      )}
      <div class="actions">
        <span class="seg" role="group" aria-label="View">
          <button class={view === 'grid' ? 'on' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          <button class={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </span>
        <button onClick={() => { setSelecting(!selecting); setPicked([]); setLetGo(false); }}>{selecting ? 'Done selecting' : 'Select'}</button>
        {selecting && <button class="ghost" onClick={() => setPicked(picked.length === list.length ? [] : list.map((i) => i.id))}>{picked.length === list.length && list.length > 0 ? 'Clear all' : `Select all ${list.length}`}</button>}
      </div>
      <p class="muted small">{list.length} {list.length === 1 ? 'item' : 'items'}{selecting && ` · ${picked.length} selected`}</p>
      {view === 'grid' ? (
        <ul class="grid">
          {list.map((i) => (
            <li key={i.id}>
              <ItemTile item={i} selecting={selecting} picked={picked.includes(i.id)} onToggle={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} />
            </li>
          ))}
        </ul>
      ) : (
      <ul class="cards">
        {list.map((i) => (
          <li class="card item thumb-row" key={i.id}>
            <div class="thumb"><ItemImage item={i} category={data.categories.find((c) => c.id === i.category)} showWeb={showWeb} /></div>
            <div class="thumb-body">
            {selecting && (
              <label class="check">
                <input type="checkbox" checked={picked.includes(i.id)} onChange={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} />
                <span class="muted small">Select</span>
              </label>
            )}
            <a href={`#/edit/${i.id}`} class="item-name">{i.name}</a>
            <div class="meta">
              <span>{catName(i.category)}</span>
              {i.brand && <span>{i.brand}</span>}
              {i.size && <span>size {i.size}</span>}
              <Chip tone={i.state === 'on-rail' ? 'ok' : 'muted'}>{LABELS[i.state]}{i.archivedReason ? ` (${i.archivedReason})` : ''}</Chip>
              {i.fit !== 'not-checked' && <Chip tone={i.fit === 'doesnt-fit' ? 'warn' : undefined}>{LABELS[i.fit]}</Chip>}
            </div>
          </div>
          </li>
        ))}
      </ul>
      )}
      {selecting && picked.length > 0 && (
        <div class="bulkbar" role="group" aria-label="Actions for selected items">
          <b>{picked.length}</b>
          {!letGo ? (
            <>
              <button class="primary" onClick={() => { actions.setStateMany(picked, 'on-rail'); setPicked([]); }}>Put back</button>
              <button onClick={() => { actions.setStateMany(picked, 'stored'); setPicked([]); }}>Not now</button>
              <button onClick={() => { actions.setStateMany(picked, 'pile'); setPicked([]); }}>To pile</button>
              <button class="danger" onClick={() => setLetGo(true)}>Let go</button>
            </>
          ) : (
            <>
              {REASONS.map((r) => <button key={r} onClick={() => { actions.setStateMany(picked, 'archived', r as ArchivedReason); setPicked([]); setLetGo(false); }}>{LABELS[r]}</button>)}
              <button onClick={() => { actions.setStateMany(picked, 'archived'); setPicked([]); setLetGo(false); }}>No reason</button>
              <button class="ghost" onClick={() => setLetGo(false)}>Back</button>
            </>
          )}
        </div>
      )}
      {data.items.length === 0 && <p class="muted">No items yet. <a href="#/add">Add your first</a>.</p>}
    </section>
  );
}
