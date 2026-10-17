export const PALETTE: Record<string, string> = {
  black: '#1F1F1F', charcoal: '#4A4A4A', grey: '#9A9A9A', white: '#F5F5F2', cream: '#EFE6D2', beige: '#D8C3A5',
  camel: '#C19A6B', tan: '#B58B5A', brown: '#6B4A32', burgundy: '#6D1F33', red: '#C0392B', pink: '#E8A0B4',
  orange: '#D9702B', mustard: '#D4A017', yellow: '#F0D24B', olive: '#6B6B2F', green: '#4C8C4A', forest: '#2F5D3A',
  teal: '#2A7F82', 'light blue': '#9CC3E0', blue: '#2F6DB5', navy: '#1F2A4A', purple: '#6A4C93', lilac: '#BBA6D6',
};

export const NEUTRAL = PALETTE.grey;
const NAMES = Object.keys(PALETTE).sort((a, b) => b.length - a.length);
const PATTERNED = /striped|stripe|floral|patterned|pattern|multi/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHex = (v: string | undefined): v is string => !!v && HEX.test(v);
export const normaliseHex = (v: string) => v.toUpperCase();

/** The tint for an item: explicit hex, else a palette name found in the text, else neutral grey. */
export function tintFor(colourHex: string | undefined, colourText: string | undefined): string {
  if (isHex(colourHex)) return colourHex;
  const t = (colourText ?? '').toLowerCase();
  if (!t || PATTERNED.test(t)) return NEUTRAL;
  const name = NAMES.find((n) => t.includes(n));
  return name ? PALETTE[name] : NEUTRAL;
}
