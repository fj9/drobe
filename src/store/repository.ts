import { defaultData } from '../data/defaults';
import type { Data } from '../types';

/** The UI only ever talks to this interface, so the store can be swapped later. */
export interface Repository {
  load(): Promise<Data>;
  save(data: Data): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'wardrobe';
const STORE = 'kv';
const KEY = 'data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
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
  }
}
