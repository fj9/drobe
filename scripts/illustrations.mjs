// Generates the 13 category illustrations as SVG: a white garment, light grey shading, charcoal outline,
// transparent background. The app tints them with mask + multiply (see .art in style.css).
// To use your own artwork, drop a transparent illustrations/<id>.svg or .webp over these and update ART_EXT.
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '#2b2b2b';
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
<g stroke-linejoin="round" stroke-linecap="round">
${body}
</g></svg>
`;
const body = (d) => `<path d="${d}" fill="#ffffff" stroke="${OUT}" stroke-width="2.6"/>`;
const line = (d, w = 1.4) => `<path d="${d}" fill="none" stroke="#555" stroke-width="${w}"/>`;
const shade = (d) => `<path d="${d}" fill="#e3e3e3"/>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" stroke="#555" stroke-width="1"/>`;
const dots = (x, ys) => ys.map((y) => dot(x, y)).join('');
const loops = (...xs) => xs.map((x) => `<rect x="${x - 1}" y="6" width="2" height="9" fill="#fff" stroke="#555" stroke-width="1"/>`).join('');

const longSleeve = (neck, hem = 84, cuff = 80) =>
  `M${neck[0]} 14 ${neck[1]} L88 30 L84 ${cuff} L72 ${cuff} L70 44 L70 ${hem} L30 ${hem} L30 44 L28 ${cuff} L16 ${cuff} L12 30 Z`;

const art = {
  top: [
    body('M35 18 Q50 28 65 18 L88 28 L80 48 L70 43 L70 86 L30 86 L30 43 L20 48 L12 28 Z'),
    shade('M30 43 L30 86 L36 86 L36 46 Z M70 43 L70 86 L64 86 L64 46 Z'),
    line('M35 18 Q50 32 65 18'), line('M30 80 H70'),
  ],
  shirt: [
    body('M36 14 L50 22 L64 14 L90 30 L86 82 L74 82 L70 44 L70 88 L30 88 L30 44 L26 82 L14 82 L10 30 Z'),
    shade('M30 44 L30 88 L36 88 L36 48 Z M70 44 L70 88 L64 88 L64 48 Z'),
    line('M36 14 L50 30 L64 14'), line('M50 30 V88'), line('M74 82 L86 82', 2), line('M14 82 L26 82', 2),
    dots(50, [38, 50, 62, 74]),
  ],
  'light-jumper': [
    body(longSleeve(['38', 'Q50 24 62 14'])),
    shade('M30 44 L30 84 L36 84 L36 48 Z M70 44 L70 84 L64 84 L64 48 Z'),
    line('M38 14 Q50 28 62 14'), line('M30 78 H70'), line('M16 76 H28'), line('M72 76 H84'),
  ],
  'bulky-jumper': [
    body('M38 6 H62 V20 L88 33 L84 82 L72 82 L70 46 L70 88 L30 88 L30 46 L28 82 L16 82 L12 33 L38 20 Z'),
    shade('M38 6 H62 V12 H38 Z M30 46 L30 88 L36 88 L36 50 Z M70 46 L70 88 L64 88 L64 50 Z'),
    line('M38 13 H62'), line('M38 20 L62 20'),
    line('M42 28 q-4 6 0 12 t0 12 t0 12 t0 10', 1.6), line('M50 28 q4 6 0 12 t0 12 t0 12 t0 10', 1.6), line('M58 28 q-4 6 0 12 t0 12 t0 12 t0 10', 1.6),
    line('M30 82 H70'),
  ],
  cardigan: [
    body('M38 14 L50 34 L62 14 L88 30 L84 82 L72 82 L70 46 L70 90 L30 90 L30 46 L28 82 L16 82 L12 30 Z'),
    shade('M30 46 L30 90 L36 90 L36 50 Z M70 46 L70 90 L64 90 L64 50 Z'),
    line('M50 34 V90'), line('M47 34 V90', 1), line('M53 34 V90', 1), line('M30 84 H70'),
    dots(50, [44, 56, 68, 80]),
  ],
  trousers: [
    body('M30 8 H70 L75 92 L55 92 L50 38 L45 92 L25 92 Z'),
    shade('M30 8 H36 L33 92 H25 Z'),
    line('M30 16 H70'), loops(36, 50, 64), line('M38 22 q-2 14 2 24', 1.2), line('M62 22 q2 14 -2 24', 1.2),
    line('M37 50 L35 92', 1), line('M63 50 L65 92', 1),
  ],
  jeans: [
    body('M30 8 H70 L75 92 L55 92 L50 38 L45 92 L25 92 Z'),
    shade('M30 8 H36 L33 92 H25 Z'),
    line('M30 16 H70'), loops(36, 50, 64), line('M50 16 V36'), line('M50 36 q-8 0 -10 -10', 1.2),
    line('M33 18 q2 12 10 14', 1.2), line('M67 18 q-2 12 -10 14', 1.2),
    line('M45 40 L46 92', 1), line('M55 40 L54 92', 1),
    `<path d="M30 17 H70" fill="none" stroke="#777" stroke-width="0.8" stroke-dasharray="2 1.5"/>`,
  ],
  skirt: [
    body('M32 10 H68 L84 82 Q50 90 16 82 Z'),
    shade('M32 10 H38 L26 84 L16 82 Z'),
    line('M32 18 H68'), line('M50 18 L50 86', 1), line('M42 18 L36 85', 1), line('M58 18 L64 85', 1),
  ],
  'short-dress': [
    body('M38 10 Q50 20 62 10 L76 16 L82 32 L70 36 L66 48 L86 88 Q50 96 14 88 L34 48 L30 36 L18 32 L24 16 Z'),
    shade('M30 36 L34 48 L14 88 L22 90 L40 50 Z'),
    line('M38 10 Q50 24 62 10'), line('M34 48 H66'), line('M42 52 L34 90', 1), line('M58 52 L66 90', 1),
  ],
  'long-dress': [
    body('M38 8 L50 28 L62 8 L74 12 L80 28 L68 32 L64 48 L80 96 Q50 100 20 96 L36 48 L32 32 L20 28 L26 12 Z'),
    shade('M32 32 L36 48 L20 96 L28 97 L42 50 Z'),
    line('M38 8 L50 28 L62 8', 1.4), line('M36 48 H64'), line('M46 52 L40 98', 1), line('M54 52 L60 98', 1),
  ],
  'suit-jacket': [
    body('M36 12 L50 18 L64 12 L88 26 L84 86 L72 86 L70 44 L70 92 L30 92 L30 44 L28 86 L16 86 L12 26 Z'),
    shade('M30 44 L30 92 L36 92 L36 48 Z M70 44 L70 92 L64 92 L64 48 Z'),
    line('M36 12 L47 40 L50 54 L53 40 L64 12'), line('M36 12 L42 24 L47 40', 1), line('M64 12 L58 24 L53 40', 1),
    line('M50 54 V92'), dots(50, [58, 70]), line('M34 70 H44', 1.6), line('M56 70 H66', 1.6),
  ],
  coat: [
    body('M34 8 L50 16 L66 8 L90 26 L86 84 L74 84 L72 44 L74 98 L26 98 L28 44 L26 84 L14 84 L10 26 Z'),
    shade('M28 44 L26 98 L34 98 L34 48 Z M72 44 L74 98 L66 98 L66 48 Z'),
    line('M34 8 L44 36 L50 56 L56 36 L66 8'), line('M34 8 L38 24 L44 36', 1), line('M66 8 L62 24 L56 36', 1),
    line('M50 56 V98'), dots(50, [60, 72, 84]), line('M32 76 L42 82', 1.6), line('M68 76 L58 82', 1.6),
  ],
  generic: [
    body('M38 16 Q50 26 62 16 L84 28 L78 44 L70 40 L70 82 L30 82 L30 40 L22 44 L16 28 Z'),
    shade('M30 40 L30 82 L36 82 L36 44 Z M70 40 L70 82 L64 82 L64 44 Z'),
    line('M38 16 Q50 30 62 16'),
  ],
};

mkdirSync('public/illustrations', { recursive: true });
for (const [id, parts] of Object.entries(art)) writeFileSync(`public/illustrations/${id}.svg`, wrap(parts.join('\n')));
console.log(`wrote ${Object.keys(art).length} illustrations`);
