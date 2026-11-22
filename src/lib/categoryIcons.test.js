import { describe, it, expect } from 'vitest';
import { Flag } from 'lucide-react';
import { ICON_KEYS, ICON_LABELS, iconFor, iconForCategoryName } from './categoryIcons';
import { ICON_KEYS as SERVER_KEYS } from '../../server/iconKeys.js';

describe('behaviour icons', () => {
  // E03: 16 Batch D keys + 11 owner-approved keys, same order on both sides.
  it('the app and server use the same 27 keys, each with a label', () => {
    expect(ICON_KEYS).toEqual(SERVER_KEYS);
    expect(ICON_KEYS).toHaveLength(27);
    for (const k of ICON_KEYS) expect(ICON_LABELS[k]).toBeTruthy();
  });
  // E03 design §11 (owner decision 22 Nov): legacy keys draw approved Phosphor glyphs.
  const id = (Icon) => Icon.displayName;
  it('unknown, empty and old emoji values draw the approved circle', () => {
    for (const k of [undefined, null, '', '⭐', 'Heart', 'constructor', 'toString']) expect(id(iconFor(k))).toBe('ApprovedIcon(phosphor:circle:duotone)');
    expect(id(iconFor('heart'))).toBe('ApprovedIcon(phosphor:heart:duotone)');
    expect(id(iconFor('shield'))).toBe('ApprovedIcon(phosphor:shield-star:duotone)');
  });
  it('history rows: reserved names, case and spaces ignored; no match is a circle', () => {
    expect(iconForCategoryName(' Starting Points ')).toBe(Flag);
    expect(id(iconForCategoryName('kindness', [{ name: 'Kindness', icon_key: 'heart' }]))).toBe('ApprovedIcon(phosphor:heart:duotone)');
    expect(id(iconForCategoryName('Gone', []))).toBe('ApprovedIcon(phosphor:circle:duotone)');
  });
});
