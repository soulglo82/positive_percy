// The one JS copy of the design tokens (Batch D structure, E02 Percy v2
// values: docs/engineering/E01-E02-DESIGN.md section 3). index.css holds the same
// values as HSL channels; src/test/tokens.test.js checks the two match.
// Used where CSS variables can't reach: confetti, the manifest and the
// theme-color meta (written by the Vite plugin in vite.config.js).

export const TOKENS = {
  background: '#fff6e8',
  card: '#ffffff',
  popover: '#ffffff',
  muted: '#f9f3ff',
  secondary: '#f9f3ff',
  accent: '#eee4f0',
  foreground: '#271737',
  'card-foreground': '#271737',
  'popover-foreground': '#271737',
  'secondary-foreground': '#271737',
  'accent-foreground': '#271737',
  'muted-foreground': '#594e69',
  'subtle-foreground': '#594e69',
  primary: '#4b1d8c',
  'primary-hover': '#35136a',
  'primary-foreground': '#ffffff',
  destructive: '#b42318',
  'destructive-foreground': '#ffffff',
  negative: '#271737',
  spend: '#594e69',
  earn: '#2a6e33',
  star: '#ffc938',
  // V1: brand orange, decorative only (progress fills, accents). 2.87:1 on
  // white, so never text, a border that marks state, or a focus ring
  // (tokens.test.js asserts it stays below 3:1 and check is by review).
  sunrise: '#ff6a00',
  selected: '#e5dcea',
  'selected-border': '#4b1d8c',
  warning: '#fff1d1',
  'warning-border': '#b7791f',
  'warning-foreground': '#271737',
  'brand-ink': '#4b1d8c',
  border: '#e5dcea',
  input: '#857a96',
  ring: '#4b1d8c',
  overlay: '#271737',
  'earn-soft': '#e3f2e5',
  'star-soft': '#fff1d1',
  // One colour per child (identity): sky, berry, teal, ochre, cocoa, slate.
  // Strong: band, bar, ring, selected edge. Soft: avatar fill, selected fill.
  // No green (it means "earned"), nothing near the brand purple, nothing
  // near ink (E02: kid-4 moved from plum to ochre).
  'kid-1': '#1f6fb2', 'kid-1-soft': '#dcebf8',
  'kid-2': '#c0265e', 'kid-2-soft': '#fbe1ea',
  'kid-3': '#0e7a7e', 'kid-3-soft': '#d3efef',
  'kid-4': '#8a6b0f', 'kid-4-soft': '#eeebd5',
  'kid-5': '#7a4b2a', 'kid-5-soft': '#f1e4d8',
  'kid-6': '#4a5a6a', 'kid-6-soft': '#e2e7ec',
  'chart-1': '#2a6e33',
  'chart-2': '#4b1d8c',
  'chart-4': '#594e69',
};

// Confetti uses the celebration colours only.
export const CONFETTI_COLORS = [TOKENS.primary, TOKENS.star, TOKENS.earn, TOKENS['kid-1']];
