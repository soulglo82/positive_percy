// Batch D PR2: behaviour icons. The server stores a key (behavior_categories.icon_key);
// the app draws the matching line icon. Keep ICON_KEYS in step with server/iconKeys.js
// (checked by src/lib/categoryIcons.test.js).
import {
  Star, Heart, Handshake, Shield, Mountain, HandHeart, Brush, BookOpen, Palette,
  Footprints, Music, Brain, Bed, Check, Sparkles, Circle, Flag, Scale,
} from 'lucide-react';
import { approvedIcon } from '@/components/icons/PercyIcon';
import { APPROVED_CONTEXTS } from '@/components/icons/approvedIcons';

// E03: the 11 owner-approved behaviour icons, keyed by a stable slug of the
// register context. Appended after the Batch D keys (the server list matches,
// in the same order). Legacy keys keep drawing exactly what they drew before:
// mapping them to approved art is an owner decision (E03 design, decision 1).
const APPROVED_BEHAVIOURS = {
  kindness: 'Kindness', learning: 'Learning', helping: 'Helping', chores: 'Chores',
  movement: 'Movement', reading: 'Reading', routines: 'Routines', 'self-care': 'Self-care',
  community: 'Community', creativity: 'Creativity', sleep: 'Sleep',
};
const approvedBehaviour = Object.fromEntries(Object.entries(APPROVED_BEHAVIOURS)
  .map(([key, ctx]) => [key, approvedIcon(APPROVED_CONTEXTS.behaviors[ctx])]));

export const ICONS = {
  star: Star, heart: Heart, handshake: Handshake, shield: Shield, mountain: Mountain,
  'hand-heart': HandHeart, brush: Brush, 'book-open': BookOpen, palette: Palette,
  footprints: Footprints, music: Music, brain: Brain, bed: Bed, check: Check,
  sparkles: Sparkles, circle: Circle,
  ...approvedBehaviour,
};

export const ICON_KEYS = Object.keys(ICONS);

// Plain names for screen readers in the picker.
export const ICON_LABELS = {
  star: 'Star', heart: 'Heart', handshake: 'Handshake', shield: 'Shield', mountain: 'Mountain',
  'hand-heart': 'Caring hands', brush: 'Brush', 'book-open': 'Book', palette: 'Paint palette',
  footprints: 'Footprints', music: 'Music', brain: 'Brain', bed: 'Bed', check: 'Tick',
  sparkles: 'Sparkles', circle: 'Circle',
  ...APPROVED_BEHAVIOURS,
};

// The icons a parent can choose (the approved set). ICON_KEYS stays the full
// list, for server parity and for drawing what is stored.
export const PICKER_KEYS = Object.keys(APPROVED_BEHAVIOURS);

// The picker's choices. `stored` is the key the category had when the form
// opened (or the create form's default). If it is not approved (legacy or
// unknown) it is offered first and stays in the cycle, so opening and saving
// never changes it silently and the parent can always tap back to it.
export function pickerChoices(stored) {
  return stored && !PICKER_KEYS.includes(stored) ? [stored, ...PICKER_KEYS] : PICKER_KEYS;
}

export function nextPickerKey(current, stored) {
  const list = pickerChoices(stored);
  return list[(list.indexOf(current) + 1) % list.length];
}

// History rows that are not behaviours.
// E03: Undo uses the approved arrow-counter-clockwise (register controls.Undo).
const RESERVED = { 'starting points': Flag, 'balance correction': Scale, undo: approvedIcon(APPROVED_CONTEXTS.controls.Undo) };

export function iconFor(key) {
  return Object.hasOwn(ICONS, key ?? '') ? ICONS[key] : Circle;
}

// For history rows, which only carry the category name.
export function iconForCategoryName(name, categories = []) {
  const n = String(name || '').trim().toLowerCase();
  if (Object.hasOwn(RESERVED, n)) return RESERVED[n];
  const cat = categories.find((c) => String(c.name || '').trim().toLowerCase() === n);
  return iconFor(cat?.icon_key);
}
