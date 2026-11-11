// Batch D PR2: the behaviour icon keys the app can draw. Keep in step with
// src/lib/categoryIcons.js (a test compares them).
export const ICON_KEYS = [
  'star', 'heart', 'handshake', 'shield', 'mountain', 'hand-heart', 'brush', 'book-open',
  'palette', 'footprints', 'music', 'brain', 'bed', 'check', 'sparkles', 'circle',
];
export const isIconKey = (k) => typeof k === 'string' && ICON_KEYS.includes(k);
