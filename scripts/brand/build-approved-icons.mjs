#!/usr/bin/env node
// E03: builds src/components/icons/approvedIcons.js from the owner approval
// register. Every icon is the exact checked-in source SVG (verified against its
// pinned upstream URL; see docs/engineering/E03-DESIGN.md). Nothing is redrawn.
//
//   node scripts/brand/build-approved-icons.mjs          write the module
//   node scripts/brand/build-approved-icons.mjs --check  exit 1 if it is stale
//
// src/test/approvedIcons.test.js runs build() and compares, so a hand edit or
// a register change without regenerating fails CI.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REGISTER = 'design/stage1/APPROVAL_REGISTER.json';
export const OUT = 'src/components/icons/approvedIcons.js';

// Reward artwork (V1-D §14): the Streamline Plump entries of
// decisions.rewards are served unchanged as image files (public/reward-art);
// only its Phosphor entries (book-bookmark for New book) are generated here,
// as the `rewards` context.
const GROUPS = ['nav', 'controls', 'behaviors'];

export function collect(register) {
  const contexts = {};
  const assets = new Map();
  const add = (id, file, url, licence) => {
    const prev = assets.get(id);
    if (prev && prev.file !== file) throw new Error(`${id} has two source files: ${prev.file} and ${file}`);
    assets.set(id, { id, file, url, licence });
  };
  for (const group of GROUPS) {
    contexts[group] = {};
    for (const [ctx, e] of Object.entries(register.decisions[group])) {
      if (e.status !== 'selected') throw new Error(`${group}/${ctx} is not selected (${e.status})`);
      contexts[group][ctx] = e.asset_id;
      add(e.asset_id, e.source_file, e.source_url, e.license);
    }
  }
  contexts.goals = {};
  for (const [ctx, v] of Object.entries(register.decisions.goals_interactions)) {
    const e = v.exact_source_svg;
    if (!e) continue;
    if (e.status !== 'owner_approved') throw new Error(`goals/${ctx} source not owner_approved`);
    contexts.goals[ctx] = e.asset_id;
    add(e.asset_id, e.local_file, e.source_url, e.license_reference);
  }
  contexts.rewards = {};
  for (const [ctx, e] of Object.entries(register.decisions.rewards)) {
    if (!e.asset_id.startsWith('phosphor:')) continue;
    if (e.status !== 'selected') throw new Error(`rewards/${ctx} is not selected (${e.status})`);
    contexts.rewards[ctx] = e.asset_id;
    add(e.asset_id, e.source_file, e.source_url, e.license);
  }
  // V1-D: the owner-approved reward picker (12 categories, 84 placements, 71
  // Phosphor Duotone icons). Each source is the checked-in file whose hash
  // equals the recorded upstream fetch (design/brand/UPSTREAM_VERIFICATION.json).
  contexts.picker = {};
  for (const [name, cat] of Object.entries(register.picker.categories)) {
    if (cat.status !== 'owner_selected') throw new Error(`picker/${name} is not owner_selected (${cat.status})`);
    contexts.picker[name] = cat.asset_ids;
    for (const id of cat.asset_ids) {
      const [, slug, variant] = id.split(':');
      if (variant !== 'duotone') throw new Error(`picker/${name}: ${id} is not duotone`);
      add(id, `design/assets/phosphor/duotone/${slug}.svg`,
        `https://raw.githubusercontent.com/phosphor-icons/core/2b75f3ad12b420c9504ef05df8d2564a28f8500e/assets/duotone/${slug}-duotone.svg`,
        register.picker.license);
    }
  }
  return { contexts, assets: [...assets.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

export function parseSvg(text, file) {
  const open = text.match(/<svg\b[^>]*>/);
  const close = text.lastIndexOf('</svg>');
  if (!open || close < 0) throw new Error(`${file}: not an svg`);
  const vb = open[0].match(/viewBox="([^"]+)"/);
  if (!vb) throw new Error(`${file}: no viewBox`);
  const inner = text.slice(open.index + open[0].length, close).trim();
  // Inline copies render many times per page: ids would collide and url(#id)
  // references would break, so neither is allowed in an inline icon.
  if (/\bid\s*=|url\(/i.test(inner)) throw new Error(`${file}: ids or url() refs cannot be inlined`);
  // Phosphor draws with the root's fill="currentColor"; Streamline sets fills
  // on each path and has fill="none" on the root. Keep the root's fill.
  const fill = (open[0].match(/\bfill="([^"]+)"/) || [])[1] || null;
  return { viewBox: vb[1], fill, inner };
}

export function build(root = ROOT) {
  const register = JSON.parse(fs.readFileSync(path.join(root, REGISTER), 'utf8'));
  const { contexts, assets } = collect(register);
  const icons = {};
  for (const a of assets) {
    if (!a.id.startsWith('phosphor:')) throw new Error(`${a.id}: only Phosphor icons are inlined in E03`);
    const buf = fs.readFileSync(path.join(root, a.file));
    const { viewBox, fill, inner } = parseSvg(buf.toString('utf8'), a.file);
    icons[a.id] = {
      viewBox, fill, inner, source: a.file, upstream: a.url, licence: a.licence,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    };
  }
  return '/*! @license Phosphor Icons, MIT License, Copyright (c) 2023 Phosphor Icons.\n'
    + ' * https://github.com/phosphor-icons/core (commit 2b75f3ad12b420c9504ef05df8d2564a28f8500e).\n'
    + ' * Full text: /licenses/phosphor-MIT.txt */\n'
    + '// GENERATED by scripts/brand/build-approved-icons.mjs from ' + REGISTER + '.\n'
    + '// Do not edit by hand: src/test/approvedIcons.test.js fails if this file is stale.\n'
    + 'export const APPROVED_CONTEXTS = ' + JSON.stringify(contexts, null, 2) + ';\n\n'
    + 'export const APPROVED_ICONS = ' + JSON.stringify(icons, null, 2) + ';\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = build();
  const out = path.join(ROOT, OUT);
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== text) { console.error(`${OUT} is stale: run node scripts/brand/build-approved-icons.mjs`); process.exit(1); }
    console.log(`${OUT} is current.`);
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text);
    console.log(`wrote ${OUT}`);
  }
}
