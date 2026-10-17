import { defaultData } from '../data/defaults';
import type { Data } from '../types';

/** The UI only ever talks to this interface, so the store can be swapped later. */
export interface StoredImage { full: Blob; thumb: Blob }

export interface Repository {
  load(): Promise<Data>;
  save(data: Data): Promise<void>;
  clear(): Promise<void>;
  putImage(id: string, img: StoredImage): Promise<void>;
  getImage(id: string): Promise<StoredImage | undefined>;
  deleteImage(id: string): Promise<void>;
  listImages(): Promise<{ id: string; img: StoredImage }[]>;
  clearImages(): Promise<void>;
}

const DB = 'wardrobe';
const STORE = 'kv';
const IMAGES = 'images';
const KEY = 'data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES); // photos live apart from the main data
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => { db.close(); resolve(req.result); };
        t.onerror = () => { db.close(); reject(t.error); };
        t.onabort = () => { db.close(); reject(t.error); };
      }),
  );
}

export class IndexedDbRepository implements Repository {
  async load(): Promise<Data> {
    const stored = await tx<Data | undefined>('readonly', (s) => s.get(KEY));
    return stored ?? defaultData();
  }
  async save(data: Data): Promise<void> {
    // Round-trip through JSON to strip Preact proxies / non-cloneable values.
    await tx('readwrite', (s) => s.put(JSON.parse(JSON.stringify(data)), KEY));
  }
  async clear(): Promise<void> {
    await tx('readwrite', (s) => s.delete(KEY));
    await this.clearImages();
  }
  async putImage(id: string, img: StoredImage): Promise<void> {
    await tx('readwrite', (s) => s.put(img, id), IMAGES);
  }
  async getImage(id: string): Promise<StoredImage | undefined> {
    return tx<StoredImage | undefined>('readonly', (s) => s.get(id), IMAGES);
  }
  async deleteImage(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id), IMAGES);
  }
  async listImages(): Promise<{ id: string; img: StoredImage }[]> {
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys(), IMAGES);
    const vals = await tx<StoredImage[]>('readonly', (s) => s.getAll(), IMAGES);
    return keys.map((k, i) => ({ id: String(k), img: vals[i] }));
  }
  async clearImages(): Promise<void> {
    await tx('readwrite', (s) => s.clear(), IMAGES);
  }
}
