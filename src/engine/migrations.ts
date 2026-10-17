import { SCHEMA_VERSION } from '../data/defaults';
import { FITS, SEASONS, STATES, type Backup } from '../types';

export class BackupError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Each entry upgrades a document from version N to N+1. */
export const MIGRATIONS: Record<number, (doc: Obj) => Obj> = {};

export function migrate(doc: Obj): Obj {
  let v = doc.schemaVersion as number;
  let cur = doc;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new BackupError(`No migration from schema version ${v}.`);
    cur = step(cur);
    v++;
    cur.schemaVersion = v;
  }
  return cur;
}

function arr(doc: Obj, key: string): unknown[] {
  const v = doc[key];
  if (!Array.isArray(v)) throw new BackupError(`Backup is missing "${key}".`);
  return v;
}

/** Parses and validates a backup. Throws BackupError and never returns partial data. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }
  if (!isObj(raw)) throw new BackupError('That file is not a wardrobe backup.');
  const sv = raw.schemaVersion;
  if (typeof sv !== 'number' || !Number.isInteger(sv) || sv < 1) throw new BackupError('Backup has no valid schemaVersion.');
  if (sv > SCHEMA_VERSION) {
    throw new BackupError(`This backup is from a newer version of the app (schema ${sv}). Update the app and try again.`);
  }
  const doc = migrate(raw);

  const items = arr(doc, 'items');
  const zones = arr(doc, 'zones');
  const categories = arr(doc, 'categories');
  const plans = arr(doc, 'plans');
  if (!isObj(doc.settings)) throw new BackupError('Backup is missing "settings".');

  const zoneIds = new Set<string>();
  for (const z of zones) {
    if (!isObj(z) || typeof z.id !== 'string' || typeof z.name !== 'string' || typeof z.capacity !== 'number') {
      throw new BackupError('Backup contains an invalid rail.');
    }
    zoneIds.add(z.id);
  }
  const catIds = new Set<string>();
  for (const c of categories) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.defaultZone !== 'string') {
      throw new BackupError('Backup contains an invalid category.');
    }
    catIds.add(c.id);
  }
  for (const p of plans) {
    if (!isObj(p) || typeof p.id !== 'string' || typeof p.inchesPerItem !== 'number' || !isObj(p.allocations) || !Array.isArray(p.seasons)) {
      throw new BackupError('Backup contains an invalid plan.');
    }
  }
  for (const it of items) {
    if (
      !isObj(it) || typeof it.id !== 'string' || typeof it.name !== 'string' ||
      typeof it.category !== 'string' || !catIds.has(it.category) ||
      !STATES.includes(it.state as never) || !FITS.includes(it.fit as never) ||
      !Array.isArray(it.seasons) || it.seasons.length === 0 || !it.seasons.every((s) => SEASONS.includes(s as never))
    ) {
      throw new BackupError(`Backup contains an invalid item${isObj(it) && typeof it.name === 'string' ? ` ("${it.name}")` : ''}.`);
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof doc.exportedAt === 'string' ? doc.exportedAt : new Date().toISOString(),
    items: items as Backup['items'],
    zones: zones as Backup['zones'],
    categories: categories as Backup['categories'],
    plans: plans as Backup['plans'],
    settings: { ...(doc.settings as Obj), schemaVersion: SCHEMA_VERSION } as Backup['settings'],
  };
}

export interface BackupSummary { items: number; zones: number; categories: number; plans: number }
export const summarise = (b: Backup): BackupSummary => ({
  items: b.items.length, zones: b.zones.length, categories: b.categories.length, plans: b.plans.length,
});
