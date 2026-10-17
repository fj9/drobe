export type ItemState = 'pile' | 'on-rail' | 'stored' | 'archived';
export type Fit = 'fits-well' | 'fits-replace' | 'doesnt-fit' | 'not-checked';
export type Season = 'autumn' | 'winter' | 'spring' | 'summer' | 'all-year';
export type ArchivedReason = 'sold' | 'donated' | 'other';

export const STATES: ItemState[] = ['pile', 'on-rail', 'stored', 'archived'];
export const FITS: Fit[] = ['fits-well', 'fits-replace', 'doesnt-fit', 'not-checked'];
export const SEASONS: Season[] = ['autumn', 'winter', 'spring', 'summer', 'all-year'];
export const REASONS: ArchivedReason[] = ['sold', 'donated', 'other'];

export interface Item {
  id: string;
  name: string;
  category: string;
  state: ItemState;
  fit: Fit;
  seasons: Season[];
  brand?: string;
  size?: string;
  material?: string;
  colour?: string;
  notes?: string;
  zoneOverride?: string;
  archivedReason?: ArchivedReason;
  archivedAt?: string;
  /** id of a photo kept on the device (images store) */
  photoId?: string;
  /** linked https product image */
  imageUrl?: string;
  /** true once the linked image has been saved via Settings → download images; reset if the link changes */
  imageHarvested?: boolean;
  /** #RRGGBB tint; otherwise worked out from the colour text */
  colourHex?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Zone {
  id: string;
  name: string;
  kind: 'rail';
  capacity: number;
  unit: 'inch';
  order: number;
}

export interface Category {
  id: string;
  name: string;
  defaultZone: string;
  /** id of the drawing used for this category's items; 'generic' if unset */
  illustration?: string;
}

export interface Plan {
  id: string;
  name: string;
  seasons: Season[];
  inchesPerItem: number;
  allocations: Record<string, number>;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  lastBackupDate?: string;
  schemaVersion: number;
  onboarded?: boolean;
  /** categories the user said don't need a target, so they aren't prompted about them */
  noTargetNeeded?: string[];
  /** show linked product images from the web (default on) */
  showWebImages?: boolean;
  webImagesNoteSeen?: boolean;
}

export interface Data {
  items: Item[];
  zones: Zone[];
  categories: Category[];
  plans: Plan[];
  settings: Settings;
}

export interface BackupImage { full: string; thumb: string }

export interface Backup extends Data {
  schemaVersion: number;
  exportedAt: string;
  /** photos as base64 data URLs, only present when exported with photos */
  images?: Record<string, BackupImage>;
}

export const LABELS: Record<string, string> = {
  pile: 'Pile',
  'on-rail': 'On rail',
  stored: 'Stored',
  archived: 'Archived',
  'fits-well': 'Fits well',
  'fits-replace': 'Fits, replace when I can',
  'doesnt-fit': "Doesn't fit",
  'not-checked': 'Not checked',
  autumn: 'Autumn',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  'all-year': 'All year',
  sold: 'Sold',
  donated: 'Donated',
  other: 'Other',
};
