import { beforeEach, describe, expect, it } from 'vitest';
import { defaultData } from '../data/defaults';
import { applyImport, planImport, type ItemsPlan } from '../io/import';
import type { Data } from '../types';
import type { Repository, StoredImage } from './repository';
import {
  actions, activePlan, buildBackup, capacityOf, categoriesCsv, exportBackup, init, itemsCsv, railsCsv, restoreFromText,
} from './store';

class MemoryRepo implements Repository {
  saved: Data | undefined;
  fail = false;
  async load() { return this.saved ? structuredClone(this.saved) : defaultData(); }
  async save(d: Data) { if (this.fail) throw new Error('disk full'); this.saved = structuredClone(d); }
  images = new Map<string, StoredImage>();
  async clear() { this.saved = undefined; this.images.clear(); }
  async putImage(id: string, img: StoredImage) { this.images.set(id, img); }
  async getImage(id: string) { return this.images.get(id); }
  async deleteImage(id: string) { this.images.delete(id); }
  async listImages() { return [...this.images].map(([id, img]) => ({ id, img })); }
  async clearImages() { this.images.clear(); }
}

let repo: MemoryRepo;
// The hook needs a renderer, so read back what was persisted instead.
const snapshot = () => repo.load();

beforeEach(async () => {
  repo = new MemoryRepo();
  await init(repo);
  await actions.clearAll();
  await init(repo);
});

const add = async (name: string, category = 'cat-tops') => {
  await actions.addItem({ name, category, seasons: ['autumn'] });
  return (await snapshot()).items.find((i) => i.name === name)!;
};

describe('sorting actions', () => {
  it('moves items between states and updates rail counts', async () => {
    const it = await add('Tee');
    await actions.setState(it.id, 'on-rail');
    let d = await snapshot();
    expect(capacityOf(d).zones['zone-short'].usedInches).toBe(1);
    await actions.setState(it.id, 'archived', 'sold');
    d = await snapshot();
    expect(capacityOf(d).zones['zone-short'].usedInches).toBe(0);
    expect(d.items[0]).toMatchObject({ state: 'archived', archivedReason: 'sold' });
    expect(d.items[0].archivedAt).toBeTruthy();
  });

  it('clears archive fields when an item leaves the archive', async () => {
    const it = await add('Tee');
    await actions.setState(it.id, 'archived', 'donated');
    await actions.setState(it.id, 'pile');
    const d = await snapshot();
    expect(d.items[0].archivedAt).toBeUndefined();
    expect(d.items[0].archivedReason).toBeUndefined();
  });

  it('undoes a single change', async () => {
    const it = await add('Tee');
    await actions.setState(it.id, 'on-rail');
    await actions.undo();
    expect((await snapshot()).items[0].state).toBe('pile');
  });

  it('undoes a bulk change in one step, restoring each item\'s own previous state', async () => {
    const a = await add('A'); const b = await add('B'); const c = await add('C');
    await actions.setState(a.id, 'stored');
    await actions.setState(b.id, 'on-rail');
    await actions.setStateMany([a.id, b.id, c.id], 'archived', 'other');
    expect((await snapshot()).items.every((i) => i.state === 'archived')).toBe(true);
    await actions.undo();
    const d = await snapshot();
    const by = (n: string) => d.items.find((i) => i.name === n)!;
    expect([by('A').state, by('B').state, by('C').state]).toEqual(['stored', 'on-rail', 'pile']);
    expect(by('B').archivedReason).toBeUndefined();
  });

  it('only undoes the latest action', async () => {
    const a = await add('A');
    await actions.setState(a.id, 'on-rail');
    await actions.setState(a.id, 'stored');
    await actions.undo();
    await actions.undo(); // nothing left to undo
    expect((await snapshot()).items[0].state).toBe('on-rail');
  });

  it('ignores unknown ids', async () => {
    await expect(actions.setStateMany(['nope'], 'on-rail')).resolves.toBeUndefined();
  });
});

describe('settings and categories', () => {
  it('sets and clears targets', async () => {
    await actions.setTarget('cat-tops', 14);
    expect(activePlan(await snapshot()).allocations['cat-tops']).toBe(14);
    await actions.setTarget('cat-tops', undefined);
    expect(activePlan(await snapshot()).allocations['cat-tops']).toBeUndefined();
  });
  it('removes a deleted category\'s target', async () => {
    await actions.setTarget('cat-coats', 5);
    await actions.deleteCategory('cat-coats');
    const d = await snapshot();
    expect(d.categories.some((c) => c.id === 'cat-coats')).toBe(false);
    expect(activePlan(d).allocations['cat-coats']).toBeUndefined();
  });
  it('remembers categories that need no target, without duplicates', async () => {
    await actions.skipTarget('cat-coats');
    await actions.skipTarget('cat-coats');
    expect((await snapshot()).settings.noTargetNeeded).toEqual(['cat-coats']);
  });
  it('deletes an item for good', async () => {
    const it = await add('Tee');
    await actions.deleteItem(it.id);
    expect((await snapshot()).items).toHaveLength(0);
  });
  it('keeps in-memory state and reports an error when saving fails', async () => {
    repo.fail = true;
    await actions.addItem({ name: 'X', category: 'cat-tops', seasons: ['autumn'] });
    expect(repo.saved?.items ?? []).toHaveLength(0); // nothing persisted
  });
});

describe('smoke: add, sort, export, wipe, import restores everything', () => {
  it('round-trips a backup exactly', async () => {
    await actions.setCapacity('zone-long', 25);
    await actions.setTarget('cat-tops', 10);
    const a = await add('Tee'); const b = await add('Coat', 'cat-coats');
    await actions.setState(a.id, 'on-rail');
    await actions.setState(b.id, 'archived', 'sold');
    const before = await snapshot();
    const text = JSON.stringify(buildBackup(before));

    await actions.clearAll();
    expect((await snapshot()).items).toHaveLength(0);
    await restoreFromText(text, 'replace');
    const after = await snapshot();
    expect(after).toEqual({ ...before, settings: { ...before.settings } });
  });

  it('merge adds only what is missing', async () => {
    const a = await add('Tee');
    const text = JSON.stringify(buildBackup(await snapshot()));
    await add('Extra');
    await restoreFromText(text, 'merge');
    const d = await snapshot();
    expect(d.items.map((i) => i.name).sort()).toEqual(['Extra', 'Tee']);
    expect(d.items.filter((i) => i.id === a.id)).toHaveLength(1);
  });

  it('a bad or newer backup changes nothing', async () => {
    await add('Tee');
    await expect(restoreFromText('{"schemaVersion":99}', 'replace')).rejects.toThrow(/newer/);
    await expect(restoreFromText('nope', 'replace')).rejects.toThrow();
    expect((await snapshot()).items).toHaveLength(1);
  });
});

describe('photos', () => {
  const blob = (t: string) => new Blob([t], { type: 'image/webp' });
  const seedPhoto = async (itemId: string) => {
    const photoId = crypto.randomUUID();
    await repo.putImage(photoId, { full: blob('full'), thumb: blob('thumb') });
    await actions.updateItem(itemId, { photoId });
    return photoId;
  };
  it('deleting an item deletes its photo', async () => {
    const it = await add('Tee');
    const pid = await seedPhoto(it.id);
    await actions.deleteItem(it.id);
    expect(await repo.getImage(pid)).toBeUndefined();
  });
  it('removing a photo clears the reference and the stored image', async () => {
    const it = await add('Tee');
    const pid = await seedPhoto(it.id);
    await actions.removePhoto(it.id);
    expect((await snapshot()).items[0].photoId).toBeUndefined();
    expect(await repo.getImage(pid)).toBeUndefined();
  });
  it('export with photos then replace-import restores them; without photos exports none', async () => {
    const it = await add('Tee');
    const pid = await seedPhoto(it.id);
    const plain = await exportBackup(false);
    expect(plain.images).toBeUndefined();
    const text = JSON.stringify(await exportBackup(true));
    await actions.clearAll();
    expect(await repo.getImage(pid)).toBeUndefined();
    await restoreFromText(text, 'replace');
    const back = await repo.getImage(pid);
    expect(await back!.full.text()).toBe('full');
    expect(await back!.thumb.text()).toBe('thumb');
    expect((await snapshot()).items[0].photoId).toBe(pid);
  });
  it('clear all removes photos', async () => {
    const it = await add('Tee');
    const pid = await seedPhoto(it.id);
    await actions.clearAll();
    expect(await repo.getImage(pid)).toBeUndefined();
  });
});

describe('imageHarvested flag', () => {
  it('is set only for items with a link, and cleared when the link changes or is removed', async () => {
    await actions.addItem({ name: 'Linked', category: 'cat-tops', seasons: ['autumn'], imageUrl: 'https://a.test/1.jpg' });
    await actions.addItem({ name: 'Plain', category: 'cat-tops', seasons: ['autumn'] });
    let d = await snapshot();
    const linked = d.items.find((i) => i.name === 'Linked')!;
    const plain = d.items.find((i) => i.name === 'Plain')!;
    await actions.markImagesHarvested([linked.id, plain.id]);
    d = await snapshot();
    expect(d.items.find((i) => i.name === 'Linked')!.imageHarvested).toBe(true);
    expect(d.items.find((i) => i.name === 'Plain')!.imageHarvested).toBeUndefined();

    await actions.updateItem(linked.id, { notes: 'unrelated edit', imageUrl: 'https://a.test/1.jpg' });
    expect((await snapshot()).items.find((i) => i.id === linked.id)!.imageHarvested).toBe(true);

    await actions.updateItem(linked.id, { imageUrl: 'https://a.test/2.jpg' });
    expect((await snapshot()).items.find((i) => i.id === linked.id)!.imageHarvested).toBeUndefined();

    await actions.markImagesHarvested([linked.id]);
    await actions.updateItem(linked.id, { imageUrl: undefined });
    expect((await snapshot()).items.find((i) => i.id === linked.id)!.imageHarvested).toBeUndefined();
  });
  it('survives a backup round trip', async () => {
    await actions.addItem({ name: 'L', category: 'cat-tops', seasons: ['autumn'], imageUrl: 'https://a.test/1.jpg' });
    const id = (await snapshot()).items[0].id;
    await actions.markImagesHarvested([id]);
    const text = JSON.stringify(await exportBackup(false));
    await actions.clearAll();
    await restoreFromText(text, 'replace');
    expect((await snapshot()).items[0].imageHarvested).toBe(true);
  });
});

describe('CSV export includes image_harvested', () => {
  it('round-trips the flag through export and import', async () => {
    await actions.addItem({ name: 'Linked', category: 'cat-tops', seasons: ['autumn'], imageUrl: 'https://a.test/1.jpg' });
    await actions.addItem({ name: 'Other', category: 'cat-tops', seasons: ['autumn'], imageUrl: 'https://a.test/2.jpg' });
    const first = (await snapshot()).items.find((i) => i.name === 'Linked')!;
    await actions.markImagesHarvested([first.id]);
    const csv = itemsCsv(await snapshot());
    expect(csv.split('\n')[0].endsWith('image_url,colour_hex,image_harvested')).toBe(true);
    const re = applyImport(planImport(csv, defaultData()) as ItemsPlan, defaultData());
    expect(re.items.find((i) => i.name === 'Linked')!.imageHarvested).toBe(true);
    expect(re.items.find((i) => i.name === 'Other')!.imageHarvested).toBeUndefined();
  });
});

describe('CSV export round-trips through import', () => {
  it('exports items that re-import identically', async () => {
    await actions.addItem({ name: 'Wool, navy "cardigan"', category: 'cat-cardigans', seasons: ['autumn', 'winter'], brand: 'A, B', size: 'M', notes: 'line' });
    const d = await snapshot();
    const csv = itemsCsv(d);
    const p = planImport(csv, defaultData()) as ItemsPlan;
    expect(p.problems).toEqual([]);
    const re = applyImport(p, defaultData());
    expect(re.items[0]).toMatchObject({ name: 'Wool, navy "cardigan"', brand: 'A, B', seasons: ['autumn', 'winter'], size: 'M' });
  });
  it('exports rails and categories with targets', async () => {
    await actions.setTarget('cat-tops', 14);
    const d = await snapshot();
    expect(railsCsv(d).split('\n')[1]).toBe('Short,78');
    expect(categoriesCsv(d)).toContain('Tops,Short,14');
  });
});
