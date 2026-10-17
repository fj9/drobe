import { crc32 as zcrc } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Item } from '../types';
import { buildZip, fileBase, harvestImages, linkedItems } from './harvest';
import { crc32, createZip } from './zip';

const item = (name: string, imageUrl?: string, id: string = crypto.randomUUID()): Item => ({
  id, name, category: 'cat-tops', state: 'pile', fit: 'not-checked', seasons: ['autumn'], createdAt: '', updatedAt: '', imageUrl,
});

/** Reads back a stored zip via its central directory, verifying CRCs. */
async function readZip(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const v = new DataView(buf.buffer);
  const eocd = buf.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const localNameLen = v.getUint16(off + 26, true);
    const start = off + 30 + localNameLen;
    const data = buf.subarray(start, start + size);
    expect(zcrc(data)).toBe(crc);
    out[name] = data;
    p += 46 + nameLen;
  }
  return out;
}

describe('zip', () => {
  it('matches the standard CRC-32', () => {
    const d = new TextEncoder().encode('123456789');
    expect(crc32(d)).toBe(0xcbf43926);
    expect(crc32(d)).toBe(zcrc(d));
  });
  it('round-trips files including unicode names and empty files', async () => {
    const files = await readZip(createZip([
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'ünï/çode.txt', data: new TextEncoder().encode('x') },
      { name: 'empty', data: new Uint8Array() },
    ]));
    expect(Object.keys(files)).toEqual(['a.txt', 'ünï/çode.txt', 'empty']);
    expect(new TextDecoder().decode(files['a.txt'])).toBe('hello');
    expect(files.empty.length).toBe(0);
  });
});

describe('harvestImages', () => {
  const ok = (type: string, body: string) => async () => new Response(body, { status: 200, headers: { 'content-type': type } });
  it('only tries items with a linked address', () => {
    expect(linkedItems([item('a'), item('b', 'https://x.test/b.jpg')]).map((i) => i.name)).toEqual(['b']);
  });
  it('saves images, reports each failure reason, and carries on past errors', async () => {
    const items = [
      item('Good tee', 'https://ok.test/a.jpg'),
      item('Blocked', 'https://cors.test/b.jpg'),
      item('Missing', 'https://gone.test/c.jpg'),
      item('A page', 'https://page.test/d'),
    ];
    const fetchFn = async (u: string) => {
      if (u.startsWith('https://ok')) return ok('image/jpeg', 'JPEGDATA')();
      if (u.startsWith('https://cors')) throw new TypeError('Failed to fetch');
      if (u.startsWith('https://gone')) return new Response('no', { status: 404 });
      return ok('text/html; charset=utf-8', '<html>')();
    };
    const { results, files } = await harvestImages(items, { fetchFn });
    expect(results.map((r) => r.status)).toEqual(['saved', 'blocked', 'failed', 'not-image']);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('images/Good tee.jpg');
    expect(new TextDecoder().decode(files[0].data)).toBe('JPEGDATA');
  });
  it('names files after the item and numbers duplicates, ignoring case', async () => {
    const items = [item('Tee', 'https://a.test/1.png'), item('tee', 'https://a.test/2.png'), item('Tee', 'https://a.test/3.png')];
    const { files } = await harvestImages(items, { fetchFn: ok('image/png', 'P'), concurrency: 1 });
    expect(files.map((f) => f.name)).toEqual(['images/Tee.png', 'images/tee (2).png', 'images/Tee (3).png']);
  });
  it('skips already-downloaded items when asked', async () => {
    const a = { ...item('Done', 'https://a.test/1.png'), imageHarvested: true };
    const b = item('New', 'https://a.test/2.png');
    expect(linkedItems([a, b]).map((i) => i.name)).toEqual(['Done', 'New']);
    expect(linkedItems([a, b], true).map((i) => i.name)).toEqual(['New']);
    const { results } = await harvestImages([a, b], { fetchFn: ok('image/png', 'P'), skipHarvested: true });
    expect(results.map((r) => r.name)).toEqual(['New']);
  });
  it('requests with no credentials and no referrer, in CORS mode', async () => {
    let init: RequestInit | undefined;
    await harvestImages([item('a', 'https://a.test/1.jpg')], { fetchFn: async (_u, i) => { init = i; return ok('image/jpeg', 'x')(); } });
    expect(init).toMatchObject({ mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });
  it('stops cleanly when cancelled and reports progress', async () => {
    const ac = new AbortController();
    const items = Array.from({ length: 10 }, (_, i) => item(`i${i}`, `https://a.test/${i}.jpg`));
    const seen: number[] = [];
    const { results } = await harvestImages(items, {
      concurrency: 1, signal: ac.signal, fetchFn: ok('image/jpeg', 'x'),
      onProgress: (d) => { seen.push(d); if (d === 3) ac.abort(); },
    });
    expect(results).toHaveLength(3);
    expect(seen).toEqual([1, 2, 3]);
  });
  it('builds a zip with the images and a manifest listing failures', async () => {
    const items = [item('Good', 'https://ok.test/a.jpg'), item('Bad', 'https://cors.test/b.jpg')];
    const { results, files } = await harvestImages(items, {
      fetchFn: async (u) => { if (u.includes('cors')) throw new TypeError('x'); return ok('image/webp', 'W')(); },
    });
    const zip = await readZip(buildZip(results, files));
    const manifest = new TextDecoder().decode(zip['manifest.csv']);
    expect(manifest).toContain('name,image_url,result,file');
    expect(manifest).toContain('Good,https://ok.test/a.jpg,Saved,images/Good.webp');
    expect(manifest).toMatch(/Bad,https:\/\/cors\.test\/b\.jpg,"?The site doesn't allow/);
    expect(Object.keys(zip).filter((k) => k.startsWith('images/'))).toHaveLength(1);
  });
  it('turns item names into safe filenames', () => {
    expect(fileBase('Black draped t-shirt (AllSaints, medium, 1 of 2)')).toBe('Black draped t-shirt (AllSaints, medium, 1 of 2)');
    expect(fileBase('Black "cat" print / dress?')).toBe('Black cat print dress');
    expect(fileBase('a/b\\c:d')).toBe('a b c d');
    expect(fileBase('..hidden..')).toBe('hidden');
    expect(fileBase('???')).toBe('item');
    expect(fileBase('x'.repeat(300))).toHaveLength(100);
  });
});
