// @vitest-environment node
// Batch D: the design tokens are the only source of colour, size and type.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { check } from '../../scripts/check-tokens.mjs';
import { TOKENS, CONFETTI_COLORS } from '../lib/tokens.js';
import { buildManifest, transformHtml, THEME_COLOR, BACKGROUND_COLOR } from '../../scripts/vite-tokens-plugin.js';

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures', 'tokens');

describe('token check', () => {
  it('passes on the app (run as the CLI, the way CI and npm test see it)', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-tokens.mjs')], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout + r.stderr).toMatch(/Tokens OK/);
    expect(r.status).toBe(0);
  }, 60000);

  // Each fixture must fail for its own reason, not just fail.
  const EXPECT = {
    'palette.jsx': /raw palette/, 'white.jsx': /raw palette/, 'gradient.jsx': /gradient/, 'clip.jsx': /gradient/,
    'offscale.jsx': /not in the token scale/, 'offscale-radius.jsx': /not in the token scale/,
    'offscale-shadow.jsx': /not in the token scale/, 'offscale-weight.jsx': /not in the token scale/,
    'bad-variant.jsx': /not in the token scale/, 'arbitrary.jsx': /arbitrary value/,
    'arbitrary-template.jsx': /template literal/, 'hex.jsx': /hex colour/, 'hex4.jsx': /hex colour/,
    'rgb.jsx': /colour function/, 'hsl-raw.jsx': /colour function/, 'oklch.jsx': /colour function/,
    'lab.jsx': /colour function/, 'hwb.jsx': /colour function/, 'color-mix.jsx': /colour function/,
    'style-font.jsx': /style key fontSize/, 'style-custom-prop.jsx': /custom property/,
    'style-named.jsx': /style key fill/, 'style-hotpink.jsx': /style key fill/,
    'style-font-shorthand.jsx': /style key font/, 'style-outline.jsx': /style key outline/,
    'style-by-name.jsx': /fontSize in an object|passed by name/,
    'uppercase.jsx': /sentence case/, 'tracking.jsx': /sentence case/, 'italic.jsx': /sentence case/,
    'opacity-text.jsx': /opacity modifier/, 'opacity-util.jsx': /no opacity/, 'opacity-arbitrary.jsx': /no opacity/,
    'text-opacity.jsx': /no opacity/, 'bg-opacity.jsx': /no opacity/,
    'arbitrary-property.jsx': /arbitrary property/,
    'button-height.jsx': /own height/, 'button-height-arrow.jsx': /own height/, 'button-size.jsx': /own height/,
    'toast-bang.jsx': /ends in "!"/, 'multiline.jsx': /text-2xl is not in the token scale/,
    'allow-in-text.jsx': /text-2xl is not in the token scale/,
    'svg-fill.jsx': /fill="hotpink"/, 'icon-color.jsx': /color="hotpink"/, 'icon-size.jsx': /size prop/,
    'dynamic-class.jsx': /built from a variable/, 'plus-variant.jsx': /not in the token scale/,
    'colour-outside-root.css': /colour value/, 'dark.css': /\.dark rule/,
    'css-font-size.css': /css font-size/, 'css-named-colour.css': /css color/, 'css-uppercase.css': /css text-transform/,
  };
  const bad = fs.readdirSync(FIXTURES).filter((f) => f !== 'clean.jsx');

  it('every fixture has an expected rule', () => {
    expect(bad.filter((f) => !EXPECT[f])).toEqual([]);
  });

  it.each(bad)('flags the fixture %s for its own reason', async (file) => {
    const problems = await check([path.join(FIXTURES, file)]);
    expect(problems.join('\n')).toMatch(EXPECT[file]);
  }, 60000);

  it('passes the clean fixture, including a tokens-allow exception', async () => {
    expect(await check([path.join(FIXTURES, 'clean.jsx')])).toEqual([]);
  }, 60000);
});

// ---- colour maths (WCAG 2.x) ----
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}
function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [luminance(hexToRgb(TOKENS[a] || a)), luminance(hexToRgb(TOKENS[b] || b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('index.css matches tokens.js', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  const vars = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)]
    .map((m) => [m[1], hslToRgb(+m[2], +m[3], +m[4])]));

  it.each(Object.keys(TOKENS))('--%s', (name) => {
    expect(vars[name], `--${name} missing from index.css`).toBeDefined();
    const want = hexToRgb(TOKENS[name]);
    vars[name].forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(1));
  });

  it('every colour tailwind.config.js maps is defined in :root', () => {
    const cfg = fs.readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8');
    const used = [...cfg.matchAll(/c\('([\w-]+)'\)|var\(--([\w-]+)\)/g)].map((m) => m[1] || m[2]).filter((v) => v !== 'radius' && !v.startsWith('radix'));
    for (const v of used) expect(vars[v], `--${v}`).toBeDefined();
  });

  it('has no dark theme rule', () => {
    expect(css).not.toMatch(/\.dark\b/);
  });
});

describe('contrast of declared pairs', () => {
  // Text: 4.5:1.
  const text = [
    ['foreground', ['background', 'card', 'muted', 'accent', 'selected', 'warning']],
    ['muted-foreground', ['background', 'card', 'muted', 'accent', 'selected', 'warning']],
    ['subtle-foreground', ['background', 'card', 'muted', 'accent']],
    ['primary', ['card', 'background']],
    ['primary-foreground', ['primary', 'primary-hover']],
    ['destructive-foreground', ['destructive']],
    ['destructive', ['card', 'background', 'muted', 'accent', 'warning']],
    ['earn', ['card', 'background', 'muted', 'accent', 'warning']],
    ['brand-ink', ['card', 'background']],
    ['warning-foreground', ['warning']],
  ];
  for (const [fg, bgs] of text) {
    for (const bg of bgs) {
      it(`${fg} on ${bg} >= 4.5`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
    }
  }

  // Graphics and boundaries: 3:1.
  const graphics = [
    ['input', ['card', 'background', 'muted']],
    ['ring', ['card', 'background']],
    ['selected-border', ['card', 'selected']],
    ['warning-border', ['card', 'warning']],
    ['earn', ['muted']],
    ['chart-1', ['card']], ['chart-2', ['card']], ['chart-4', ['card']], ['chart-5', ['card']],
  ];
  for (const [fg, bgs] of graphics) {
    for (const bg of bgs) {
      it(`${fg} on ${bg} >= 3`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
    }
  }

  it('star is decoration only: it never meets text contrast, so it must never be text', () => {
    // Documented, not a pass: chart-3 and --star sit at about 2.2:1 on white.
    // Every chart series carries a direct label, and points always show the number.
    expect(ratio('star', 'card')).toBeLessThan(3);
  });
});

describe('generated values', () => {
  it('confetti uses token colours only', () => {
    for (const c of CONFETTI_COLORS) expect(Object.values(TOKENS)).toContain(c);
  });

  it('manifest gets theme and background colours from tokens', () => {
    const m = buildManifest(ROOT);
    expect(m.theme_color).toBe(TOKENS.primary);
    expect(m.background_color).toBe(TOKENS.background);
    expect(m.$comment).toBeUndefined();
    expect(THEME_COLOR).toBe(TOKENS.primary);
    expect(BACKGROUND_COLOR).toBe(TOKENS.background);
  });

  it('index.html theme-color meta is filled from tokens', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('%THEME_COLOR%');
    expect(transformHtml(html)).toContain(`<meta name="theme-color" content="${TOKENS.primary}" />`);
  });
});
