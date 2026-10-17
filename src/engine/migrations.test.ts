import { describe, expect, it } from 'vitest';
import { defaultData, SCHEMA_VERSION } from '../data/defaults';
import { BackupError, parseBackup } from './migrations';

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
