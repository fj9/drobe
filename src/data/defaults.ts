import type { Category, Data, Plan, Zone } from '../types';

export const SCHEMA_VERSION = 1;
export const ACTIVE_PLAN_ID = 'plan-aw';

export const DEFAULT_ZONES: Zone[] = [
  { id: 'zone-short', name: 'Short', kind: 'rail', capacity: 78, unit: 'inch', order: 0 },
  { id: 'zone-medium', name: 'Medium', kind: 'rail', capacity: 60, unit: 'inch', order: 1 },
  { id: 'zone-long', name: 'Long', kind: 'rail', capacity: 20, unit: 'inch', order: 2 },
];

const cat = (id: string, name: string, defaultZone: string): Category => ({ id: `cat-${id}`, name, defaultZone: `zone-${defaultZone}` });

export const DEFAULT_CATEGORIES: Category[] = [
  cat('shirts', 'Shirts', 'short'),
  cat('tops', 'Tops', 'short'),
  cat('light-jumpers', 'Light jumpers', 'short'),
  cat('trousers', 'Trousers', 'short'),
  cat('skirts', 'Skirts', 'medium'),
  cat('short-dresses', 'Short dresses', 'medium'),
  cat('suits-jackets', 'Suits and jackets', 'medium'),
  cat('cardigans', 'Cardigans', 'medium'),
  cat('bulky-jumpers', 'Bulky jumpers', 'medium'),
  cat('long-dresses', 'Long dresses', 'long'),
  cat('coats', 'Coats', 'long'),
];

export const DEFAULT_PLAN: Plan = {
  id: ACTIVE_PLAN_ID,
  name: 'Autumn and winter 2026',
  seasons: ['autumn', 'winter'],
  inchesPerItem: 1,
  allocations: {},
};

export function defaultData(): Data {
  return {
    items: [],
    zones: structuredClone(DEFAULT_ZONES),
    categories: structuredClone(DEFAULT_CATEGORIES),
    plans: [structuredClone(DEFAULT_PLAN)],
    settings: { theme: 'system', schemaVersion: SCHEMA_VERSION },
  };
}
