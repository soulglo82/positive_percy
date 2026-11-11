// The one JS copy of the design tokens (Batch D). index.css holds the same
// values as HSL channels; src/test/tokens.test.js checks the two match.
// Used where CSS variables can't reach: confetti, the manifest and the
// theme-color meta (written by the Vite plugin in vite.config.js).

export const TOKENS = {
  background: '#faf9f6',
  card: '#ffffff',
  popover: '#ffffff',
  muted: '#f3f1ec',
  secondary: '#f3f1ec',
  accent: '#e9e5dc',
  foreground: '#1f1b16',
  'card-foreground': '#1f1b16',
  'popover-foreground': '#1f1b16',
  'secondary-foreground': '#1f1b16',
  'accent-foreground': '#1f1b16',
  'muted-foreground': '#5e554a',
  'subtle-foreground': '#6b6257',
  primary: '#c2410c',
  'primary-hover': '#9a3412',
  'primary-foreground': '#ffffff',
  destructive: '#b42318',
  'destructive-foreground': '#ffffff',
  negative: '#1f1b16',
  spend: '#5e554a',
  earn: '#2a6e33',
  star: '#e8a317',
  selected: '#fde4d3',
  'selected-border': '#c2410c',
  warning: '#fff4e5',
  'warning-border': '#b7791f',
  'warning-foreground': '#1f1b16',
  'brand-ink': '#1e3a5f',
  border: '#e6e1d8',
  input: '#8a8073',
  ring: '#c2410c',
  overlay: '#1f1b16',
  'chart-1': '#2a6e33',
  'chart-2': '#1e3a5f',
  'chart-3': '#e8a317',
  'chart-4': '#5e554a',
  'chart-5': '#c2410c',
};

// Confetti uses the celebration colours only.
export const CONFETTI_COLORS = [TOKENS.primary, TOKENS.star, TOKENS.earn, TOKENS['brand-ink']];
