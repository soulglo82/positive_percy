// E03 guards (docs/engineering/E03-DESIGN.md section 6): approved icons are
// the exact upstream-verified sources, the generated module is current, mapped
// call sites cannot drift back to Lucide, behaviour keys round-trip, and
// illustrations are only register-selected, licence-cleared assets.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { build, OUT } from '../../scripts/brand/build-approved-icons.mjs';
import { svgProblems } from './svgScan.js';

const ROOT = path.resolve(__dirname, '../..');
const rel = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const REGISTER = JSON.parse(read('design/stage1/APPROVAL_REGISTER.json'));
const UPSTREAM = JSON.parse(read('design/brand/UPSTREAM_VERIFICATION.json'));
const upstreamById = new Map(UPSTREAM.assets.map((a) => [a.asset_id, a]));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const APP = walk(rel('src')).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes(`${path.sep}test${path.sep}`) && !/\.test\./.test(f));

describe('generated approved-icon module', () => {
  it('is current (committed file equals a fresh build from the register)', () => {
    expect(read(OUT)).toBe(build(ROOT));
  });

  it('keeps the MIT notice esbuild preserves', () => {
    expect(read(OUT).startsWith('/*! @license Phosphor Icons, MIT License')).toBe(true);
  });

  it('holds exactly the register nav, controls, behaviours, goals and reward-picker sources, all Phosphor', async () => {
    const { APPROVED_ICONS, APPROVED_CONTEXTS } = await import('../components/icons/approvedIcons.js');
    expect(Object.keys(APPROVED_CONTEXTS).sort()).toEqual(['behaviors', 'controls', 'goals', 'nav', 'picker']);
    // V1-D: the owner's launch library is 12 categories, 84 placements, 71
    // icons (register picker.ux_choices.launch_library), numbers fixed here
    // so a register edit that silently adds icons fails.
    const picker = APPROVED_CONTEXTS.picker;
    expect(Object.keys(picker)).toHaveLength(12);
    expect(Object.values(picker).flat()).toHaveLength(84);
    expect(new Set(Object.values(picker).flat()).size).toBe(71);
    for (const id of Object.values(picker).flat()) expect(APPROVED_ICONS[id], id).toBeTruthy();
    for (const g of ['nav', 'controls', 'behaviors']) {
      expect(Object.keys(APPROVED_CONTEXTS[g]).sort()).toEqual(Object.keys(REGISTER.decisions[g]).sort());
    }
    expect(Object.keys(APPROVED_CONTEXTS.nav)).toHaveLength(5);
    expect(Object.keys(APPROVED_CONTEXTS.controls)).toHaveLength(10);
    expect(Object.keys(APPROVED_CONTEXTS.behaviors)).toHaveLength(11);
    expect(Object.keys(APPROVED_ICONS).every((id) => id.startsWith('phosphor:'))).toBe(true);
  });

  it('every icon equals its source file, which equals the recorded upstream fetch', async () => {
    const { APPROVED_ICONS } = await import('../components/icons/approvedIcons.js');
    for (const [id, icon] of Object.entries(APPROVED_ICONS)) {
      const up = upstreamById.get(id);
      expect(up, `${id} has no upstream record`).toBeTruthy();
      expect(icon.source).toBe(up.source);
      expect(sha(fs.readFileSync(rel(icon.source))), id).toBe(up.sha256);
      expect(icon.sha256).toBe(up.sha256);
    }
  });

  it('inline markup has no active content, no ids and no url() references', async () => {
    const { APPROVED_ICONS } = await import('../components/icons/approvedIcons.js');
    for (const [id, icon] of Object.entries(APPROVED_ICONS)) {
      expect(svgProblems(`<svg>${icon.inner}</svg>`), id).toEqual([]);
      expect(icon.inner, id).not.toMatch(/\bid\s*=|url\(/i);
    }
  });

  it('the generator refuses ids and url() (counter-example)', async () => {
    const { parseSvg } = await import('../../scripts/brand/build-approved-icons.mjs');
    expect(() => parseSvg('<svg viewBox="0 0 1 1"><path id="a" d=""/></svg>', 'x')).toThrow(/ids or url/);
    expect(() => parseSvg('<svg viewBox="0 0 1 1"><path fill="url(#g)" d=""/></svg>', 'x')).toThrow(/ids or url/);
    expect(parseSvg('<svg viewBox="0 0 1 1" fill="currentColor"><path d="M0"/></svg>', 'x').fill).toBe('currentColor');
  });
});

// Ids passed to PercyIcon / approvedIcon must be literals that exist.
export function iconIdProblems(text, known) {
  const out = [];
  for (const m of text.matchAll(/<PercyIcon\b[^>]*?\bid=(\{[^}]*\}|"[^"]*"|'[^']*')/g)) {
    const v = m[1];
    if (v.startsWith('{')) out.push(`non-literal id ${v}`);
    else if (!known.has(v.slice(1, -1))) out.push(`unknown id ${v}`);
  }
  for (const m of text.matchAll(/approvedIcon\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    if (!known.has(m[2])) out.push(`unknown id ${m[2]}`);
  }
  return out;
}

describe('icon ids in the app', () => {
  it('every literal id exists; no PercyIcon takes a computed id', async () => {
    const { APPROVED_ICONS } = await import('../components/icons/approvedIcons.js');
    const known = new Set(Object.keys(APPROVED_ICONS));
    let used = 0;
    // PercyIcon.jsx defines the component; its factory validates ids itself.
    for (const f of APP.filter((x) => !x.endsWith(`icons${path.sep}PercyIcon.jsx`))) {
      const t = fs.readFileSync(f, 'utf8');
      used += (t.match(/<PercyIcon\b/g) || []).length;
      expect(iconIdProblems(t, known), path.relative(ROOT, f)).toEqual([]);
    }
    expect(used).toBeGreaterThanOrEqual(15); // control: the scan sees the call sites (19 after V1-D removed the old reward modals)
  });
  it.each([
    ['<PercyIcon id="phosphor:nope:duotone" />', 1],
    ['<PercyIcon id={someId} />', 1],
    ["approvedIcon('phosphor:nope:duotone')", 1],
    ['<PercyIcon id="phosphor:gift:duotone" className="h-4 w-4" />', 0],
  ])('fixture %s -> %i problem(s)', async (text, n) => {
    const { APPROVED_ICONS } = await import('../components/icons/approvedIcons.js');
    expect(iconIdProblems(text, new Set(Object.keys(APPROVED_ICONS)))).toHaveLength(n);
  });
});

// Retired Lucide glyphs, per file (section 6). Aliases are banned too.
const ALIASES = ['Edit', 'Edit2', 'Edit3', 'PlusCircle', 'CirclePlus', 'SquarePen', 'PencilLine', 'House'];
const BANS = {
  '*': ['Pencil', 'Plus', ...ALIASES],
  'src/Layout.jsx': ['Home', 'User', 'Activity', 'Gift', 'Settings'],
  'src/components/dashboard/ManageGoalsDialog.jsx': ['Archive', 'Repeat2', 'Repeat', 'Calendar', 'CalendarDays'],
  'src/pages/ParentProfile.jsx': ['Lightbulb', 'Info'],
  // E05 removed the exemption: the completed-goal tile keeps its category icon.
  'src/components/dashboard/TodaysGoalsPanel.jsx': ['Settings2', 'Target', 'Check', 'Sparkles', 'Sparkle', 'CheckCircle2', 'CircleCheck', 'ClipboardCheck'],
  'src/lib/categoryIcons.js': ['RotateCcw', 'Undo', 'Undo2'],
  // V1-D: the reward form replaced AddRewardModal; its gift stays Phosphor.
  'src/components/rewards/RewardForm.jsx': ['Gift'],
};
export function lucideImports(text) {
  return [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean));
}

describe('retired Lucide glyphs stay retired', () => {
  it.each(APP.map((f) => [path.relative(ROOT, f).split(path.sep).join('/')]))('%s', (f) => {
    const names = lucideImports(read(f));
    const banned = [...BANS['*'], ...(BANS[f] || [])];
    expect(names.filter((n) => banned.includes(n))).toEqual([]);
  });
  it.each([
    ["import { Pencil } from 'lucide-react';", ['Pencil']],
    ['import { X, Plus as Add } from "lucide-react";', ['X', 'Plus']],
    ["import {\n  Copy,\n  Edit2,\n} from 'lucide-react';", ['Copy', 'Edit2']],
  ])('import parser fixture %#', (text, want) => {
    expect(lucideImports(text)).toEqual(want);
  });
});

describe('behaviour keys', () => {
  it('legacy keys draw exactly what they drew before; approved keys draw approved art', async () => {
    const lucide = await import('lucide-react');
    const { iconFor, ICON_KEYS, PICKER_KEYS } = await import('../lib/categoryIcons.js');
    const LEGACY = { star: 'Star', heart: 'Heart', handshake: 'Handshake', shield: 'Shield', mountain: 'Mountain',
      'hand-heart': 'HandHeart', brush: 'Brush', 'book-open': 'BookOpen', palette: 'Palette', footprints: 'Footprints',
      music: 'Music', brain: 'Brain', bed: 'Bed', check: 'Check', sparkles: 'Sparkles', circle: 'Circle' };
    for (const [k, name] of Object.entries(LEGACY)) expect(iconFor(k), k).toBe(lucide[name]);
    expect(ICON_KEYS.slice(0, 16)).toEqual(Object.keys(LEGACY));
    expect(ICON_KEYS.slice(16)).toEqual(PICKER_KEYS);
    for (const k of PICKER_KEYS) expect(iconFor(k).displayName, k).toMatch(/^ApprovedIcon\(phosphor:/);
    expect(iconFor('zzz')).toBe(lucide.Circle);
  });

  it('picker: a legacy key stays reachable; approved keys never cycle into a legacy key', async () => {
    const { nextPickerKey, pickerChoices, PICKER_KEYS } = await import('../lib/categoryIcons.js');
    for (const stored of ['heart', 'circle', 'zzz', 'star']) {
      const seen = [];
      let k = stored;
      for (let i = 0; i < PICKER_KEYS.length + 1; i++) { k = nextPickerKey(k, stored); seen.push(k); }
      expect(k, `${stored} comes back after a full cycle`).toBe(stored);
      expect(new Set(seen)).toEqual(new Set(pickerChoices(stored)));
    }
    let k = 'sleep';
    for (let i = 0; i < 30; i++) { k = nextPickerKey(k, 'kindness'); expect(PICKER_KEYS).toContain(k); }
    expect(pickerChoices('kindness')).toEqual(PICKER_KEYS);
  });
});

describe('illustrations', () => {
  const selected = new Map();
  for (const group of Object.values(REGISTER.visuals)) {
    for (const v of Object.values(group)) selected.set(v.source_file, v.status);
  }
  const MANIFEST = JSON.parse(read('design/brand/RUNTIME_ASSETS.json'));
  const bySrcRuntime = new Map(MANIFEST.entries.map((e) => [e.runtime.replace(/^public/, ''), e.source]));

  it('every /illustrations file used in the app is a register-selected visual (not pending licence)', () => {
    let refs = 0;
    for (const f of APP) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/["'](\/illustrations\/[^"']+)["']/g)) {
        refs++;
        const src = bySrcRuntime.get(m[1]);
        expect(src, `${m[1]} is not in the manifest`).toBeTruthy();
        expect(selected.get(src), `${m[1]} (${src})`).toBe('selected');
      }
    }
    // V1-F/V1-D: the locked V1 design has no Home sticker, no onboarding
    // illustration and no reward-form illustration (the V1 form shows the
    // reward's own icon), so the app references none. Any new reference is
    // still checked above against the register.
    expect(refs).toBe(0);
  });

  it('every illustration <img> is decorative (alt="")', () => {
    for (const f of APP) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/<img\b[^>]*\/illustrations\/[^>]*>/g)) {
        expect(m[0], path.relative(ROOT, f)).toMatch(/\balt=""/);
      }
    }
  });

  it('the Freepik map is not shipped or referenced', () => {
    const freepik = sha(fs.readFileSync(rel('design/brand/library/Positive_Percy_Stage1_Brand_System/04_Illustrations/treasure-map_3570506.png')));
    for (const f of walk(rel('public'))) expect(sha(fs.readFileSync(f)), f).not.toBe(freepik);
    for (const f of APP) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/treasure-map|3570506/);
  });
});
