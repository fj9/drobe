import { useEffect, useRef, useState } from 'preact/hooks';
import { actions, useStore } from '../store/store';
import { FITS, LABELS, REASONS, SEASONS, STATES, type ArchivedReason, type Fit, type Item, type ItemState, type Season } from '../types';
import { ConfirmButton, Field, go } from './common';
import { ItemImage, webImagesOn } from './art';
import { PALETTE, isHex, normaliseHex, tintFor } from '../engine/colour';

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
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? '');
  const [colourHex, setColourHex] = useState(editing?.colourHex ?? '');
  const [pending, setPending] = useState<File>();
  const [pendingUrl, setPendingUrl] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const takeRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  if (editId && !editing) return <section><h1>Item not found</h1><p><a href="#/items">Back to items</a></p></section>;

  useEffect(() => () => { if (pendingUrl) URL.revokeObjectURL(pendingUrl); }, [pendingUrl]);

  const onPhoto = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (editing) {
      setPhotoBusy(true);
      try { await actions.setPhoto(editing.id, f); setFlash('Photo saved'); } catch { setError('Could not use that photo.'); }
      setPhotoBusy(false);
    } else {
      setPending(f);
      setPendingUrl(URL.createObjectURL(f));
    }
  };

  const toggleSeason = (s: Season) =>
    setSeasons((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const build = (): Partial<Item> | undefined => {
    if (!name.trim()) return void setError('Give the item a name.');
    if (!category) return void setError('Choose a category.');
    if (seasons.length === 0) return void setError('Choose at least one season.');
    if (imageUrl.trim() && !/^https:\/\/[^\s]+$/i.test(imageUrl.trim())) return void setError('Linked images must be an https address.');
    setError('');
    return {
      name: name.trim(), category, seasons, fit, state,
      brand: brand.trim() || undefined, size: size.trim() || undefined, material: material.trim() || undefined,
      colour: colour.trim() || undefined, notes: notes.trim() || undefined,
      zoneOverride: zoneOverride || undefined,
      imageUrl: imageUrl.trim() || undefined,
      colourHex: isHex(colourHex) ? normaliseHex(colourHex) : undefined,
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
    const newId = await actions.addItem(v as Required<Pick<Item, 'name' | 'category' | 'seasons'>>);
    if (pending) { try { await actions.setPhoto(newId, pending); } catch { /* item is saved; photo can be added later */ } }
    setPending(undefined); setPendingUrl(undefined);
    if (another) {
      setFlash(`Added "${v.name}"`);
      setName(''); setBrand(''); setSize(''); setMaterial(''); setColour(''); setNotes(''); setFit('not-checked'); setImageUrl(''); setColourHex('');
    } else go('/sort');
  };

  return (
    <section>
      <h1>{editing ? 'Edit item' : 'Add item'}</h1>
      {!editing && <p class="muted small">Have a lot to add? <a href="#/settings/csv">Bulk import from a CSV</a>.</p>}
      {flash && <p class="banner ok" role="status">{flash}</p>}
      <div class="hero">
        <ItemImage
          item={{ ...(editing ?? ({} as Item)), imageUrl: imageUrl.trim() || undefined, colour: colour || undefined, colourHex: isHex(colourHex) ? colourHex : undefined, photoId: editing?.photoId }}
          category={data.categories.find((c) => c.id === category)} showWeb={webImagesOn(data)} large previewUrl={pendingUrl}
        />
        <div class="actions">
          <button type="button" disabled={photoBusy} onClick={() => takeRef.current?.click()}>Take photo</button>
          <button type="button" disabled={photoBusy} onClick={() => chooseRef.current?.click()}>Choose photo</button>
          {(editing?.photoId || pending) && (
            <button type="button" class="ghost" onClick={async () => {
              if (pending) { setPending(undefined); setPendingUrl(undefined); } else if (editing) await actions.removePhoto(editing.id);
            }}>Remove photo</button>
          )}
        </div>
        <input ref={takeRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        <input ref={chooseRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      </div>
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
        {editing && (
          <>
            <fieldset>
              <legend>State</legend>
              <div class="pills">
                {STATES.map((st) => (
                  <label key={st} class={`pill ${state === st ? 'on' : ''}`}>
                    <input type="radio" name="state" checked={state === st} onChange={() => setState(st)} />
                    {LABELS[st]}
                  </label>
                ))}
              </div>
            </fieldset>
            {state === 'archived' && (
              <fieldset>
                <legend>Reason</legend>
                <div class="pills">
                  <label class={`pill ${reason === '' ? 'on' : ''}`}>
                    <input type="radio" name="reason" checked={reason === ''} onChange={() => setReason('')} />
                    No reason
                  </label>
                  {REASONS.map((r) => (
                    <label key={r} class={`pill ${reason === r ? 'on' : ''}`}>
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                      {LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}
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
          <Field label="Colour tint">
            <span class="reasons">
              <input type="color" class="swatch" aria-label="Pick an exact colour" value={isHex(colourHex) ? colourHex : tintFor(undefined, colour)} onInput={(e) => setColourHex((e.target as HTMLInputElement).value)} />
              <span class="muted small">{isHex(colourHex) ? colourHex.toUpperCase() : `From the colour text (${Object.keys(PALETTE).includes((colour || '').toLowerCase()) ? colour.toLowerCase() : 'auto'})`}</span>
              {isHex(colourHex) && <button type="button" class="ghost" onClick={() => setColourHex('')}>Use colour text</button>}
            </span>
          </Field>
          <Field label="Linked product image (https address)">
            <input type="url" inputMode="url" value={imageUrl} placeholder="https://…" onInput={(e) => setImageUrl((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Hangs on a different rail (rare)">
            <select value={zoneOverride} onChange={(e) => setZoneOverride((e.target as HTMLSelectElement).value)}>
              <option value="">Category default</option>
              {data.zones.map((z) => <option value={z.id} key={z.id}>{z.name}</option>)}
            </select>
          </Field>
        </details>

        {error && <p class="warn" role="alert">{error}</p>}
        <div class="actions sticky">
          {editing ? (
            <>
              <button type="submit" class="primary">Save</button>
              <button type="button" onClick={async () => {
                const lines = [editing.name, editing.brand && `Brand: ${editing.brand}`, editing.size && `Size: ${editing.size}`, editing.material && `Material: ${editing.material}`, editing.colour && `Colour: ${editing.colour}`].filter(Boolean).join('\n');
                try { await navigator.clipboard.writeText(lines); setFlash('Details copied'); } catch { setFlash('Could not copy on this browser'); }
              }}>Copy details</button>
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
