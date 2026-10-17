import { describe, expect, it } from 'vitest';
import { defaultData, SCHEMA_VERSION } from '../data/defaults';
import { BackupError, migrateData, parseBackup } from './migrations';

const good = () => JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: '2026-10-17T00:00:00Z', ...defaultData() });

describe('parseBackup', () => {
  it('round-trips a valid backup', () => {
    const b = parseBackup(good());
    expect(b.zones).toHaveLength(3);
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('rejects non-JSON', () => expect(() => parseBackup('nope')).toThrow(BackupError));
  it('rejects a newer schema with a clear message', () => {
    const doc = { ...JSON.parse(good()), schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => parseBackup(JSON.stringify(doc))).toThrow(/newer version/);
  });
  it('rejects missing sections', () => {
    const doc = JSON.parse(good()); delete doc.items;
    expect(() => parseBackup(JSON.stringify(doc))).toThrow(/items/);
  });
  it('rejects items with unknown category or bad enums', () => {
    const doc = JSON.parse(good());
    doc.items = [{ id: '1', name: 'a', category: 'missing', state: 'pile', fit: 'not-checked', seasons: ['autumn'] }];
    expect(() => parseBackup(JSON.stringify(doc))).toThrow(/invalid item/);
    doc.items = [{ id: '1', name: 'a', category: 'cat-coats', state: 'bogus', fit: 'not-checked', seasons: ['autumn'] }];
    expect(() => parseBackup(JSON.stringify(doc))).toThrow(/invalid item/);
  });
});

describe('v1 to v2 migration', () => {
  const v1 = () => {
    const d = defaultData() as never as { categories: Record<string, unknown>[]; settings: Record<string, unknown> };
    d.categories.forEach((c) => delete c.illustration);
    delete d.settings.showWebImages;
    return { ...d, schemaVersion: 1, exportedAt: '2026-10-01T00:00:00Z' };
  };
  it('imports an old backup, adding illustrations and the web images default', () => {
    const b = parseBackup(JSON.stringify(v1()));
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    expect(b.categories.find((c) => c.name === 'Coats')?.illustration).toBe('coat');
    expect(b.categories.find((c) => c.name === 'Bulky jumpers')?.illustration).toBe('bulky-jumper');
    expect(b.settings.showWebImages).toBe(true);
  });
  it('upgrades data loaded from device storage', () => {
    const { schemaVersion: _s, exportedAt: _e, ...stored } = v1();
    const out = migrateData({ ...stored, settings: { ...stored.settings, schemaVersion: 1 } } as never);
    expect(out.settings.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.categories.every((c) => !!c.illustration)).toBe(true);
  });
  it('leaves current data alone', () => {
    const d = defaultData();
    expect(migrateData(d)).toBe(d);
  });
});

describe('image fields in backups', () => {
  const withItem = (extra: object) => {
    const d = { ...JSON.parse(good()), items: [{ id: '1', name: 'a', category: 'cat-coats', state: 'pile', fit: 'not-checked', seasons: ['autumn'], ...extra }] };
    return parseBackup(JSON.stringify(d));
  };
  it('keeps valid https links and hex colours', () => {
    expect(withItem({ imageUrl: 'https://x.test/a.jpg', colourHex: '#112233' }).items[0]).toMatchObject({ imageUrl: 'https://x.test/a.jpg', colourHex: '#112233' });
  });
  it('drops http links, junk and bad hex without rejecting the backup', () => {
    const it = withItem({ imageUrl: 'http://x.test/a.jpg', colourHex: 'blue' }).items[0];
    expect(it.imageUrl).toBeUndefined();
    expect(it.colourHex).toBeUndefined();
    expect(withItem({ imageUrl: 'javascript:alert(1)' }).items[0].imageUrl).toBeUndefined();
  });
  it('rejects malformed photo data', () => {
    const d = { ...JSON.parse(good()), images: { a: { full: 'nope', thumb: 'x' } } };
    expect(() => parseBackup(JSON.stringify(d))).toThrow(/invalid photo/);
  });
  it('accepts photos as data URLs', () => {
    const d = { ...JSON.parse(good()), images: { a: { full: 'data:image/webp;base64,AAA', thumb: 'data:image/webp;base64,AAA' } } };
    expect(parseBackup(JSON.stringify(d)).images).toHaveProperty('a');
  });
});
