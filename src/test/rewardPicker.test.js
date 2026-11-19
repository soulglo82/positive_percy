// V1-D (docs/engineering/V1-D-DESIGN.md §2, §4.2): one icon set in four
// places - the owner approval register, the server validator, the migration
// CHECK and the client picker - and the approved search, labels and
// container breakpoints.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REWARD_ICON_KEYS } from '../../server/rewardIcons.js';
import {
  PICKER_CATEGORIES, PICKER_ICONS, PICKER_ALIASES, pickerItems, pickerLabel, columnsForWidth, accentOf, isPickerIcon,
} from '../lib/rewardPicker.js';

const ROOT = path.resolve(__dirname, '../..');
const REGISTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/stage1/APPROVAL_REGISTER.json'), 'utf8')).picker;
const SQL = fs.readFileSync(path.join(ROOT, 'server/migrations/015_reward_icon_key.sql'), 'utf8');
const label = (items) => items.map(pickerLabel);

describe('one approved icon set', () => {
  const fromRegister = Object.values(REGISTER.categories).flatMap((c) => c.asset_ids);
  it('the client picker has the register categories, in order, with the same placements', () => {
    expect(PICKER_CATEGORIES.map((c) => c.name)).toEqual(Object.keys(REGISTER.categories));
    for (const c of PICKER_CATEGORIES) expect(c.icons, c.name).toEqual(REGISTER.categories[c.name].asset_ids);
    expect(PICKER_CATEGORIES.flatMap((c) => c.icons)).toHaveLength(84);
  });
  it('server validator, migration CHECK and client picker are the same 71 icons as the register', () => {
    const want = [...new Set(fromRegister)].sort();
    expect(want).toHaveLength(71);
    expect([...REWARD_ICON_KEYS].sort()).toEqual(want);
    expect([...PICKER_ICONS].sort()).toEqual(want);
    expect([...new Set([...SQL.matchAll(/'(phosphor:[a-z0-9-]+:duotone)'/g)].map((m) => m[1]))].sort()).toEqual(want);
  });
  it('category accents are the owner-approved mapping', () => {
    const mapping = REGISTER.ux_choices.category_colour_mapping.per_category;
    for (const c of PICKER_CATEGORIES) expect(c.accent, c.name).toBe(mapping[c.name]);
  });
  it('isPickerIcon refuses near-misses', () => {
    expect(isPickerIcon('phosphor:gift:duotone')).toBe(true);
    for (const bad of ['gift', 'phosphor:gift:regular', 'phosphor:gear:duotone', '', null, 42]) expect(isPickerIcon(bad), String(bad)).toBe(false);
  });
});

describe('approved search (pickerItems)', () => {
  it('P1: an alias finds an icon once, though it sits in two categories', () => {
    expect(label(pickerItems('Fun & games', 'bike'))).toEqual(['Bicycle']);
  });
  it('P2: "movie" finds Film Slate by alias, nothing else', () => {
    expect(label(pickerItems('Fun & games', 'movie'))).toEqual(['Film Slate']);
  });
  it('P3: case and spaces are ignored; names match too', () => {
    expect(label(pickerItems('Outings', '  CAKE '))).toEqual(['Cake']);
    expect(label(pickerItems('Outings', 'game controller'))).toEqual(['Game Controller']);
  });
  it('P4: no match gives an empty list', () => {
    expect(pickerItems('Outings', 'zzz')).toEqual([]);
  });
  it('P5: an empty term shows the category', () => {
    expect(pickerItems('Tech & media', '')).toHaveLength(4);
    expect(pickerItems('Tech & media', '   ')).toHaveLength(4);
  });
  it('a search never returns an icon twice, across all 71', () => {
    for (const t of ['a', 'e', 'o', 'ball', 'pet']) {
      const r = pickerItems('x', t);
      expect(new Set(r).size, t).toBe(r.length);
    }
  });
  it('aliases are the approved HTML set (13 entries)', () => {
    expect(Object.keys(PICKER_ALIASES)).toHaveLength(13);
    expect(PICKER_ALIASES['piggy-bank']).toBe('money savings pocket money');
  });
});

describe('labels, accents and columns', () => {
  it('labels title-case the id', () => {
    expect(pickerLabel('phosphor:game-controller:duotone')).toBe('Game Controller');
    expect(pickerLabel('phosphor:person-simple-run:duotone')).toBe('Person Simple Run');
  });
  it('P6: container breakpoints 520 and 760', () => {
    expect([0, 519, 520, 759, 760, 1200].map(columnsForWidth)).toEqual([3, 3, 5, 5, 6, 6]);
  });
  it('accent of an icon is its first category\'s', () => {
    expect(accentOf('phosphor:game-controller:duotone')).toBe('orange');
    expect(accentOf('phosphor:cat:duotone')).toBe('purple');
  });
});
