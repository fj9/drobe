import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../data/defaults';
import { defaultData } from '../data/defaults';
import { planImport, type ItemsPlan } from './import';

describe('add-items skill example', () => {
  it('imports cleanly with its image and colour columns', () => {
    const md = readFileSync('skills/wardrobe-add-items/SKILL.md', 'utf8');
    const csv = md.match(/```\n(name,category[\s\S]*?)```/)![1];
    const data = { ...defaultData(), categories: [...DEFAULT_CATEGORIES, { id: 'cat-jeans', name: 'Jeans', defaultZone: 'zone-short' }] };
    const p = planImport(csv, data) as ItemsPlan;
    expect(p.problems).toEqual([]);
    expect(p.warnings).toEqual([]);
    expect(p.ignoredColumns).toEqual([]);
    expect(p.toAdd).toHaveLength(3);
    expect(p.toAdd[0]).toMatchObject({ imageUrl: 'https://example-retailer.test/images/navy-cardigan.jpg', colourHex: '#1F2A4A' });
    expect(p.toAdd[1].imageUrl).toBeUndefined();
  });
});
