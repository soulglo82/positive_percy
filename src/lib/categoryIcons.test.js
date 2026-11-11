import { describe, it, expect } from 'vitest';
import { Circle, Flag, Heart } from 'lucide-react';
import { ICON_KEYS, ICON_LABELS, iconFor, iconForCategoryName } from './categoryIcons';
import { ICON_KEYS as SERVER_KEYS } from '../../server/iconKeys.js';

describe('behaviour icons', () => {
  it('the app and server use the same 16 keys, each with a label', () => {
    expect(ICON_KEYS).toEqual(SERVER_KEYS);
    expect(ICON_KEYS).toHaveLength(16);
    for (const k of ICON_KEYS) expect(ICON_LABELS[k]).toBeTruthy();
  });
  it('unknown, empty and old emoji values draw a circle', () => {
    for (const k of [undefined, null, '', '⭐', 'Heart', 'constructor', 'toString']) expect(iconFor(k)).toBe(Circle);
    expect(iconFor('heart')).toBe(Heart);
  });
  it('history rows: reserved names, case and spaces ignored; no match is a circle', () => {
    expect(iconForCategoryName(' Starting Points ')).toBe(Flag);
    expect(iconForCategoryName('kindness', [{ name: 'Kindness', icon_key: 'heart' }])).toBe(Heart);
    expect(iconForCategoryName('Gone', [])).toBe(Circle);
  });
});
