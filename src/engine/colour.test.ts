import { describe, expect, it } from 'vitest';
import { NEUTRAL, PALETTE, tintFor } from './colour';

describe('tintFor', () => {
  it('prefers an explicit hex', () => expect(tintFor('#abcdef', 'navy')).toBe('#abcdef'));
  it('ignores a malformed hex and falls back to the text', () => expect(tintFor('blue', 'navy')).toBe(PALETTE.navy));
  it('matches palette names inside free text, longest first', () => {
    expect(tintFor(undefined, 'dark navy')).toBe(PALETTE.navy);
    expect(tintFor(undefined, 'light blue')).toBe(PALETTE['light blue']);
    expect(tintFor(undefined, 'Blue')).toBe(PALETTE.blue);
    expect(tintFor(undefined, 'black/grey')).toBe(PALETTE.black);
  });
  it('is neutral grey for unknown, empty and patterned colours', () => {
    expect(tintFor(undefined, 'rainbow')).toBe(NEUTRAL);
    expect(tintFor(undefined, undefined)).toBe(NEUTRAL);
    expect(tintFor(undefined, 'navy striped')).toBe(NEUTRAL);
    expect(tintFor(undefined, 'floral multi')).toBe(NEUTRAL);
  });
});
