import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultData } from '../data/defaults';
import { parseCsv, toCsv } from './csv';
import { applyImport, planImport, type CategoriesPlan, type ItemsPlan, type RailsPlan } from './import';

describe('csv', () => {
  it('handles quotes, commas, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
  it('round-trips through toCsv', () => {
    const rows = [['a', 'b,c'], ['"q"', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('items import', () => {
  const data = defaultData();
  it('defaults blanks and rejects bad rows', () => {
    const p = planImport('Name,Category,fit,seasons\nA,Tops,,\n,Tops,,\nB,,,\nC,Tops,wrong,\nD,Tops,,autumn;monsoon\nE,Tops,fits-well,winter;autumn', data) as ItemsPlan;
    expect(p.toAdd.map((i) => i.name)).toEqual(['A', 'E']);
    expect(p.toAdd[0]).toMatchObject({ seasons: ['all-year'], fit: 'not-checked', state: 'pile' });
    expect(p.problems).toHaveLength(4);
  });
  it('flags duplicates and unknown categories without writing', () => {
    const d = applyImport(planImport('name,category,brand,size\nShirt,Tops,Acme,M', data) as ItemsPlan, data, { categoryMap: {} });
    const p = planImport('name,category,brand,size\nshirt,Mystery,acme,m', d) as ItemsPlan;
    expect(p.duplicates).toEqual(['shirt']);
    expect(p.unknownCategories).toEqual(['Mystery']);
    expect(d.items).toHaveLength(1);
  });
  it('ignores unknown columns and column order', () => {
    const p = planImport('category,extra,name\nTops,zzz,A', data) as ItemsPlan;
    expect(p.ignoredColumns).toEqual(['extra']);
    expect(p.toAdd).toHaveLength(1);
  });
  it('maps or creates unknown categories on apply, matching existing ones case-insensitively', () => {
    const p = planImport('name,category\nA,tops\nB,Hats\nC,Scarves', data) as ItemsPlan;
    const tops = data.categories.find((c) => c.name === 'Tops')!;
    const d = applyImport(p, data, { categoryMap: { scarves: tops.id } });
    expect(d.items.find((i) => i.name === 'A')!.category).toBe(tops.id);
    expect(d.items.find((i) => i.name === 'C')!.category).toBe(tops.id);
    expect(d.categories.some((c) => c.name === 'Hats')).toBe(true);
    expect(data.items).toHaveLength(0); // input untouched
  });
});

describe('image columns', () => {
  const data = defaultData();
  it('imports valid image_url and colour_hex', () => {
    const p = planImport('name,category,image_url,colour_hex\nA,Tops,https://x.test/a.jpg,#aabbcc', data) as ItemsPlan;
    expect(p.toAdd[0]).toMatchObject({ imageUrl: 'https://x.test/a.jpg', colourHex: '#AABBCC' });
    expect(p.warnings).toEqual([]);
  });
  it('ignores invalid values with a warning but still imports the row', () => {
    const p = planImport('name,category,image_url,colour_hex\nA,Tops,http://x.test/a.jpg,navy\nB,Tops,javascript:alert(1),#12', data) as ItemsPlan;
    expect(p.toAdd).toHaveLength(2);
    expect(p.toAdd.every((i) => i.imageUrl === undefined && i.colourHex === undefined)).toBe(true);
    expect(p.warnings).toHaveLength(4);
    expect(p.ignoredColumns).toEqual([]);
  });
  it('gives new categories a matching drawing', () => {
    const d = applyImport(planImport('name,category\nA,Denim jackets', data) as ItemsPlan, data);
    expect(d.categories.find((c) => c.name === 'Denim jackets')?.illustration).toBe('jeans');
  });
});

describe('rails then categories', () => {
  it('flags categories on missing rails, then imports once rails exist', () => {
    const empty = { ...defaultData(), zones: [], categories: [] };
    const cats = 'category,rail,target\nShirts,Short,8\nCoats,Long,';
    const before = planImport(cats, empty) as CategoriesPlan;
    expect(before.toAdd).toHaveLength(0);
    expect(before.missingRails.sort()).toEqual(['Long', 'Short']);

    const rails = planImport('rail,capacity_inches\nShort,78\nLong,20', empty) as RailsPlan;
    const withRails = applyImport(rails, empty);
    expect(withRails.zones.map((z) => z.name)).toEqual(['Short', 'Long']);
    const after = applyImport(planImport(cats, withRails) as CategoriesPlan, withRails);
    expect(after.categories.map((c) => c.name)).toEqual(['Shirts', 'Coats']);
    const shirts = after.categories.find((c) => c.name === 'Shirts')!;
    expect(after.plans[0].allocations[shirts.id]).toBe(8);
  });
  it('shows capacity conflicts and only changes them when chosen', () => {
    const data = defaultData();
    const p = planImport('rail,capacity_inches\nShort,90', data) as RailsPlan;
    expect(p.conflicts).toEqual([{ name: 'Short', current: 78, incoming: 90 }]);
    expect(applyImport(p, data).zones[0].capacity).toBe(78);
    expect(applyImport(p, data, { useNewCapacity: ['Short'] }).zones[0].capacity).toBe(90);
  });
});

describe('targets on existing categories', () => {
  it('fills unset targets but never overwrites set ones', () => {
    const data = defaultData();
    data.plans[0].allocations['cat-coats'] = 5;
    const p = planImport('category,rail,target\nCoats,Long,8\nTops,Short,14', data) as CategoriesPlan;
    expect(p.targetFills).toEqual([{ name: 'Tops', target: 14 }]);
    expect(p.existing).toEqual(['Coats']);
    const d = applyImport(p, data);
    expect(d.plans[0].allocations['cat-coats']).toBe(5);
    expect(d.plans[0].allocations['cat-tops']).toBe(14);
  });
});

describe('sample files', () => {
  it('the supplied items.csv imports without problems against its own categories', () => {
    const base = defaultData();
    const cats = planImport(readFileSync('samples/categories.csv', 'utf8'), base) as CategoriesPlan;
    const withCats = applyImport(cats, base);
    const items = planImport(readFileSync('samples/items.csv', 'utf8'), withCats) as ItemsPlan;
    expect(items.problems).toEqual([]);
    expect(items.unknownCategories).toEqual([]);
    expect(items.toAdd.length).toBe(26);
  });
});
