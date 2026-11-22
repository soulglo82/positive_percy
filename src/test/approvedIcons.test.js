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
    expect(Object.keys(APPROVED_CONTEXTS).sort()).toEqual(['behaviors', 'controls', 'goals', 'legacy', 'nav', 'picker', 'rewards']);
    // V1-D §14: the Phosphor reward artwork (book-bookmark for New book); the Streamline artwork ships as files.
    expect(APPROVED_CONTEXTS.rewards).toEqual({ 'New book': 'phosphor:book-bookmark:duotone' });
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
  // E03 §11: behaviour icons are Phosphor; the Lucide behaviour glyphs must not come back.
  'src/lib/categoryIcons.js': ['RotateCcw', 'Undo', 'Undo2', 'Star', 'Heart', 'Handshake', 'Shield', 'Mountain', 'HandHeart', 'Brush', 'BookOpen', 'Palette', 'Footprints', 'Music', 'Brain', 'Bed', 'Check', 'Sparkles', 'Circle'],
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
  // Owner decision 22 Nov (E03 design §11): every behaviour icon is in the one
  // icon family. Each legacy key draws the Phosphor Duotone glyph of the same
  // subject; the key itself is never rewritten. The table is fixed here, so a
  // swap back to Lucide, or to another glyph, fails.
  const LEGACY = { star: 'star', heart: 'heart', handshake: 'handshake', shield: 'shield-star', mountain: 'mountains',
    'hand-heart': 'hand-heart', brush: 'broom', 'book-open': 'book-open', palette: 'palette', footprints: 'footprints',
    music: 'music-notes', brain: 'brain', bed: 'bed', check: 'check', sparkles: 'star-four', circle: 'circle' };

  it('legacy keys draw their approved glyph; approved keys draw approved art; nothing draws Lucide', async () => {
    const { iconFor, ICON_KEYS, PICKER_KEYS } = await import('../lib/categoryIcons.js');
    const { APPROVED_CONTEXTS } = await import('../components/icons/approvedIcons.js');
    for (const [k, slug] of Object.entries(LEGACY)) expect(iconFor(k).displayName, k).toBe(`ApprovedIcon(phosphor:${slug}:duotone)`);
    expect(APPROVED_CONTEXTS.legacy).toEqual(Object.fromEntries(Object.entries(LEGACY).map(([k, slug]) => [k, `phosphor:${slug}:duotone`])));
    expect(ICON_KEYS.slice(0, 16)).toEqual(Object.keys(LEGACY));
    expect(ICON_KEYS.slice(16)).toEqual(PICKER_KEYS);
    for (const k of PICKER_KEYS) expect(iconFor(k).displayName, k).toMatch(/^ApprovedIcon\(phosphor:/);
    for (const k of ['zzz', undefined, null, '', '⭐', 'constructor']) expect(iconFor(k).displayName, String(k)).toBe('ApprovedIcon(phosphor:circle:duotone)');
  });

  it('the register records why each legacy glyph was chosen; the generator refuses an entry without a known basis', async () => {
    const { collect } = await import('../../scripts/brand/build-approved-icons.mjs');
    const group = REGISTER.decisions.behaviors_legacy;
    expect(Object.keys(group)).toEqual(Object.keys(LEGACY));
    for (const k of ['heart', 'shield', 'handshake', 'hand-heart']) expect(group[k].basis, k).toBe('owner_choice_2026-11-22');
    for (const k of Object.keys(LEGACY).filter((x) => !['heart', 'shield', 'handshake', 'hand-heart'].includes(x))) expect(group[k].basis, k).toBe('same_subject_restyle_2026-11-22');
    const bad = structuredClone(REGISTER);
    bad.decisions.behaviors_legacy.heart.basis = 'because';
    expect(() => collect(bad)).toThrow(/behaviors_legacy\/heart/);
    const missing = structuredClone(REGISTER);
    delete missing.decisions.behaviors_legacy.star.basis;
    expect(() => collect(missing)).toThrow(/behaviors_legacy\/star/);
    const unselected = structuredClone(REGISTER);
    unselected.decisions.behaviors_legacy.bed.status = 'proposed';
    expect(() => collect(unselected)).toThrow(/behaviors_legacy\/bed is not selected/);
    // Every legacy key must be there: the app draws all sixteen (code review).
    const gone = structuredClone(REGISTER);
    delete gone.decisions.behaviors_legacy.circle;
    expect(() => collect(gone)).toThrow(/behaviors_legacy\/circle is missing/);
    const noGroup = structuredClone(REGISTER);
    delete noGroup.decisions.behaviors_legacy;
    expect(() => collect(noGroup)).toThrow(/behaviors_legacy is missing/);
  });

  it('one drawing, one meaning: legacy glyphs are distinct, and none is a control, a goal mark or the Done tick', async () => {
    const { APPROVED_CONTEXTS } = await import('../components/icons/approvedIcons.js');
    const legacy = Object.values(APPROVED_CONTEXTS.legacy);
    expect(new Set(legacy).size).toBe(legacy.length);
    const reserved = new Set([...Object.values(APPROVED_CONTEXTS.controls), ...Object.values(APPROVED_CONTEXTS.goals), ...Object.values(APPROVED_CONTEXTS.nav)]);
    expect(reserved.has('phosphor:check-circle:duotone')).toBe(true); // control: the Done mark is in the reserved set
    expect(legacy.filter((id) => reserved.has(id))).toEqual([]);
  });

  it('picker: a stored legacy key is never offered its look-alike, so each tap on "Change icon" changes the drawing', async () => {
    const { nextPickerKey, pickerChoices, iconFor, PICKER_KEYS } = await import('../lib/categoryIcons.js');
    const twins = { 'hand-heart': 'kindness', handshake: 'helping', brain: 'learning', bed: 'sleep', brush: 'chores' };
    for (const [stored, twin] of Object.entries(twins)) {
      expect(iconFor(stored).displayName, `${stored} and ${twin} draw the same glyph`).toBe(iconFor(twin).displayName); // control
      expect(pickerChoices(stored), stored).not.toContain(twin);
      expect(pickerChoices(stored)).toHaveLength(PICKER_KEYS.length); // the stored key and the other ten
    }
    for (const stored of Object.keys(LEGACY)) {
      let k = stored;
      for (let i = 0; i < pickerChoices(stored).length; i++) {
        const next = nextPickerKey(k, stored);
        expect(iconFor(next).displayName, `${stored}: ${k} -> ${next}`).not.toBe(iconFor(k).displayName);
        k = next;
      }
      expect(k, `${stored} comes back`).toBe(stored);
    }
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
