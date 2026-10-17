import { SCHEMA_VERSION, guessIllustration } from '../data/defaults';
import { FITS, SEASONS, STATES, type Backup, type BackupImage, type Data } from '../types';

export class BackupError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Each entry upgrades a document from version N to N+1. */
export const MIGRATIONS: Record<number, (doc: Obj) => Obj> = {
  // v1 -> v2: item images. Categories gain an illustration; linked images default to on.
  1: (doc) => {
    const categories = (Array.isArray(doc.categories) ? doc.categories : []).map((c) =>
      isObj(c) && typeof c.name === 'string' && c.illustration === undefined ? { ...c, illustration: guessIllustration(c.name) } : c,
    );
    const settings = isObj(doc.settings) ? { ...doc.settings, showWebImages: doc.settings.showWebImages ?? true } : doc.settings;
    return { ...doc, categories, settings };
  },
};

/** Upgrades data loaded from the device's own storage. */
export function migrateData(data: Data): Data {
  const v = data.settings?.schemaVersion ?? 1;
  if (v >= SCHEMA_VERSION) return data;
  const out = migrate({ ...data, schemaVersion: v } as unknown as Obj) as unknown as Data & { schemaVersion?: number };
  delete out.schemaVersion;
  out.settings = { ...out.settings, schemaVersion: SCHEMA_VERSION };
  return out;
}

const HTTPS = /^https:\/\//i;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

function cleanImages(raw: unknown): Record<string, BackupImage> | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) throw new BackupError('Backup has invalid "images".');
  const out: Record<string, BackupImage> = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!isObj(v) || typeof v.full !== 'string' || typeof v.thumb !== 'string' || !v.full.startsWith('data:image/') || !v.thumb.startsWith('data:image/')) {
      throw new BackupError('Backup contains an invalid photo.');
    }
    out[id] = { full: v.full, thumb: v.thumb };
  }
  return out;
}

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
  const images = cleanImages(doc.images);
  for (const it of items as Obj[]) {
    // Optional image fields: drop anything unsafe or malformed rather than rejecting the backup.
    if (typeof it.imageUrl !== 'string' || !HTTPS.test(it.imageUrl)) delete it.imageUrl;
    if (typeof it.colourHex !== 'string' || !HEX6.test(it.colourHex)) delete it.colourHex;
    if (typeof it.photoId !== 'string') delete it.photoId;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    ...(images ? { images } : {}),
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
