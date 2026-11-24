#!/usr/bin/env node
// Builds self-contained review pages from design/v11/src into design/v11/review.
// Every asset is inlined from its repo source at build time, so the pages work
// offline and from a file:// URL, and no artwork is copied by hand.
//
//   {{css:path}}        inline a stylesheet (path relative to repo root)
//   {{js:path}}         inline a script
//   {{fonts}}           @font-face rules with the self-hosted WOFF2 as data URLs
//   {{icon:name}}       inline Phosphor duotone icon from design/assets/phosphor/duotone
//   {{img:path}}        data: URL of a file (SVG or PNG)
//   {{foxinline:uid}}   the Fox 1A full-colour master inlined, geometry untouched;
//                       only ids are made unique and classes added to its 3 paths
//   {{include:path}}    inline another source fragment
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p) => readFileSync(join(root, p));
const text = (p) => read(p).toString('utf8');

const FOX = 'public/brand/fox-1a-symbol-full.svg';
const FOX_SHA = '071d7614d7f4c49decbe179d42375ffa7fad1a59b0e2f79250de7150c990ac3c'; // design/brand/RUNTIME_ASSETS.json
const sha = createHash('sha256').update(read(FOX)).digest('hex');
if (sha !== FOX_SHA) throw new Error(`Fox 1A master changed: ${sha}`);

const FONTS = [
  ['Nunito', 700, 'nunito-latin-700-normal'], ['Nunito', 800, 'nunito-latin-800-normal'],
  ['Poppins', 400, 'poppins-latin-400-normal'], ['Poppins', 500, 'poppins-latin-500-normal'],
  ['Poppins', 600, 'poppins-latin-600-normal'],
];
const fonts = () => FONTS.map(([fam, w, f]) =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${read(`public/fonts/${f}.woff2`).toString('base64')}) format('woff2')}`).join('\n');

const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const dataUrl = (p) => `data:${mime[extname(p)]};base64,${read(p).toString('base64')}`;

function icon(name) {
  const svg = text(`design/assets/phosphor/duotone/${name}.svg`);
  return svg.replace('<svg ', '<svg class="pv-icon" aria-hidden="true" focusable="false" ');
}

function foxInline(uid) {
  let svg = text(FOX);
  const before = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join('|');
  svg = svg.replace(/ width="365" height="459"/, '')
    .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"')
    .replace(/<title>[^<]*<\/title>/, '')
    .replaceAll('fox1a-orange', `fox1a-orange-${uid}`);
  let i = 0;
  const cls = ['fox-body', 'fox-cream', 'fox-star'];
  svg = svg.replace(/<path /g, () => `<path class="${cls[i++]}" `);
  svg = svg.replace('<svg ', '<svg class="pv-fox-inline" ');
  const after = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join('|');
  if (before !== after || i !== 3) throw new Error('Fox 1A geometry must not change');
  return svg;
}

function render(src, depth = 0) {
  if (depth > 5) throw new Error('include loop');
  return src
    .replace(/\{\{include:([^}]+)\}\}/g, (_, p) => render(text(p), depth + 1))
    .replace(/\{\{css:([^}]+)\}\}/g, (_, p) => text(p))
    .replace(/\{\{js:([^}]+)\}\}/g, (_, p) => text(p))
    .replace(/\{\{fonts\}\}/g, fonts)
    .replace(/\{\{icon:([a-z0-9-]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{img:([^}]+)\}\}/g, (_, p) => dataUrl(p))
    .replace(/\{\{foxinline:([a-z0-9-]+)\}\}/g, (_, u) => foxInline(u));
}

const srcDir = join(here, 'src');
const outDir = join(here, 'review');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(srcDir).filter((n) => n.endsWith('.html'))) {
  const out = render(readFileSync(join(srcDir, f), 'utf8'));
  const left = out.match(/\{\{[a-z]+:[^}]*\}\}/);
  if (left) throw new Error(`${f}: unresolved ${left[0]}`);
  writeFileSync(join(outDir, f), out);
  console.log(`${f}  ${(out.length / 1024).toFixed(0)} KB`);
}
