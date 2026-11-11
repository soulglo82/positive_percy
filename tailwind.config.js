/** @type {import('tailwindcss').Config} */
// Batch D: colours, type sizes, weights, radii and shadows are REPLACED (not
// extended) with token-backed values, so anything off-scale doesn't exist.
// scripts/check-tokens.mjs fails the tests if a class that doesn't exist is used.
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  // No dark theme. Kept as "class" so nothing follows the OS setting; no
  // .dark rule exists (a test checks).
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}", "!./src/test/**"],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      background: c('background'),
      foreground: c('foreground'),
      card: { DEFAULT: c('card'), foreground: c('card-foreground') },
      popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
      primary: { DEFAULT: c('primary'), foreground: c('primary-foreground'), hover: c('primary-hover') },
      secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
      muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
      subtle: { foreground: c('subtle-foreground') },
      accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
      destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
      negative: c('negative'),
      spend: c('spend'),
      earn: c('earn'),
      star: c('star'),
      selected: { DEFAULT: c('selected'), border: c('selected-border') },
      warning: { DEFAULT: c('warning'), border: c('warning-border'), foreground: c('warning-foreground') },
      'brand-ink': c('brand-ink'),
      border: c('border'),
      input: c('input'),
      ring: c('ring'),
      // Dialog backdrop: ink at 60%. Fixed alpha, set here so no call site
      // needs an opacity modifier.
      overlay: 'hsl(var(--overlay) / 0.6)',
      chart: { 1: c('chart-1'), 2: c('chart-2'), 3: c('chart-3'), 4: c('chart-4'), 5: c('chart-5') },
    },
    fontFamily: {
      sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      title: ['1.75rem', { lineHeight: '2.25rem' }],
      total: ['2rem', { lineHeight: '2.5rem' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '600',
      extrabold: '600',
    },
    borderRadius: {
      none: '0',
      sm: 'calc(var(--radius) - 8px)',
      md: 'calc(var(--radius) - 4px)',
      lg: 'var(--radius)',
      full: '9999px',
    },
    boxShadow: {
      DEFAULT: '0 1px 3px 0 hsl(var(--foreground) / 0.08), 0 1px 2px -1px hsl(var(--foreground) / 0.08)',
      none: 'none',
    },
    extend: {
      screens: {
        // Narrow phones: below 360px some grids drop to 3 columns.
        xs: '360px',
        touch: { raw: '(pointer: coarse)' },
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
