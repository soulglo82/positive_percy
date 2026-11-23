// @vitest-environment node
// E01/E02: every runtime brand file is traceable to the checksummed Stage 1
// pack, nothing untraced or legacy ships, SVGs carry no active content, and
// bold weights are only used where Nunito is the face.
// Design: docs/engineering/E01-E02-DESIGN.md sections 4-6.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LOGO_ART, logoSrc } from '../components/brand/logoArt.js';
import { svgProblems } from './svgScan.js';

const ROOT = path.resolve(__dirname, '../..');
const rel = (...p) => path.join(ROOT, ...p);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const MANIFEST = JSON.parse(fs.readFileSync(rel('design/brand/RUNTIME_ASSETS.json'), 'utf8'));
const ARCHIVE_SHA = 'e7e93dde728048cb03ba78a1f761cc221af184bfda3bdd4234f7fd3df61f3638';
const LIBRARY = 'design/brand/library/';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// Minimal ZIP reader (central directory; stored or deflate), enough for the pack.
function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('no end of central directory');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, zlib.inflateRawSync(data));
    else throw new Error(`unsupported zip method ${method} for ${name}`);
  }
  return out;
}

describe('E01 archive -> library', () => {
  const parts = fs.readdirSync(rel('design/brand/archives')).filter((f) => /\.b64\.part-\d{3}$/.test(f)).sort();
  const zip = Buffer.from(parts.map((f) => fs.readFileSync(rel('design/brand/archives', f), 'ascii')).join('').replace(/\s+/g, ''), 'base64');

  it('the 36 parts rebuild the pinned archive', () => {
    expect(parts).toHaveLength(36);
    expect(zip.length).toBe(3197548);
    expect(sha(zip)).toBe(ARCHIVE_SHA);
  });

  it('the committed library is exactly the 150 archive members, byte for byte', () => {
    const members = readZip(zip);
    expect(members.size).toBe(150);
    const lib = walk(rel(LIBRARY)).map((f) => path.relative(rel(LIBRARY), f).split(path.sep).join('/')).sort();
    expect(lib).toEqual([...members.keys()].sort());
    for (const [name, data] of members) {
      expect(sha(fs.readFileSync(rel(LIBRARY, name))), name).toBe(sha(data));
    }
  });
});

describe('E01 library -> runtime', () => {
  it.each(MANIFEST.entries.map((e) => [e.runtime, e]))('%s matches its source and recorded hash', (_, e) => {
    const runtime = sha(fs.readFileSync(rel(e.runtime)));
    expect(runtime).toBe(e.sha256);
    expect(sha(fs.readFileSync(rel(e.source)))).toBe(e.sha256);
    expect(e.licence).toBeTruthy();
  });

  // Every source is anchored: the pinned archive (library), the vendored fonts
  // (tarball integrity in the licence field), or, for E03 sources under
  // design/assets and design/brand/licenses, the committed upstream fetch record.
  it('every source sits in an anchored location', () => {
    const UP = JSON.parse(fs.readFileSync(rel('design/brand/UPSTREAM_VERIFICATION.json'), 'utf8'));
    const upstream = new Map(UP.assets.map((a) => [a.source, a.sha256]));
    for (const [src, v] of Object.entries(UP.licence_sources)) upstream.set(src, v.sha256);
    for (const e of MANIFEST.entries) {
      if (e.source.startsWith(LIBRARY)) continue;
      if (e.source.startsWith('design/brand/fonts/')) { expect(e.runtime.startsWith('public/fonts/'), e.runtime).toBe(true); continue; }
      if (e.source === 'design/brand/licenses/CREDITS.txt') continue; // our own draft text, no upstream
      expect(upstream.get(e.source), `${e.source} has no upstream record`).toBe(e.sha256);
    }
  });

  it('every file in public/ is in the manifest (nothing untraced ships)', () => {
    const listed = new Set(MANIFEST.entries.map((e) => e.runtime));
    const shipped = walk(rel('public')).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(shipped.filter((f) => !listed.has(f))).toEqual([]);
    expect([...listed].filter((f) => !shipped.includes(f))).toEqual([]);
  });

  it('no legacy brand asset ships', () => {
    const names = walk(rel('public')).map((f) => path.basename(f));
    for (const bad of [/^logo(-mark|_old)?\.png$/, /^figtree-/, /^fredoka-/, /OFL-(figtree|fredoka)/]) {
      expect(names.filter((n) => bad.test(n)), String(bad)).toEqual([]);
    }
  });
});

describe('SVG active content', () => {
  const svgs = walk(rel('public')).filter((f) => f.endsWith('.svg'));
  it('finds the runtime SVGs (control: the scan has something to scan)', () => {
    expect(svgs.length).toBeGreaterThanOrEqual(13);
  });
  it.each(svgs.map((f) => [path.relative(ROOT, f)]))('%s is static', (f) => {
    expect(svgProblems(fs.readFileSync(rel(f), 'utf8'))).toEqual([]);
  });
  it.each([
    ['<svg><script>alert(1)</script></svg>', 'script'],
    ['<svg><image href="https://x/y.png"/></svg>', 'image'],
    ['<svg><a xlink:href="javascript:1"/></svg>', 'href'],
    ['<svg><rect onload="x()"/></svg>', 'event handler'],
    ['<svg><rect fill="url(https://x/#a)"/></svg>', 'external url()'],
    ['<svg><style>@import "x.css";</style></svg>', '@import'],
  ])('counter-example %s is refused (%s)', (text, label) => {
    expect(svgProblems(text)).toContain(label);
  });
  it('the kit gradient reference is allowed', () => {
    expect(svgProblems('<svg><path fill="url(#fox1a-orange)"/></svg>')).toEqual([]);
  });
});

// font-bold/extrabold (700/800) only exist in Nunito. On Poppins they would
// fall back to 600 silently. A class string using them must also say
// font-display, or sit on a title component whose base class does.
const DISPLAY_BASE = /<(DialogTitle|AlertDialogTitle)\b/;
export function boldWithoutDisplay(text) {
  const out = [];
  const re = /(["'`])((?:(?!\1)[^\n])*)\1/g;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let m;
    while ((m = re.exec(line))) {
      const s = m[2];
      if (/(^|\s)font-(bold|extrabold)(\s|$)/.test(s) && !/(^|\s)font-display(\s|$)/.test(s) && !DISPLAY_BASE.test(line)) {
        out.push(`${i + 1}: ${s}`);
      }
    }
  });
  return out;
}

describe('bold weights only on Nunito', () => {
  const files = walk(rel('src')).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes(`${path.sep}test${path.sep}`) && !/\.test\./.test(f));
  it('scans the app (control: some files do use font-display bold)', () => {
    const hits = files.filter((f) => /font-display[^"'`\n]*font-(bold|extrabold)|font-(bold|extrabold)[^"'`\n]*font-display/.test(fs.readFileSync(f, 'utf8')));
    expect(hits.length).toBeGreaterThan(5);
  });
  it.each(files.map((f) => [path.relative(ROOT, f)]))('%s', (f) => {
    expect(boldWithoutDisplay(fs.readFileSync(rel(f), 'utf8'))).toEqual([]);
  });
  it.each([
    ['<p className="font-bold">x</p>', 1],
    ["const w = 'text-sm font-extrabold';", 1],
    ['<h1 className="font-display font-extrabold">x</h1>', 0],
    ['<DialogTitle className="font-bold">x</DialogTitle>', 0],
    ['<p className="font-semibold">x</p>', 0],
    ['<p className="font-boldish">x</p>', 0],
  ])('fixture %s -> %i problem(s)', (text, n) => {
    expect(boldWithoutDisplay(text)).toHaveLength(n);
  });
});

describe('Logo and page references', () => {
  it('every Logo variant/tone file exists, and every public/brand file is used by Logo', () => {
    const used = new Set();
    for (const [variant, art] of Object.entries(LOGO_ART)) {
      for (const tone of Object.keys(art.file)) {
        const src = logoSrc(variant, tone);
        used.add(src);
        expect(fs.existsSync(rel('public', src)), src).toBe(true);
      }
    }
    const files = fs.readdirSync(rel('public/brand')).map((f) => `/brand/${f}`);
    expect(files.sort()).toEqual([...used].sort());
  });

  it('the artwork ratios match the SVG viewBoxes', () => {
    for (const [variant, art] of Object.entries(LOGO_ART)) {
      const svg = fs.readFileSync(rel('public', logoSrc(variant, 'full')), 'utf8');
      const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
      expect([w, h], variant).toEqual([art.w, art.h]);
    }
  });

  it('index.html and the manifest only point at files that ship', () => {
    const html = fs.readFileSync(rel('index.html'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(rel('manifest.base.json'), 'utf8'));
    const refs = [...html.matchAll(/(?:href|content)="(\/[^"?]+\.(?:png|svg|ico|woff2))/g)].map((m) => m[1])
      .concat(manifest.icons.map((i) => i.src.split('?')[0]));
    expect(refs.length).toBeGreaterThanOrEqual(8);
    for (const r of refs) expect(fs.existsSync(rel('public', r)), r).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('every @font-face file in index.css ships, and nothing else is in public/fonts', () => {
    const css = fs.readFileSync(rel('src/index.css'), 'utf8');
    const faces = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]).sort();
    const woff = fs.readdirSync(rel('public/fonts')).filter((f) => f.endsWith('.woff2')).sort();
    expect(faces).toEqual(woff);
    expect(woff).toHaveLength(10);
  });
});
