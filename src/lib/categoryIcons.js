// Batch D PR2: behaviour icons. The server stores a key (behavior_categories.icon_key);
// the app draws the matching line icon. Keep ICON_KEYS in step with server/iconKeys.js
// (checked by src/lib/categoryIcons.test.js).
import {
  Star, Heart, Handshake, Shield, Mountain, HandHeart, Brush, BookOpen, Palette,
  Footprints, Music, Brain, Bed, Check, Sparkles, Circle, Flag, Scale, RotateCcw,
} from 'lucide-react';

export const ICONS = {
  star: Star, heart: Heart, handshake: Handshake, shield: Shield, mountain: Mountain,
  'hand-heart': HandHeart, brush: Brush, 'book-open': BookOpen, palette: Palette,
  footprints: Footprints, music: Music, brain: Brain, bed: Bed, check: Check,
  sparkles: Sparkles, circle: Circle,
};

export const ICON_KEYS = Object.keys(ICONS);

// Plain names for screen readers in the picker.
export const ICON_LABELS = {
  star: 'Star', heart: 'Heart', handshake: 'Handshake', shield: 'Shield', mountain: 'Mountain',
  'hand-heart': 'Caring hands', brush: 'Brush', 'book-open': 'Book', palette: 'Paint palette',
  footprints: 'Footprints', music: 'Music', brain: 'Brain', bed: 'Bed', check: 'Tick',
  sparkles: 'Sparkles', circle: 'Circle',
};

// History rows that are not behaviours.
const RESERVED = { 'starting points': Flag, 'balance correction': Scale, undo: RotateCcw };

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
