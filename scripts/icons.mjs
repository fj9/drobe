import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
// maskable: full-bleed background with the glyph inside the safe zone
const bg = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#3b2f4a' } }).png().toBuffer();
const glyph = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp(bg).composite([{ input: glyph, gravity: 'centre' }]).png().toFile('public/icon-maskable-512.png');
