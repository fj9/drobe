import { useEffect, useState } from 'preact/hooks';
import { ACTIVE_PLAN_ID, SCHEMA_VERSION, defaultData, guessIllustration } from '../data/defaults';
import { computeCapacity } from '../engine/capacity';
import { migrateData, parseBackup } from '../engine/migrations';
import { blobToDataUrl, dataUrlToBlob, resizePhoto } from '../io/photo';
import { toCsv } from '../io/csv';
import type { ArchivedReason, Backup, BackupImage, Data, Item, ItemState, Plan } from '../types';
import { IndexedDbRepository, type Repository } from './repository';

let repo: Repository = new IndexedDbRepository();
let data: Data = defaultData();
let ready = false;
let saveError: string | undefined;
type Prev = Pick<Item, 'state' | 'archivedAt' | 'archivedReason' | 'updatedAt'>;
export interface UndoInfo { label: string; prev: { itemId: string; prev: Prev }[] }
let undoInfo: UndoInfo | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function init(r: Repository = repo) {
  repo = r;
  try {
    data = migrateData(await repo.load());
  } catch (e) {
    saveError = `Could not read stored data: ${(e as Error).message}`;
  }
  ready = true;
  emit();
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

async function commit(next: Data) {
  data = next;
  emit();
  try {
    await repo.save(next);
    saveError = undefined;
  } catch (e) {
    saveError = `Could not save: ${(e as Error).message}`;
  }
  emit();
}

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    l(); // catch changes that landed before this effect subscribed
    return () => void listeners.delete(l);
  }, []);
  return { data, ready, saveError, undoInfo };
}

export const activePlan = (d: Data): Plan => d.plans.find((p) => p.id === ACTIVE_PLAN_ID) ?? d.plans[0];
export const capacityOf = (d: Data) => computeCapacity(d.items, d.zones, d.categories, activePlan(d));

const now = () => new Date().toISOString();
const imageCache = new Map<string, { thumb: string; full: string }>();
async function dropImage(id: string) {
  const c = imageCache.get(id);
  if (c) { URL.revokeObjectURL(c.thumb); URL.revokeObjectURL(c.full); imageCache.delete(id); }
  try { await repo.deleteImage(id); } catch { /* orphaned image is harmless */ }
}

/** Object URLs for a stored photo, cached so grids don't re-read IndexedDB on every render. */
export async function photoUrls(id: string): Promise<{ thumb: string; full: string } | undefined> {
  const hit = imageCache.get(id);
  if (hit) return hit;
  const img = await repo.getImage(id);
  if (!img) return undefined;
  const urls = { thumb: URL.createObjectURL(img.thumb), full: URL.createObjectURL(img.full) };
  imageCache.set(id, urls);
  return urls;
}

export async function photosSize(): Promise<{ count: number; bytes: number }> {
  const all = await repo.listImages();
  return { count: all.length, bytes: all.reduce((n, x) => n + x.img.full.size + x.img.thumb.size, 0) };
}
const update = (fn: (d: Data) => void) => { const n = structuredClone(data); fn(n); return commit(n); };

export const actions = {
  addItem(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'state' | 'fit'> & Partial<Pick<Item, 'state' | 'fit'>>) {
    const t = now();
    const id = crypto.randomUUID();
    return update((d) => void d.items.push({ state: 'pile', fit: 'not-checked', ...input, id, createdAt: t, updatedAt: t })).then(() => id);
  },
  updateItem(itemId: string, patch: Partial<Item>) {
    return update((d) => {
      const it = d.items.find((i) => i.id === itemId);
      if (it) Object.assign(it, patch, { updatedAt: now() });
    });
  },
  setState(itemId: string, state: ItemState, reason?: ArchivedReason) {
    return actions.setStateMany([itemId], state, reason);
  },
  setStateMany(ids: string[], state: ItemState, reason?: ArchivedReason) {
    const targets = data.items.filter((i) => ids.includes(i.id));
    if (targets.length === 0) return Promise.resolve();
    const verb = state === 'on-rail' ? 'Put back' : state === 'stored' ? 'Stored' : state === 'archived' ? 'Let go of' : 'Moved to pile';
    undoInfo = {
      label: targets.length === 1 ? `${verb} "${targets[0].name}"` : `${verb} ${targets.length} items`,
      prev: targets.map((it) => ({ itemId: it.id, prev: { state: it.state, archivedAt: it.archivedAt, archivedReason: it.archivedReason, updatedAt: it.updatedAt } })),
    };
    return update((d) => {
      const t = now();
      for (const it of d.items) {
        if (!ids.includes(it.id)) continue;
        it.state = state;
        it.updatedAt = t;
        if (state === 'archived') { it.archivedAt = t; it.archivedReason = reason; }
        else { delete it.archivedAt; delete it.archivedReason; }
      }
    });
  },
  undo() {
    const u = undoInfo;
    undoInfo = undefined;
    if (!u) return emit();
    return update((d) => {
      for (const { itemId, prev } of u.prev) {
        const it = d.items.find((i) => i.id === itemId);
        if (!it) continue;
        it.state = prev.state; it.updatedAt = prev.updatedAt;
        if (prev.archivedAt) it.archivedAt = prev.archivedAt; else delete it.archivedAt;
        if (prev.archivedReason) it.archivedReason = prev.archivedReason; else delete it.archivedReason;
      }
    });
  },
  dismissUndo() { undoInfo = undefined; emit(); },
  async deleteItem(itemId: string) {
    const photoId = data.items.find((i) => i.id === itemId)?.photoId;
    await update((d) => void (d.items = d.items.filter((i) => i.id !== itemId)));
    if (photoId) await dropImage(photoId);
  },
  /** Resizes on the device, stores it, and points the item at it (replacing any earlier photo). */
  async setPhoto(itemId: string, file: Blob) {
    const old = data.items.find((i) => i.id === itemId)?.photoId;
    const img = await resizePhoto(file);
    const photoId = crypto.randomUUID();
    await repo.putImage(photoId, img);
    await update((d) => { const it = d.items.find((i) => i.id === itemId); if (it) { it.photoId = photoId; it.updatedAt = now(); } });
    if (old) await dropImage(old);
    return photoId;
  },
  async removePhoto(itemId: string) {
    const old = data.items.find((i) => i.id === itemId)?.photoId;
    await update((d) => { const it = d.items.find((i) => i.id === itemId); if (it) { delete it.photoId; it.updatedAt = now(); } });
    if (old) await dropImage(old);
  },
  setWebImages(on: boolean) {
    return update((d) => void (d.settings.showWebImages = on));
  },
  dismissWebImagesNote() {
    return update((d) => void (d.settings.webImagesNoteSeen = true));
  },
  setIllustration(categoryId: string, illustration: string) {
    return update((d) => { const c = d.categories.find((c) => c.id === categoryId); if (c) c.illustration = illustration; });
  },
  setCapacity(zoneId: string, capacity: number) {
    return update((d) => { const z = d.zones.find((z) => z.id === zoneId); if (z) z.capacity = capacity; });
  },
  setInchesPerItem(v: number) {
    return update((d) => { activePlan(d).inchesPerItem = v; });
  },
  setTarget(categoryId: string, target: number | undefined) {
    return update((d) => {
      const a = activePlan(d).allocations;
      if (target === undefined) delete a[categoryId]; else a[categoryId] = target;
    });
  },
  addCategory(name: string, zoneId: string) {
    return update((d) => void d.categories.push({ id: `cat-${crypto.randomUUID().slice(0, 8)}`, name, defaultZone: zoneId, illustration: guessIllustration(name) }));
  },
  editCategory(categoryId: string, patch: { name?: string; defaultZone?: string }) {
    return update((d) => { const c = d.categories.find((c) => c.id === categoryId); if (c) Object.assign(c, patch); });
  },
  /** Only allowed when no items use it; callers check categoryItemCount first. */
  deleteCategory(categoryId: string) {
    return update((d) => {
      d.categories = d.categories.filter((c) => c.id !== categoryId);
      delete activePlan(d).allocations[categoryId];
    });
  },
  setTheme(theme: Data['settings']['theme']) {
    return update((d) => void (d.settings.theme = theme));
  },
  skipTarget(categoryId: string) {
    return update((d) => {
      const list = new Set(d.settings.noTargetNeeded ?? []);
      list.add(categoryId);
      d.settings.noTargetNeeded = [...list];
    });
  },
  finishOnboarding() {
    return update((d) => void (d.settings.onboarded = true));
  },
  replaceData(next: Data) {
    return commit(next);
  },
  async clearAll() {
    await repo.clear();
    imageCache.forEach((c) => { URL.revokeObjectURL(c.thumb); URL.revokeObjectURL(c.full); });
    imageCache.clear();
    return commit(defaultData());
  },
  markBackedUp() {
    return update((d) => void (d.settings.lastBackupDate = now()));
  },
};

export const categoryItemCount = (d: Data, categoryId: string) => d.items.filter((i) => i.category === categoryId).length;

export function buildBackup(d: Data): Backup {
  return { schemaVersion: SCHEMA_VERSION, exportedAt: now(), ...d, settings: { ...d.settings, schemaVersion: SCHEMA_VERSION } };
}

/** Backup document; photos are included as base64 only when asked for. */
export async function exportBackup(includePhotos: boolean): Promise<Backup> {
  const b = buildBackup(data);
  if (!includePhotos) return b;
  const wanted = new Set(data.items.map((i) => i.photoId).filter(Boolean) as string[]);
  const images: Record<string, BackupImage> = {};
  for (const { id, img } of await repo.listImages()) {
    if (wanted.has(id)) images[id] = { full: await blobToDataUrl(img.full), thumb: await blobToDataUrl(img.thumb) };
  }
  return { ...b, images };
}

/** Merge: add records with ids not already present. Replace: swap everything. */
export function mergeBackup(base: Data, incoming: Backup): Data {
  const next = structuredClone(base);
  const have = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const z = have(next.zones); const c = have(next.categories); const i = have(next.items); const p = have(next.plans);
  next.zones.push(...incoming.zones.filter((x) => !z.has(x.id)));
  next.categories.push(...incoming.categories.filter((x) => !c.has(x.id)));
  next.items.push(...incoming.items.filter((x) => !i.has(x.id)));
  next.plans.push(...incoming.plans.filter((x) => !p.has(x.id)));
  return next;
}

export async function restoreFromText(text: string, mode: 'merge' | 'replace') {
  const b = parseBackup(text); // throws before anything is written
  const { schemaVersion: _s, exportedAt: _e, images, ...rest } = b;
  const blobs: { id: string; img: { full: Blob; thumb: Blob } }[] = [];
  for (const [id, v] of Object.entries(images ?? {})) {
    blobs.push({ id, img: { full: await dataUrlToBlob(v.full), thumb: await dataUrlToBlob(v.thumb) } });
  }
  if (mode === 'replace') {
    await repo.clearImages();
    imageCache.forEach((c) => { URL.revokeObjectURL(c.thumb); URL.revokeObjectURL(c.full); });
    imageCache.clear();
  }
  for (const { id, img } of blobs) await repo.putImage(id, img);
  return mode === 'replace' ? actions.replaceData(rest) : actions.replaceData(mergeBackup(data, b));
}

export const itemsCsv = (d: Data) =>
  toCsv([
    ['name', 'category', 'seasons', 'fit', 'state', 'brand', 'size', 'material', 'colour', 'notes', 'archived_reason', 'image_url', 'colour_hex'],
    ...d.items.map((i) => [
      i.name, d.categories.find((c) => c.id === i.category)?.name, i.seasons.join(';'), i.fit, i.state,
      i.brand, i.size, i.material, i.colour, i.notes, i.archivedReason, i.imageUrl, i.colourHex,
    ]),
  ]);
export const categoriesCsv = (d: Data) => {
  const p = activePlan(d);
  return toCsv([['category', 'rail', 'target'], ...d.categories.map((c) => [c.name, d.zones.find((z) => z.id === c.defaultZone)?.name, p.allocations[c.id]])]);
};
export const railsCsv = (d: Data) =>
  toCsv([['rail', 'capacity_inches'], ...[...d.zones].sort((a, b) => a.order - b.order).map((z) => [z.name, z.capacity])]);

export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);
