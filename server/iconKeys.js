// Batch D PR2: the behaviour icon keys the app can draw. Keep in step with
// src/lib/categoryIcons.js (a test compares them).
export const ICON_KEYS = [
  'star', 'heart', 'handshake', 'shield', 'mountain', 'hand-heart', 'brush', 'book-open',
  'palette', 'footprints', 'music', 'brain', 'bed', 'check', 'sparkles', 'circle',
  // E03: the 11 owner-approved behaviour icons (APPROVAL_REGISTER decisions.behaviors).
  // Additive only: no stored key is rewritten. Ship and keep this list even if
  // the E03 UI is reverted, or families who chose these keys get a 422 on edit.
  'kindness', 'learning', 'helping', 'chores', 'movement', 'reading', 'routines',
  'self-care', 'community', 'creativity', 'sleep',
];
export const isIconKey = (k) => typeof k === 'string' && ICON_KEYS.includes(k);
