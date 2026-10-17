import type { Category, Item, Plan, Season, Zone } from '../types';

export interface ZoneResult {
  zoneId: string;
  capacity: number;
  usedInches: number;
  freeInches: number; // negative when over
  overInches: number;
  status: 'within' | 'over';
  onRailCount: number;
  targetTotal: number; // sum of category targets whose default zone is this one
  targetInches: number;
  targetsOver: boolean;
}

export interface CategoryResult {
  categoryId: string;
  zoneId: string;
  target: number | undefined;
  onRail: number;
  inPile: number;
  needed: number;
  surplus: number;
}

export interface CapacityResult {
  zones: Record<string, ZoneResult>;
  categories: Record<string, CategoryResult>;
  totalUsed: number;
  totalCapacity: number;
}

export function itemZone(item: Item, categories: Category[]): string | undefined {
  return item.zoneOverride ?? categories.find((c) => c.id === item.category)?.defaultZone;
}

/** Whether an item is relevant to the plan's seasons (all-year always is). */
export function inPlanSeasons(item: Item, planSeasons: Season[]): boolean {
  return item.seasons.some((s) => s === 'all-year' || planSeasons.includes(s));
}

/** Pure: no DOM, no storage. */
export function computeCapacity(items: Item[], zones: Zone[], categories: Category[], plan: Plan): CapacityResult {
  const per = plan.inchesPerItem;
  const zoneRes: Record<string, ZoneResult> = {};
  for (const z of zones) {
    zoneRes[z.id] = {
      zoneId: z.id, capacity: z.capacity, usedInches: 0, freeInches: z.capacity, overInches: 0,
      status: 'within', onRailCount: 0, targetTotal: 0, targetInches: 0, targetsOver: false,
    };
  }
  const catRes: Record<string, CategoryResult> = {};
  for (const c of categories) {
    const target = plan.allocations[c.id];
    catRes[c.id] = { categoryId: c.id, zoneId: c.defaultZone, target, onRail: 0, inPile: 0, needed: 0, surplus: 0 };
    const z = zoneRes[c.defaultZone];
    if (z && target) z.targetTotal += target;
  }

  for (const item of items) {
    const cr = catRes[item.category];
    if (item.state === 'on-rail') {
      if (cr) cr.onRail++;
      const zid = itemZone(item, categories);
      const z = zid ? zoneRes[zid] : undefined;
      if (z) z.onRailCount++;
    } else if (item.state === 'pile' && cr && inPlanSeasons(item, plan.seasons)) {
      cr.inPile++;
    }
  }

  let totalUsed = 0;
  let totalCapacity = 0;
  for (const z of Object.values(zoneRes)) {
    z.usedInches = z.onRailCount * per;
    z.freeInches = z.capacity - z.usedInches;
    z.overInches = Math.max(0, -z.freeInches);
    z.status = z.overInches > 0 ? 'over' : 'within';
    z.targetInches = z.targetTotal * per;
    z.targetsOver = z.targetInches > z.capacity;
    totalUsed += z.usedInches;
    totalCapacity += z.capacity;
  }
  for (const cr of Object.values(catRes)) {
    const t = cr.target ?? 0;
    cr.needed = Math.max(0, t - cr.onRail);
    cr.surplus = cr.target === undefined ? 0 : Math.max(0, cr.onRail - t);
  }
  return { zones: zoneRes, categories: catRes, totalUsed, totalCapacity };
}
