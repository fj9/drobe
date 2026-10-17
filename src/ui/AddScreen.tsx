import { useState } from 'preact/hooks';
import { actions, useStore } from '../store/store';
import { FITS, LABELS, REASONS, SEASONS, STATES, type ArchivedReason, type Fit, type Item, type ItemState, type Season } from '../types';
import { ConfirmButton, Field, go } from './common';

// Quick-add remembers the last category and seasons for a run of similar items.
let lastCategory = '';
let lastSeasons: Season[] = ['autumn', 'winter'];

export function AddScreen({ editId }: { editId?: string }) {
  const { data } = useStore();
  const editing = editId ? data.items.find((i) => i.id === editId) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? (lastCategory || data.categories[0]?.id || ''));
  const [seasons, setSeasons] = useState<Season[]>(editing?.seasons ?? lastSeasons);
  const [fit, setFit] = useState<Fit>(editing?.fit ?? 'not-checked');
  const [state, setState] = useState<ItemState>(editing?.state ?? 'pile');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [size, setSize] = useState(editing?.size ?? '');
  const [material, setMaterial] = useState(editing?.material ?? '');
  const [colour, setColour] = useState(editing?.colour ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [zoneOverride, setZoneOverride] = useState(editing?.zoneOverride ?? '');
  const [reason, setReason] = useState<ArchivedReason | ''>(editing?.archivedReason ?? '');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  if (editId && !editing) return <section><h1>Item not found</h1><p><a href="#/items">Back to items</a></p></section>;

  const toggleSeason = (s: Season) =>
    setSeasons((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const build = (): Partial<Item> | undefined => {
    if (!name.trim()) return void setError('Give the item a name.');
    if (!category) return void setError('Choose a category.');
    if (seasons.length === 0) return void setError('Choose at least one season.');
    setError('');
    return {
      name: name.trim(), category, seasons, fit, state,
      brand: brand.trim() || undefined, size: size.trim() || undefined, material: material.trim() || undefined,
      colour: colour.trim() || undefined, notes: notes.trim() || undefined,
      zoneOverride: zoneOverride || undefined,
      archivedReason: state === 'archived' ? reason || undefined : undefined,
    };
  };

  const save = async (another: boolean) => {
    const v = build();
    if (!v) return;
    lastCategory = category;
    lastSeasons = seasons;
    if (editing) {
      const wasArchived = editing.state === 'archived';
      await actions.updateItem(editing.id, { ...v, archivedAt: v.state === 'archived' ? (wasArchived ? editing.archivedAt : new Date().toISOString()) : undefined });
      history.length > 1 ? history.back() : go('/items');
      return;
    }
    await actions.addItem(v as Required<Pick<Item, 'name' | 'category' | 'seasons'>>);
    if (another) {
      setFlash(`Added "${v.name}"`);
      setName(''); setBrand(''); setSize(''); setMaterial(''); setColour(''); setNotes(''); setFit('not-checked');
    } else go('/sort');
  };

  return (
    <section>
      <h1>{editing ? 'Edit item' : 'Add item'}</h1>
      {!editing && <p class="muted small">Have a lot to add? <a href="#/settings/csv">Bulk import from a CSV</a>.</p>}
      {flash && <p class="banner ok" role="status">{flash}</p>}
      <form class="form" onSubmit={(e) => { e.preventDefault(); save(!editing); }}>
        <Field label="Name">
          <input value={name} autofocus={!editing} placeholder="Navy wool cardigan" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            {data.categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <fieldset>
          <legend>Seasons</legend>
          <div class="pills">
            {SEASONS.map((s) => (
              <label key={s} class={`pill ${seasons.includes(s) ? 'on' : ''}`}>
                <input type="checkbox" checked={seasons.includes(s)} onChange={() => toggleSeason(s)} />
                {LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Fit</legend>
          <div class="pills">
            {FITS.map((f) => (
              <label key={f} class={`pill ${fit === f ? 'on' : ''}`}>
                <input type="radio" name="fit" checked={fit === f} onChange={() => setFit(f)} />
                {LABELS[f]}
              </label>
            ))}
          </div>
        </fieldset>

        <details open={!!editing}>
          <summary>More details</summary>
          <Field label="Brand"><input value={brand} onInput={(e) => setBrand((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Size"><input value={size} onInput={(e) => setSize((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Material"><input value={material} onInput={(e) => setMaterial((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Colour"><input value={colour} onInput={(e) => setColour((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Notes"><textarea rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} /></Field>
          <Field label="Hangs on a different rail (rare)">
            <select value={zoneOverride} onChange={(e) => setZoneOverride((e.target as HTMLSelectElement).value)}>
              <option value="">Category default</option>
              {data.zones.map((z) => <option value={z.id} key={z.id}>{z.name}</option>)}
            </select>
          </Field>
          {editing && (
            <>
              <Field label="State">
                <select value={state} onChange={(e) => setState((e.target as HTMLSelectElement).value as ItemState)}>
                  {STATES.map((s) => <option value={s} key={s}>{LABELS[s]}</option>)}
                </select>
              </Field>
              {state === 'archived' && (
                <Field label="Reason">
                  <select value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value as ArchivedReason | '')}>
                    <option value="">No reason</option>
                    {REASONS.map((r) => <option value={r} key={r}>{LABELS[r]}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
        </details>

        {error && <p class="warn" role="alert">{error}</p>}
        <div class="actions sticky">
          {editing ? (
            <>
              <button type="submit" class="primary">Save</button>
              <button type="button" class="ghost" onClick={() => history.back()}>Cancel</button>
              <ConfirmButton label="Delete" confirmLabel="Yes, delete permanently" onConfirm={async () => { await actions.deleteItem(editing.id); go('/items'); }} />
            </>
          ) : (
            <>
              <button type="submit" class="primary">Save and add another</button>
              <button type="button" onClick={() => save(false)}>Save</button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
