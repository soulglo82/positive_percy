/** @type {import('tailwindcss').Config} */
// Batch D: colours, type sizes, weights, radii and shadows are REPLACED (not
// extended) with token-backed values, so anything off-scale doesn't exist.
// scripts/check-tokens.mjs fails the tests if a class that doesn't exist is used.
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  // No dark theme. Kept as "class" so nothing follows the OS setting; no
  // .dark rule exists (a test checks).
  darkMode: ["class"],
  // hover: styles only where a real pointer can hover, so a tapped button
  // doesn't keep its hover look on a phone.
  future: { hoverOnlyWhenSupported: true },
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
      earn: { DEFAULT: c('earn'), soft: c('earn-soft') },
      star: { DEFAULT: c('star'), soft: c('star-soft') },
      sunrise: c('sunrise'),
      // V1-F section 10: the Custom points button. warm-ink is the border and icon (3:1 or more on warm-soft and on card).
      warm: { soft: c('warm-soft'), ink: c('warm-ink') },
      kid: Object.fromEntries([1, 2, 3, 4, 5, 6].flatMap((n) => [[String(n), c(`kid-${n}`)], [`${n}-soft`, c(`kid-${n}-soft`)]])),
      selected: { DEFAULT: c('selected'), border: c('selected-border') },
      warning: { DEFAULT: c('warning'), border: c('warning-border'), foreground: c('warning-foreground') },
      'brand-ink': c('brand-ink'),
      border: c('border'),
      input: c('input'),
      ring: c('ring'),
      // Dialog backdrop: ink at 60%. Fixed alpha, set here so no call site
      // needs an opacity modifier.
      overlay: 'hsl(var(--overlay) / 0.6)',
      chart: { 1: c('chart-1'), 2: c('chart-2'), 4: c('chart-4') },
    },
    fontFamily: {
      sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      display: ['Nunito', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
      // E02: 700/800 exist only for Nunito (font-display). Poppins ships 400-600;
      // src/test/brandAssets.test.js fails bold/extrabold without font-display.
      bold: '700',
      extrabold: '800',
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
    // The whole list, smallest first, not an extension: Tailwind writes the
    // rules in this order, and an added screen is written after the built-in
    // ones, so `phone:` (375px) would beat `sm:` (640px) on wide screens
    // (code review of V1-F section 10; e2e/ui.spec.js measures the tiles).
    screens: {
      // Narrow phones: below 360px some grids drop to 3 columns.
      xs: '360px',
      // V1-F section 10: from here a behaviour tile is one row (icon, name, +N).
      phone: '375px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      touch: { raw: '(pointer: coarse)' },
      // V1-F section 11: a window too short to keep a pop-up's footer fixed
      // (a phone on its side, or with the keyboard open on Android).
      short: { raw: '(max-height: 419px)' },
    },
    extend: {
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
