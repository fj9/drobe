import { toTable, type Table } from './csv';
import { ACTIVE_PLAN_ID } from '../data/defaults';
import {
  FITS, REASONS, SEASONS, STATES,
  type ArchivedReason, type Data, type Fit, type Item, type ItemState, type Season,
} from '../types';

export type CsvKind = 'items' | 'categories' | 'rails';

const KNOWN: Record<CsvKind, string[]> = {
  items: ['name', 'category', 'seasons', 'fit', 'state', 'brand', 'size', 'material', 'colour', 'notes', 'archived_reason'],
  categories: ['category', 'rail', 'target'],
  rails: ['rail', 'capacity_inches'],
};
const REQUIRED: Record<CsvKind, string[]> = {
  items: ['name', 'category'], categories: ['category', 'rail'], rails: ['rail', 'capacity_inches'],
};

/** Guess which file this is from its header row. */
export function detectKind(headers: string[]): CsvKind | undefined {
  const has = (k: CsvKind) => REQUIRED[k].every((h) => headers.includes(h));
  if (has('items')) return 'items';
  if (has('rails')) return 'rails';
  if (has('categories')) return 'categories';
  return undefined;
}

export interface RowProblem { row: number; message: string }

export interface ItemsPlan {
  kind: 'items';
  toAdd: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>[];
  problems: RowProblem[];
  duplicates: string[];
  ignoredColumns: string[];
  /** category names in the file that don't exist yet */
  unknownCategories: string[];
}
export interface CategoriesPlan {
  kind: 'categories';
  toAdd: { name: string; rail: string; target?: number }[];
  /** existing categories whose target would be changed */
  existing: string[];
  /** existing categories with no target yet that the file would give one (non-destructive) */
  targetFills: { name: string; target: number }[];
  problems: RowProblem[];
  ignoredColumns: string[];
  missingRails: string[];
}
export interface RailsPlan {
  kind: 'rails';
  toAdd: { name: string; capacity: number }[];
  conflicts: { name: string; current: number; incoming: number }[];
  problems: RowProblem[];
  ignoredColumns: string[];
}
export type ImportPlan = ItemsPlan | CategoriesPlan | RailsPlan;

const norm = (s: string) => s.trim().toLowerCase();
const dupKey = (name: string, brand?: string, size?: string) => [name, brand ?? '', size ?? ''].map(norm).join('|');

function ignored(t: Table, kind: CsvKind) {
  return t.headers.filter((h) => h && !KNOWN[kind].includes(h));
}

export function planImport(text: string, data: Data, kind?: CsvKind): ImportPlan | { error: string } {
  const t = toTable(text);
  if (t.headers.length === 0) return { error: 'That file is empty.' };
  const k = kind ?? detectKind(t.headers);
  if (!k) return { error: 'Could not tell what kind of file this is. Check the header row matches the expected columns.' };
  const missing = REQUIRED[k].filter((h) => !t.headers.includes(h));
  if (missing.length) return { error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` };
  if (k === 'items') return planItems(t, data);
  if (k === 'categories') return planCategories(t, data);
  return planRails(t, data);
}

function planItems(t: Table, data: Data): ItemsPlan {
  const plan: ItemsPlan = { kind: 'items', toAdd: [], problems: [], duplicates: [], ignoredColumns: ignored(t, 'items'), unknownCategories: [] };
  const existing = new Set(data.items.map((i) => dupKey(i.name, i.brand, i.size)));
  const seenInFile = new Set<string>();
  const unknown = new Set<string>();
  t.rows.forEach((r, idx) => {
    const row = idx + 2;
    if (!r.name) return void plan.problems.push({ row, message: 'Missing name' });
    if (!r.category) return void plan.problems.push({ row, message: 'Missing category' });

    let seasons: Season[] = ['all-year'];
    if (r.seasons) {
      const parts = r.seasons.split(/[;|]/).map(norm).filter(Boolean);
      const bad = parts.filter((p) => !SEASONS.includes(p as Season));
      if (bad.length) return void plan.problems.push({ row, message: `Unknown season "${bad.join('", "')}"` });
      seasons = parts as Season[];
    }
    const fit = r.fit ? norm(r.fit) : 'not-checked';
    if (!FITS.includes(fit as Fit)) return void plan.problems.push({ row, message: `Unknown fit "${r.fit}"` });
    const state = r.state ? norm(r.state) : 'pile';
    if (!STATES.includes(state as ItemState)) return void plan.problems.push({ row, message: `Unknown state "${r.state}"` });
    let archivedReason: ArchivedReason | undefined;
    if (state === 'archived' && r.archived_reason) {
      const ar = norm(r.archived_reason);
      if (!REASONS.includes(ar as ArchivedReason)) return void plan.problems.push({ row, message: `Unknown archived_reason "${r.archived_reason}"` });
      archivedReason = ar as ArchivedReason;
    }
    if (!data.categories.some((c) => norm(c.name) === norm(r.category))) unknown.add(r.category);

    const key = dupKey(r.name, r.brand, r.size);
    if (existing.has(key) || seenInFile.has(key)) plan.duplicates.push(r.name);
    seenInFile.add(key);

    plan.toAdd.push({
      name: r.name, category: r.category, state: state as ItemState, fit: fit as Fit, seasons,
      brand: r.brand || undefined, size: r.size || undefined, material: r.material || undefined,
      colour: r.colour || undefined, notes: r.notes || undefined, archivedReason,
    });
  });
  plan.unknownCategories = [...unknown];
  return plan;
}

function planCategories(t: Table, data: Data): CategoriesPlan {
  const plan: CategoriesPlan = { kind: 'categories', toAdd: [], existing: [], targetFills: [], problems: [], ignoredColumns: ignored(t, 'categories'), missingRails: [] };
  const railNames = new Set(data.zones.map((z) => z.name));
  const missing = new Set<string>();
  t.rows.forEach((r, idx) => {
    const row = idx + 2;
    if (!r.category) return void plan.problems.push({ row, message: 'Missing category' });
    if (!r.rail) return void plan.problems.push({ row, message: 'Missing rail' });
    let target: number | undefined;
    if (r.target) {
      if (!/^\d+$/.test(r.target)) return void plan.problems.push({ row, message: `Target "${r.target}" is not a whole number` });
      target = Number(r.target);
    }
    if (!railNames.has(r.rail)) {
      missing.add(r.rail);
      return void plan.problems.push({ row, message: `Rail "${r.rail}" does not exist. Import the rails file first.` });
    }
    const have = data.categories.find((c) => norm(c.name) === norm(r.category));
    if (have) {
      const cur = data.plans.find((p) => p.id === ACTIVE_PLAN_ID)?.allocations[have.id];
      if (cur === undefined && target !== undefined) plan.targetFills.push({ name: have.name, target });
      else plan.existing.push(r.category);
      return;
    }
    plan.toAdd.push({ name: r.category, rail: r.rail, target });
  });
  plan.missingRails = [...missing];
  return plan;
}

function planRails(t: Table, data: Data): RailsPlan {
  const plan: RailsPlan = { kind: 'rails', toAdd: [], conflicts: [], problems: [], ignoredColumns: ignored(t, 'rails') };
  t.rows.forEach((r, idx) => {
    const row = idx + 2;
    if (!r.rail) return void plan.problems.push({ row, message: 'Missing rail' });
    if (!/^\d+$/.test(r.capacity_inches)) return void plan.problems.push({ row, message: `capacity_inches "${r.capacity_inches}" is not a whole number` });
    const capacity = Number(r.capacity_inches);
    const cur = data.zones.find((z) => z.name === r.rail);
    if (cur) {
      if (cur.capacity !== capacity) plan.conflicts.push({ name: r.rail, current: cur.capacity, incoming: capacity });
    } else plan.toAdd.push({ name: r.rail, capacity });
  });
  return plan;
}

export interface ApplyChoices {
  /** unknown category name (lowercased) -> existing category id, or 'new' */
  categoryMap?: Record<string, string>;
  /** rail names for which the new capacity wins */
  useNewCapacity?: string[];
}

const id = () => crypto.randomUUID();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

/** Returns a new Data; the input is never mutated, so a failure leaves state untouched. */
export function applyImport(plan: ImportPlan, data: Data, choices: ApplyChoices = {}): Data {
  const next: Data = structuredClone(data);
  const now = new Date().toISOString();

  if (plan.kind === 'rails') {
    for (const r of plan.toAdd) {
      next.zones.push({ id: `zone-${slug(r.name)}-${id().slice(0, 4)}`, name: r.name, kind: 'rail', capacity: r.capacity, unit: 'inch', order: next.zones.length });
    }
    for (const c of plan.conflicts) {
      if (choices.useNewCapacity?.includes(c.name)) {
        const z = next.zones.find((z) => z.name === c.name);
        if (z) z.capacity = c.incoming;
      }
    }
  } else if (plan.kind === 'categories') {
    const plans = next.plans.find((p) => p.id === ACTIVE_PLAN_ID) ?? next.plans[0];
    for (const c of plan.toAdd) {
      const zone = next.zones.find((z) => z.name === c.rail);
      if (!zone) continue;
      const cid = `cat-${slug(c.name)}-${id().slice(0, 4)}`;
      next.categories.push({ id: cid, name: c.name, defaultZone: zone.id });
      if (c.target !== undefined) plans.allocations[cid] = c.target;
    }
    for (const f of plan.targetFills) {
      const cat = next.categories.find((c) => norm(c.name) === norm(f.name));
      if (cat) plans.allocations[cat.id] = f.target;
    }
  } else {
    const resolve = (name: string): string | undefined => {
      const exact = next.categories.find((c) => norm(c.name) === norm(name));
      if (exact) return exact.id;
      const choice = choices.categoryMap?.[norm(name)] ?? 'new';
      if (choice !== 'new') return choice;
      const zone = next.zones[0];
      if (!zone) return undefined;
      const cid = `cat-${slug(name)}-${id().slice(0, 4)}`;
      next.categories.push({ id: cid, name, defaultZone: zone.id });
      return cid;
    };
    for (const it of plan.toAdd) {
      const category = resolve(it.category);
      if (!category) continue;
      next.items.push({
        ...it, category, id: id(), createdAt: now, updatedAt: now,
        archivedAt: it.state === 'archived' ? now : undefined,
      });
    }
  }
  return next;
}
