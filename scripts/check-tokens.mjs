#!/usr/bin/env node
// Batch D token check. Every colour, size, font, weight, radius and shadow the
// user sees must come from the tokens in tailwind.config.js / index.css.
//
// Usage: node scripts/check-tokens.mjs [file ...]
//   No arguments: scans the app (src/**, index.html, tailwind.config.js,
//   manifest.base.json). With arguments: scans only those files (the tests use
//   this on fixtures). Exit 1 and one line per problem when anything fails.
//
// Exceptions: a comment on the same line, `// tokens-allow: <reason>` or
// `/* tokens-allow: <reason> */` (JSX: `{/* tokens-allow: <reason> */}`).
// Not scanned: src/test/** and *.test.* files (they never render in the app).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PALETTE = 'slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const COLOR_FAMILIES = 'text|bg|border|border-[trblxy]|ring|ring-offset|outline|from|via|to|fill|stroke|divide|decoration|placeholder|shadow|accent|caret';
// Utilities whose values must exist in the token scale.
const GOVERNED = /^-?(text-|bg-|border|ring|outline-|from-|via-|to-|shadow|rounded|font-|fill-|stroke-|divide-|placeholder-|decoration-|accent-|caret-|leading-|tracking-)/;
const SINGLE_WORD = new Set(['flex', 'grid', 'block', 'hidden', 'inline', 'underline', 'truncate', 'border', 'shadow', 'rounded', 'ring', 'relative', 'absolute', 'fixed', 'sticky', 'static', 'visible', 'invisible', 'contents', 'table', 'italic', 'uppercase', 'transform', 'grow', 'shrink', 'outline']);
// Style keys (JS) that set type or colour.
const STYLE_KEYS = /\b(fontSize|fontFamily|fontWeight|fontStyle|font|lineHeight|letterSpacing|textTransform|color|background|backgroundColor|borderColor|outline|outlineColor|boxShadow|textShadow|fill|stroke|opacity)\s*:/;
const TYPE_KEYS_ANYWHERE = /\b(fontSize|fontFamily|fontWeight|lineHeight|letterSpacing|textTransform)\s*:/g;
// CSS properties that set type or colour, outside the :root block and @font-face.
const CSS_PROPS = /(^|[;{\s])(color|background|background-color|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|font|font-size|font-family|font-weight|font-style|line-height|letter-spacing|text-transform)\s*:\s*([^;}]+)/i;
const CSS_OK_VALUE = /^\s*(inherit|initial|unset|currentcolor|transparent|none|0|var\(--[\w-]+\)|hsl\(var\(--[\w-]+\)(\s*\/\s*[\d.]+)?\)|2px solid hsl\(var\(--ring\)\))\s*(!important)?\s*$/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function appFiles() {
  const src = walk(path.join(ROOT, 'src')).filter((f) =>
    /\.(jsx?|tsx?|css)$/.test(f) &&
    !f.includes(`${path.sep}test${path.sep}`) &&
    !/\.test\.[jt]sx?$/.test(f));
  return [...src, 'index.html', 'tailwind.config.js', 'manifest.base.json']
    .map((f) => path.resolve(ROOT, f))
    .filter((f) => fs.existsSync(f));
}

// String literals (single, double, template), plus JSX attribute strings,
// which may span lines.
function strings(text) {
  const out = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  let m;
  while ((m = re.exec(text))) out.push({ value: m[0].slice(1, -1), raw: m[0], index: m.index });
  const attr = /\b[\w-]+=("|')([^"']*\n[^"']*)\1/g;
  while ((m = attr.exec(text))) out.push({ value: m[2], raw: m[1] + m[2] + m[1], index: m.index });
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Split "hover:sm:bg-x" into variants and the utility, ignoring ':' inside [].
function splitVariants(token) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of token) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ':' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  const utility = parts.pop().replace(/^!/, '');
  return { variants: parts, utility };
}

function classCandidates(value) {
  return value.split(/[\s'"`{}]+/).filter((t) =>
    t && /^[!\w:\-\[\]\/.%#(),=&>*@'+~]+$/.test(t) && !t.includes('${'));
}

// JSX opening tags, read with quotes and braces balanced (an arrow `=>` in a
// prop does not end the tag).
function jsxTags(text, namePattern) {
  const out = [];
  const re = new RegExp(`<(${namePattern})(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length, depth = 0, quote = null;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
      if (depth > 0 && (ch === '"' || ch === "'" || ch === '`')) { quote = ch; continue; }
      if (depth === 0 && (ch === '"' || ch === "'")) { quote = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    out.push({ name: m[1], attrs: text.slice(m.index + m[0].length, i), index: m.index });
  }
  return out;
}

async function generatedClasses(candidates) {
  const postcss = require('postcss');
  const tailwind = require('tailwindcss');
  const loadConfig = require('tailwindcss/loadConfig');
  const config = loadConfig(path.join(ROOT, 'tailwind.config.js'));
  const result = await postcss([tailwind({ ...config, content: [{ raw: candidates.join(' ') }], safelist: [] })])
    .process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  const names = new Set();
  result.root.walkRules((rule) => {
    const re = /\.((?:\\.|[\w-])+)/g;
    let m;
    while ((m = re.exec(rule.selector))) names.add(m[1].replace(/\\(.)/g, '$1'));
  });
  return names;
}

function isDisabledVariant(variants) {
  return variants.some((v) => /disabled/.test(v));
}

export async function check(files) {
  const problems = [];
  const add = (file, line, msg) => problems.push(`${path.relative(ROOT, file)}:${line}: ${msg}`);
  const allCandidates = new Map(); // token -> [{file, line}]

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    // Only a comment with a reason counts, not the words anywhere on the line.
    const allowed = (ln) => /(\/\/|\/\*)\s*tokens-allow:\s*\S/.test(lines[ln - 1] || '');
    const isTokensJs = file.endsWith(path.join('src', 'lib', 'tokens.js'));
    const isCss = file.endsWith('.css');

    if (isCss) {
      let body = text;
      if (file.endsWith(path.join('src', 'index.css'))) {
        body = body.replace(/:root\s*\{[^}]*\}/, (m) => m.replace(/[^\n]/g, ' '));
      }
      body = body.replace(/@font-face\s*\{[^}]*\}/g, (m) => m.replace(/[^\n]/g, ' '));
      body.split('\n').forEach((l, i) => {
        if (allowed(i + 1)) return;
        const code = l.replace(/\/\*.*?\*\//g, '');
        if (/#[0-9a-fA-F]{3,8}\b/.test(code)) add(file, i + 1, 'colour value outside the :root token block');
        if (/\b(rgba?|hsla?)\((?!var\(--)/.test(code) || /\b(oklch|lab|hwb|color-mix)\(/.test(code)) add(file, i + 1, 'colour function outside the :root token block');
        if (/^\s*\.dark\b|\s\.dark\s*\{/.test(code)) add(file, i + 1, '.dark rule (there is no dark theme)');
        const prop = code.match(CSS_PROPS);
        if (prop && !CSS_OK_VALUE.test(prop[3])) add(file, i + 1, `css ${prop[2]}: ${prop[3].trim()} (use a token)`);
        const applied = code.match(/@apply\s+([^;]+);/);
        if (applied) for (const t of classCandidates(applied[1])) {
          if (!allCandidates.has(t)) allCandidates.set(t, []);
          allCandidates.get(t).push({ file, line: i + 1 });
        }
      });
      continue;
    }

    // Every JSX tag: style objects and colour props.
    for (const tag of jsxTags(text, '[A-Za-z][\\w.]*')) {
      const ln = lineOf(text, tag.index);
      if (allowed(ln)) continue;
      const style = tag.attrs.match(/\bstyle=\{([\s\S]*)\}/);
      if (style) {
        const body = style[1];
        const bad = body.match(STYLE_KEYS);
        if (bad) add(file, ln, `style key ${bad[1]} (use a token class)`);
        if (/['"]--[\w-]+['"]\s*:/.test(body)) add(file, ln, 'custom property set in a style object');
        if (/^\{?\s*[A-Za-z_$][\w$.]*\s*\}?$/.test(body.trim().split(/\}\s*\w+=/)[0].trim())) add(file, ln, 'style object passed by name (write it inline so it can be checked)');
      }
      const colourProp = tag.attrs.match(/\b(fill|stroke|color|stopColor)=("|')([^"']*)\2/);
      if (colourProp && !/^(currentColor|none|transparent|inherit)$/i.test(colourProp[3])) add(file, ln, `${colourProp[1]}="${colourProp[3]}" (use a token class)`);
      const sizeProp = tag.attrs.match(/\bsize=\{?\s*["']?\d+/);
      if (sizeProp && /^[A-Z]/.test(tag.name) && tag.name !== 'Logo') add(file, ln, `${tag.name} size prop (use w-/h- classes)`);
    }
    let tk;
    const isConfig = file.endsWith('tailwind.config.js'); // the token source itself
    const typeRe = new RegExp(TYPE_KEYS_ANYWHERE.source, 'g');
    while ((tk = typeRe.exec(text))) {
      const ln = lineOf(text, tk.index);
      if (!isConfig && !allowed(ln) && !/style=/.test(lines[ln - 1])) add(file, ln, `${tk[1]} in an object (type comes from tokens)`);
    }

    // Call-site sizes on sized controls (any height or size class).
    for (const tag of jsxTags(text, 'Button|Input|SelectTrigger|NumberInput')) {
      const ln = lineOf(text, tag.index);
      const cls = tag.attrs.match(/className=("[^"]*"|\{[\s\S]*\})/);
      if (cls && /(^|[\s"'`:])-?(?:h|size|min-h|max-h)-[\w.[\]/]+/.test(cls[1]) && !allowed(ln)) {
        add(file, ln, `${tag.name} with its own height (sizes come from the component)`);
      }
    }

    // Toasts ending in "!".
    const toastRe = /toast(?:\.\w+)?\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*?)!\1/g;
    let tm;
    while ((tm = toastRe.exec(text))) {
      const ln = lineOf(text, tm.index);
      if (!allowed(ln)) add(file, ln, 'toast message ends in "!"');
    }

    for (const s of strings(text)) {
      const ln = lineOf(text, s.index);
      if (allowed(ln)) continue;
      const v = s.value;
      if (!isTokensJs) {
        if (/(^|[\s'"(:,])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.test(v)) add(file, ln, `hex colour in "${v.slice(0, 40)}"`);
        if (/\b(rgba?|hsla?)\((?!var\(--)/.test(v) || /\b(oklch|lab|hwb|color-mix)\(/.test(v)) add(file, ln, `colour function in "${v.slice(0, 40)}"`);
      }
      if (s.raw.startsWith('`') && /-\[\$\{/.test(v)) add(file, ln, 'arbitrary value built in a template literal');
      if (s.raw.startsWith('`') && /(^|[\s:])(text|bg|border|ring|font|rounded|shadow|leading|tracking|from|via|to|fill|stroke)-\$\{/.test(v)) add(file, ln, 'class name built from a variable (write each class in full)');
      for (const tok of classCandidates(v)) {
        const { variants, utility } = splitVariants(tok);
        if (new RegExp(`^-?(?:${COLOR_FAMILIES})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?$`).test(utility)) {
          add(file, ln, `raw palette class ${tok}`);
          continue;
        }
        if (/^bg-gradient-|^bg-clip-text$/.test(utility)) { add(file, ln, `gradient class ${tok}`); continue; }
        if (/^(uppercase|italic)$/.test(utility) || /^tracking-/.test(utility)) { add(file, ln, `${tok} (sentence case, no italics, no tracking)`); continue; }
        if (/^\[[\w-]+:/.test(utility)) { add(file, ln, `arbitrary property ${tok}`); continue; }
        if (GOVERNED.test(utility) && /-\[/.test(utility)) { add(file, ln, `arbitrary value ${tok}`); continue; }
        if (/^(text|bg|border|ring|divide|placeholder)-opacity-/.test(utility) && !isDisabledVariant(variants)) { add(file, ln, `${tok} (no opacity on content)`); continue; }
        if (/^opacity-/.test(utility) && !isDisabledVariant(variants)) { add(file, ln, `${tok} (no opacity on content; disabled states only)`); continue; }
        if (GOVERNED.test(utility) && /\/[\d.[\]]+$/.test(utility) && !isDisabledVariant(variants)) { add(file, ln, `opacity modifier ${tok}`); continue; }
        // Governed utilities, and anything with a variant (a variant Tailwind
        // can't build, like min-[360px] beside a raw screen, makes nothing).
        const hasVariant = variants.length > 0 && variants.every((vv) => /^[a-z@\[!&*-]/.test(vv)) && !tok.includes('//') &&
          (/^-?[a-z\[][\w\[\]./%-]*-[\w\[\]./%-]+$/.test(utility) || SINGLE_WORD.has(utility));
        if (GOVERNED.test(utility) || hasVariant) {
          if (!allCandidates.has(tok)) allCandidates.set(tok, []);
          allCandidates.get(tok).push({ file, line: ln });
        }
      }
    }
  }

  // Unknown classes: governed utilities Tailwind can't generate with our config.
  if (allCandidates.size) {
    const names = await generatedClasses([...allCandidates.keys()]);
    for (const [tok, where] of allCandidates) {
      if (!names.has(tok)) for (const w of where) add(w.file, w.line, `class ${tok} is not in the token scale`);
    }
  }
  return [...new Set(problems)];
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const files = args.length ? args.map((f) => path.resolve(f)) : appFiles();
  const problems = await check(files);
  if (problems.length) {
    console.log(problems.join('\n'));
    console.log(`\n${problems.length} token problem(s).`);
    process.exit(1);
  }
  console.log(`Tokens OK (${files.length} files).`);
}
