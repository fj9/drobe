import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, DEFAULT_PLAN, DEFAULT_ZONES } from '../data/defaults';
import type { Item } from '../types';
import { computeCapacity } from './capacity';

const item = (o: Partial<Item>): Item => ({
  id: crypto.randomUUID(), name: 'x', category: 'cat-cardigans', state: 'pile', fit: 'not-checked',
  seasons: ['autumn'], createdAt: '', updatedAt: '', ...o,
});
const plan = (o = {}) => ({ ...DEFAULT_PLAN, allocations: { 'cat-cardigans': 8 }, ...o });

describe('computeCapacity', () => {
  it('counts only on-rail items as used inches', () => {
    const items = [item({ state: 'on-rail' }), item({ state: 'on-rail' }), item({ state: 'pile' }), item({ state: 'stored' }), item({ state: 'archived' })];
    const r = computeCapacity(items, DEFAULT_ZONES, DEFAULT_CATEGORIES, plan());
    expect(r.zones['zone-medium'].usedInches).toBe(2);
    expect(r.zones['zone-short'].usedInches).toBe(0);
    expect(r.categories['cat-cardigans']).toMatchObject({ onRail: 2, inPile: 1, needed: 6, surplus: 0 });
  });
  it('flags over capacity with the overage, never blocking', () => {
    const items = Array.from({ length: 22 }, () => item({ category: 'cat-coats', state: 'on-rail' }));
    const z = computeCapacity(items, DEFAULT_ZONES, DEFAULT_CATEGORIES, plan()).zones['zone-long'];
    expect(z.status).toBe('over');
    expect(z.overInches).toBe(2);
    expect(z.freeInches).toBe(-2);
  });
  it('respects inches per item and zone override', () => {
    const items = [item({ state: 'on-rail', zoneOverride: 'zone-long' })];
    const r = computeCapacity(items, DEFAULT_ZONES, DEFAULT_CATEGORIES, plan({ inchesPerItem: 2 }));
    expect(r.zones['zone-long'].usedInches).toBe(2);
    expect(r.zones['zone-medium'].usedInches).toBe(0);
  });
  it('computes surplus and never negative needed', () => {
    const items = Array.from({ length: 10 }, () => item({ state: 'on-rail' }));
    const c = computeCapacity(items, DEFAULT_ZONES, DEFAULT_CATEGORIES, plan()).categories['cat-cardigans'];
    expect(c.needed).toBe(0);
    expect(c.surplus).toBe(2);
  });
  it('hides out-of-season pile items from the pile count', () => {
    const items = [item({ seasons: ['summer'] }), item({ seasons: ['all-year'] }), item({ seasons: ['winter'] })];
    expect(computeCapacity(items, DEFAULT_ZONES, DEFAULT_CATEGORIES, plan()).categories['cat-cardigans'].inPile).toBe(2);
  });
  it('warns when targets exceed rail capacity', () => {
    const r = computeCapacity([], DEFAULT_ZONES, DEFAULT_CATEGORIES, plan({ allocations: { 'cat-coats': 15, 'cat-long-dresses': 10 } }));
    expect(r.zones['zone-long'].targetsOver).toBe(true);
    expect(r.zones['zone-short'].targetsOver).toBe(false);
  });
});
