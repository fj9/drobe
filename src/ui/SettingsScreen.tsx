import { useEffect, useState } from 'preact/hooks';
import { ILLUSTRATIONS } from '../data/defaults';
import { Art, illustrationOf, webImagesOn } from './art';
import { ImageDownload } from './ImageDownload';
import {
  actions, activePlan, categoriesCsv, categoryItemCount, download, exportBackup, itemsCsv, photosSize, railsCsv, today, useStore, capacityOf,
} from '../store/store';
import { CsvImport, JsonImport } from './ImportPanel';
import { ConfirmButton, Field, NumberInput } from './common';

export const APP_VERSION = '0.1.0';

export function SettingsScreen() {
  const { data } = useStore();
  const plan = activePlan(data);
  const cap = capacityOf(data);
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  useEffect(() => { if (location.hash === '#/settings/csv') document.getElementById('csv')?.scrollIntoView(); }, []);
  const [newCat, setNewCat] = useState('');
  const [newCatZone, setNewCatZone] = useState(zones[0]?.id ?? '');

  const [withPhotos, setWithPhotos] = useState(false);
  const [photoInfo, setPhotoInfo] = useState({ count: 0, bytes: 0 });
  useEffect(() => { photosSize().then(setPhotoInfo).catch(() => {}); }, [data.items]);
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

  const exportJson = async () => {
    const backup = await exportBackup(withPhotos && photoInfo.count > 0);
    download(`wardrobe-backup-${today()}.json`, JSON.stringify(backup));
    await actions.markBackedUp();
  };

  return (
    <section>
      <h1>Settings</h1>

      <h2>Rails</h2>
      <div class="card">
        {zones.map((z) => (
          <div class="setting-row" key={z.id}>
            <span>{z.name} rail (inches)</span>
            <NumberInput label={`${z.name} capacity in inches`} value={z.capacity} onChange={(n) => n !== undefined && actions.setCapacity(z.id, n)} />
          </div>
        ))}
        <div class="setting-row">
          <span>Inches per item</span>
          <NumberInput label="Inches per item" min={1} value={plan.inchesPerItem} onChange={(n) => n !== undefined && n >= 1 && actions.setInchesPerItem(n)} />
        </div>
      </div>

      <h2>Categories and targets</h2>
      <p class="muted small">Targets are a guide, not a rule. A rail warns if its targets add up to more than its capacity.</p>
      {zones.map((z) => {
        const zr = cap.zones[z.id];
        const cats = data.categories.filter((c) => c.defaultZone === z.id);
        return (
          <div class="card" key={z.id}>
            <h3>{z.name} rail <span class="muted small">targets {zr.targetInches} of {z.capacity} in</span></h3>
            {zr.targetsOver && <p class="warn small">Targets add up to more than this rail's capacity.</p>}
            {cats.map((c) => (
              <div class="setting-row cat-row" key={c.id}>
                <input aria-label="Category name" value={c.name} onChange={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) actions.editCategory(c.id, { name: v }); }} />
                <select aria-label={`${c.name} rail`} value={c.defaultZone} onChange={(e) => actions.editCategory(c.id, { defaultZone: (e.target as HTMLSelectElement).value })}>
                  {zones.map((zz) => <option value={zz.id} key={zz.id}>{zz.name}</option>)}
                </select>
                <NumberInput label={`${c.name} target`} value={plan.allocations[c.id]} onChange={(n) => actions.setTarget(c.id, n)} />
                <ConfirmButton class="ghost" label="✕" ariaLabel={`Delete ${c.name}`} confirmLabel={`Delete ${c.name}`} disabledReason={categoryItemCount(data, c.id) > 0 ? `${categoryItemCount(data, c.id)} item(s) use this. Move or delete them first.` : undefined} onConfirm={() => actions.deleteCategory(c.id)} />
              </div>
            ))}
          </div>
        );
      })}
      <form class="card inline-form" onSubmit={(e) => { e.preventDefault(); if (newCat.trim() && newCatZone) { actions.addCategory(newCat.trim(), newCatZone); setNewCat(''); } }}>
        <Field label="New category">
          <input value={newCat} onInput={(e) => setNewCat((e.target as HTMLInputElement).value)} placeholder="e.g. Jeans" />
        </Field>
        <Field label="Rail">
          <select value={newCatZone} onChange={(e) => setNewCatZone((e.target as HTMLSelectElement).value)}>
            {zones.map((z) => <option value={z.id} key={z.id}>{z.name}</option>)}
          </select>
        </Field>
        <button class="primary" type="submit">Add category</button>
      </form>

      <h2>Backup</h2>
      <div class="card">
        <p class="small muted">{data.settings.lastBackupDate ? `Last backup: ${new Date(data.settings.lastBackupDate).toLocaleDateString()}` : 'No backup yet.'} Data lives only on this device.</p>
        {photoInfo.count > 0 && (
          <label class="check">
            <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos((e.target as HTMLInputElement).checked)} />
            Include photos ({photoInfo.count} photos, about {mb(photoInfo.bytes * 1.34)} MB in the file)
          </label>
        )}
        <div class="actions"><button class="primary" onClick={exportJson}>Export backup (JSON)</button></div>
        <h3>Restore</h3>
        <JsonImport />
      </div>

      <h2 id="csv">CSV</h2>
      <div class="card">
        <h3>Import</h3>
        <CsvImport />
        <h3>Export</h3>
        <div class="actions">
          <button onClick={() => download(`items-${today()}.csv`, itemsCsv(data), 'text/csv')}>Items</button>
          <button onClick={() => download(`categories-${today()}.csv`, categoriesCsv(data), 'text/csv')}>Categories</button>
          <button onClick={() => download(`rails-${today()}.csv`, railsCsv(data), 'text/csv')}>Rails</button>
        </div>
      </div>

      <h2>Pictures</h2>
      <div class="card">
        <label class="check">
          <input type="checkbox" checked={webImagesOn(data)} onChange={(e) => actions.setWebImages((e.target as HTMLInputElement).checked)} />
          Show product images from the web
        </label>
        <p class="muted small">Off means the app never requests linked images and shows drawings instead. When on, showing a linked image tells that website this device asked for it. No referrer is sent.</p>
        <ImageDownload />
        <details>
          <summary>Drawing for each category</summary>
          {data.categories.map((c) => (
            <div class="setting-row" key={c.id}>
              <span class="reasons"><span class="thumb-sm"><Art illustration={illustrationOf(c)} colour="#9A9A9A" /></span>{c.name}</span>
              <select aria-label={`${c.name} drawing`} value={illustrationOf(c)} onChange={(e) => actions.setIllustration(c.id, (e.target as HTMLSelectElement).value)}>
                {ILLUSTRATIONS.map((i) => <option value={i} key={i}>{i}</option>)}
              </select>
            </div>
          ))}
        </details>
      </div>

      <h2>Appearance</h2>
      <div class="card">
        <Field label="Theme">
          <select value={data.settings.theme} onChange={(e) => actions.setTheme((e.target as HTMLSelectElement).value as 'system')}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </Field>
      </div>

      <h2>Install</h2>
      <div class="card small">
        <p><b>iPhone / iPad (Safari):</b> tap Share, then Add to Home Screen.</p>
        <p><b>Android (Chrome):</b> menu, then Install app.</p>
        <p>After the first visit the app works offline.</p>
      </div>

      <h2>Danger zone</h2>
      <div class="card">
        <ConfirmButton label="Clear all data" confirmLabel="Yes, delete everything on this device" onConfirm={() => actions.clearAll()} />
      </div>

      <p class="muted small center">Wardrobe Manager v{APP_VERSION} · schema {data.settings.schemaVersion}</p>
    </section>
  );
}
