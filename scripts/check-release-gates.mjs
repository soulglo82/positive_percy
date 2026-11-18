#!/usr/bin/env node
// Release gates (docs/engineering/V1-F-DESIGN.md §3). Exit 1 if a built
// directory (default dist/) or public/ holds a file with a gated asset's
// content hash while its gate is not cleared. By hash, so a rename does not
// dodge it. CI runs it after every build.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGates, isCleared } from './brand/gated-assets.mjs';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function openGates(root, dirs = ['dist', 'public']) {
  const files = dirs.flatMap((d) => walk(path.join(root, d)));
  const shipped = new Map(files.map((f) => [sha(fs.readFileSync(f)), path.relative(root, f)]));
  return readGates(root)
    .filter((g) => !isCleared(g))
    .filter((g) => shipped.has(g.sha256))
    .map((g) => ({ id: g.id, file: shipped.get(g.sha256), clears_when: g.clears_when }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const open = openGates(process.cwd());
  for (const g of open) console.error(`Release gate open: ${g.id} (${g.file}). Clears when: ${g.clears_when}`);
  if (open.length) process.exit(1);
  console.log('Release gates: no gated file in dist/ or public/ while its gate is open.');
}
