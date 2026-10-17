import { toCsv } from './csv';
import { createZip, type ZipEntry } from './zip';
import type { Item } from '../types';

export type HarvestStatus = 'saved' | 'blocked' | 'not-image' | 'too-large' | 'failed';

export interface HarvestResult {
  itemId: string;
  name: string;
  url: string;
  status: HarvestStatus;
  filename?: string;
}

export const STATUS_TEXT: Record<HarvestStatus, string> = {
  saved: 'Saved',
  blocked: "The site doesn't allow other pages to download its images, or the link is broken",
  'not-image': 'The link is not a picture',
  'too-large': 'Larger than 15 MB',
  failed: 'Could not download',
};

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' };

/** The item's own name as a filename: characters not allowed in filenames become spaces, length capped. */
export function fileBase(name: string): string {
  const cleaned = name.normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 100)
    .trim();
  return cleaned || 'item';
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface Options {
  fetchFn?: Fetch;
  signal?: AbortSignal;
  concurrency?: number;
  /** leave out items whose image has already been downloaded */
  skipHarvested?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/** Items that have a linked image address. */
export const linkedItems = (items: Item[], skipHarvested = false) =>
  items.filter((i) => !!i.imageUrl && !(skipHarvested && i.imageHarvested));

async function fetchOne(url: string, fetchFn: Fetch, signal?: AbortSignal): Promise<{ status: HarvestStatus; data?: Uint8Array; type?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    // CORS mode, no credentials, no referrer: the same privacy stance as displaying the image.
    const res = await fetchFn(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    if (!res.ok) return { status: 'failed' };
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) return { status: 'not-image' };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { status: 'too-large' };
    return { status: 'saved', data: buf, type };
  } catch {
    // A page cannot tell "blocked by CORS" from "offline" or "broken link"; they all throw the same TypeError.
    return { status: 'blocked' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Tries to download every linked image. Never throws for a single failure; returns what worked and why the rest did not. */
export async function harvestImages(items: Item[], opts: Options = {}): Promise<{ results: HarvestResult[]; files: ZipEntry[] }> {
  const fetchFn = opts.fetchFn ?? ((u, i) => fetch(u, i));
  const todo = linkedItems(items, opts.skipHarvested);
  const results: HarvestResult[] = new Array(todo.length);
  const files: (ZipEntry | undefined)[] = new Array(todo.length);
  const used = new Set<string>();
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < todo.length && !opts.signal?.aborted) {
      const idx = next++;
      const it = todo[idx];
      const r = await fetchOne(it.imageUrl!, fetchFn, opts.signal);
      let filename: string | undefined;
      if (r.status === 'saved' && r.data) {
        const ext = EXT[r.type!] ?? 'img';
        // Same-named items get " (2)", " (3)"... Compared case-insensitively, as some filesystems are.
        const root = fileBase(it.name);
        let base = root;
        for (let n = 2; used.has(`${base}.${ext}`.toLowerCase()); n++) base = `${root} (${n})`;
        used.add(`${base}.${ext}`.toLowerCase());
        filename = `images/${base}.${ext}`;
        files[idx] = { name: filename, data: r.data };
      }
      results[idx] = { itemId: it.id, name: it.name, url: it.imageUrl!, status: r.status, filename };
      opts.onProgress?.(++done, todo.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, Math.max(1, todo.length)) }, worker));

  return { results: results.filter(Boolean), files: files.filter(Boolean) as ZipEntry[] };
}

export function buildZip(results: HarvestResult[], files: ZipEntry[]): Blob {
  const manifest = toCsv([
    ['name', 'image_url', 'result', 'file'],
    ...results.map((r) => [r.name, r.url, STATUS_TEXT[r.status], r.filename]),
  ]);
  return createZip([...files, { name: 'manifest.csv', data: new TextEncoder().encode(manifest) }]);
}
