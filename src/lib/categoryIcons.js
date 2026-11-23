// Batch D PR2: behaviour icons. The server stores a key (behavior_categories.icon_key);
// the app draws the matching icon. Keep ICON_KEYS in step with server/iconKeys.js
// (checked by src/lib/categoryIcons.test.js).
import { Flag, Scale } from 'lucide-react';
import { approvedIcon } from '@/components/icons/PercyIcon';
import { APPROVED_CONTEXTS } from '@/components/icons/approvedIcons';

// E03: the 11 owner-approved behaviour icons, keyed by a stable slug of the
// register context. Appended after the Batch D keys (the server list matches,
// in the same order).
const APPROVED_BEHAVIOURS = {
  kindness: 'Kindness', learning: 'Learning', helping: 'Helping', chores: 'Chores',
  movement: 'Movement', reading: 'Reading', routines: 'Routines', 'self-care': 'Self-care',
  community: 'Community', creativity: 'Creativity', sleep: 'Sleep',
};
const approvedBehaviour = Object.fromEntries(Object.entries(APPROVED_BEHAVIOURS)
  .map(([key, ctx]) => [key, approvedIcon(APPROVED_CONTEXTS.behaviors[ctx])]));

// The 16 Batch D ("legacy") keys. Owner decision 22 Nov 2026 (E03 design §11):
// every behaviour icon is in the one icon family, so each legacy key draws the
// Phosphor Duotone glyph of the same subject (register decisions.behaviors_legacy;
// Kindness's heart and Bravery's shield-star are the owner's own choices).
// Only the drawing changed: no stored key is rewritten, and the order below is
// the server's (server/iconKeys.js).
const LEGACY_KEYS = ['star', 'heart', 'handshake', 'shield', 'mountain', 'hand-heart', 'brush', 'book-open',
  'palette', 'footprints', 'music', 'brain', 'bed', 'check', 'sparkles', 'circle'];
const legacyBehaviour = Object.fromEntries(LEGACY_KEYS.map((key) => [key, approvedIcon(APPROVED_CONTEXTS.legacy[key])]));
const UnknownIcon = legacyBehaviour.circle;

export const ICONS = {
  ...legacyBehaviour,
  ...approvedBehaviour,
};

export const ICON_KEYS = Object.keys(ICONS);

// Plain names for screen readers in the picker.
export const ICON_LABELS = {
  star: 'Star', heart: 'Heart', handshake: 'Handshake', shield: 'Shield with star', mountain: 'Mountains',
  'hand-heart': 'Caring hands', brush: 'Broom', 'book-open': 'Book', palette: 'Paint palette',
  footprints: 'Footprints', music: 'Music', brain: 'Brain', bed: 'Bed', check: 'Tick',
  sparkles: 'Sparkle', circle: 'Circle',
  ...APPROVED_BEHAVIOURS,
};

// The icons a parent can choose (the approved set). ICON_KEYS stays the full
// list, for server parity and for drawing what is stored.
export const PICKER_KEYS = Object.keys(APPROVED_BEHAVIOURS);

// The picker's choices. `stored` is the key the category had when the form
// opened (or the create form's default). If it is not approved (legacy or
// unknown) it is offered first and stays in the cycle, so opening and saving
// never changes it silently and the parent can always tap back to it.
// A stored legacy key can draw the same glyph as an approved key (hand-heart
// and kindness, handshake and helping, brain and learning, bed and sleep,
// brush and chores). That twin is left out of its cycle, or a tap on "Change
// icon" would appear to do nothing (E03 design §11, design review B3).
const drawing = (key) => ICONS[key]?.displayName;
export function pickerChoices(stored) {
  if (!stored || PICKER_KEYS.includes(stored)) return PICKER_KEYS;
  const same = drawing(stored);
  return [stored, ...PICKER_KEYS.filter((key) => !same || drawing(key) !== same)];
}

export function nextPickerKey(current, stored) {
  const list = pickerChoices(stored);
  return list[(list.indexOf(current) + 1) % list.length];
}

// History rows that are not behaviours.
// E03: Undo uses the approved arrow-counter-clockwise (register controls.Undo).
const RESERVED = { 'starting points': Flag, 'balance correction': Scale, undo: approvedIcon(APPROVED_CONTEXTS.controls.Undo) };

export function iconFor(key) {
  return Object.hasOwn(ICONS, key ?? '') ? ICONS[key] : UnknownIcon;
}

// For history rows, which only carry the category name.
export function iconForCategoryName(name, categories = []) {
  const n = String(name || '').trim().toLowerCase();
  if (Object.hasOwn(RESERVED, n)) return RESERVED[n];
  const cat = categories.find((c) => String(c.name || '').trim().toLowerCase() === n);
  return iconFor(cat?.icon_key);
}
