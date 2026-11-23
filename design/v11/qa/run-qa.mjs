#!/usr/bin/env node
// V1.1 design-foundation QA. Runs the built review pages in Chromium and checks
// layout, type size, touch targets, images, mirroring, accessibility (axe) and
// the prototype's interactions. Writes screenshots and a JSON report to
// design/v11/evidence/. Exit code 1 if any check fails.
//
//   node design/v11/build.mjs && node design/v11/qa/run-qa.mjs
//
// The checks are also run against the earlier PR #71 prototype as a control:
// that file has 10px action labels, so the type-size check MUST fail on it.
// If it passes there, the check is broken and this script exits 1.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const out = join(root, 'design/v11/evidence');
mkdirSync(join(out, 'after'), { recursive: true });
const url = (p) => pathToFileURL(join(root, p)).href;
const PROTO = url('design/v11/review/home-children.html');
const WIDTHS = [[320, 568], [359, 740], [360, 740], [390, 844], [834, 1194], [1280, 800]];
const results = [];
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); if (!pass) console.log(`FAIL  ${name}  ${detail}`); };

// Runs in the page. Returns lists of offending elements for each layout rule.
function inspect() {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[hidden]') && !el.closest('dialog:not([open])') && !el.closest('template'); };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
  const all = [...document.querySelectorAll('body *')].filter(visible);
  const smallText = [], offscreen = [], clipped = [], smallTargets = [], brokenImages = [], mirrored = [], stacked = [];
  for (const el of all) {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && !el.closest('svg')) {
      const size = parseFloat(s.fontSize);
      const metaOk = el.closest('.pv-nav__tab, .pv-t-meta, .pv-flag');
      if (size < (metaOk ? 12 : 14) - 0.01) smallText.push(`${label(el)} ${size}px`);
    }
    // A word broken into a column of single letters: the box is narrower than two characters.
    if (ownText && !el.closest('svg') && !el.closest('.pv-sr') && s.display !== 'inline' && el.textContent.trim().length > 3 && el.clientWidth > 0 && el.clientWidth < parseFloat(s.fontSize) * 1.6) stacked.push(`${label(el)} ${el.clientWidth}px wide`);
    const scroller = el.closest('.pv-selector');
    // Scene drawings are clipped by their scene (overflow hidden), so their own boxes may extend past it.
    if (!scroller && !el.closest('.pv-sr') && !el.closest('.pv-scene__art') && (r.right > vw + 0.5 || r.left < -0.5)) offscreen.push(`${label(el)} ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
    if (ownText && s.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('pv-selector__name') && !el.classList.contains('pv-sr')) clipped.push(label(el));
    if (el.matches('button, a[href], input:not([type=hidden]):not([type=file]), select') && !el.closest('.sg-toc') && (r.width < 43.5 || r.height < 43.5)) smallTargets.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0) brokenImages.push(el.getAttribute('src').slice(0, 40));
    if (el.closest('.pv-fox') || el.matches('img[src*="svg"]')) { const t = s.transform; if (t && t !== 'none') { const a = parseFloat(t.split('(')[1]); if (a < 0) mirrored.push(label(el)); } }
  }
  return { pageOverflow: document.documentElement.scrollWidth - window.innerWidth, smallText, offscreen, clipped, smallTargets, brokenImages, mirrored, stacked };
}

async function checkPage(page, name, { targets = true } = {}) {
  const r = await page.evaluate(inspect);
  record(`${name}: no horizontal page overflow`, r.pageOverflow <= 0, `${r.pageOverflow}px`);
  record(`${name}: nothing outside the viewport`, r.offscreen.length === 0, r.offscreen.slice(0, 4).join(' | '));
  record(`${name}: no text under 14px (12px for tab labels and overlines)`, r.smallText.length === 0, r.smallText.slice(0, 4).join(' | '));
  record(`${name}: no clipped text`, r.clipped.length === 0, r.clipped.slice(0, 4).join(' | '));
  record(`${name}: no word squeezed into a column of letters`, r.stacked.length === 0, r.stacked.slice(0, 4).join(' | '));
  if (targets) record(`${name}: touch targets at least 44px`, r.smallTargets.length === 0, r.smallTargets.slice(0, 4).join(' | '));
  record(`${name}: every image loaded or fell back`, r.brokenImages.length === 0, r.brokenImages.join(' | '));
  record(`${name}: fox never mirrored`, r.mirrored.length === 0, r.mirrored.join(' | '));
  return r;
}
async function axe(page, name) {
  const res = await new AxeBuilder({ page }).exclude('[data-contrast-demo]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  record(`${name}: axe WCAG 2.1 A and AA`, res.violations.length === 0, res.violations.map((v) => `${v.id} x${v.nodes.length}`).join(', '));
}
async function fullShot(page, file, w, h) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: w, height: Math.max(h, H) }); await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, 'after', file) });
  await page.setViewportSize({ width: w, height: h });
}

const browser = await chromium.launch();
const errors = [], requests = [];
async function open(w, h, dsf = 1, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, reducedMotion: 'reduce', ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/broken:|ERR_UNKNOWN_URL_SCHEME/.test(m.text())) errors.push(m.text()); });
  page.on('request', (q) => { if (!/^(file|data|blob|broken):/.test(q.url())) requests.push(q.url()); });
  return page;
}

// 1. Home and Children at six widths, default family, with screenshots.
for (const [w, h] of WIDTHS) {
  for (const view of ['home', 'children']) {
    const page = await open(w, h);
    await page.goto(`${PROTO}#${view}`); await page.waitForTimeout(250);
    await checkPage(page, `${view} ${w}`);
    await axe(page, `${view} ${w}`);
    await fullShot(page, `${view}-${w}.png`, w, h);
    await page.context().close();
  }
}
// Presentation screenshots at 2x.
for (const [w, h] of [[390, 844], [1280, 800]]) for (const view of ['home', 'children']) {
  const page = await open(w, h, 2); await page.goto(`${PROTO}#${view}`); await page.waitForTimeout(250);
  await fullShot(page, `${view}-${w}@2x.png`, w, h); await page.context().close();
}

// 2. Edge cases: 1 / 2 / 6 children, long names, no goals, zero target, 4-digit totals, failed photo.
const CASES = [['children=1', 'one child'], ['children=2', 'two children'], ['children=6&long=1', 'six children, long name'], ['children=3&child=c3', 'no goals, no target, no bigger goal'], ['children=6&child=c4', 'long goal, long reward, 4-digit totals'], ['children=6&child=c5', 'failed photo, zero points']];
for (const [q, label] of CASES) for (const [w, h] of [[320, 568], [390, 844], [1280, 800]]) for (const view of ['home', 'children']) {
  const page = await open(w, h);
  await page.goto(`${PROTO}?${q}#${view}`); await page.waitForTimeout(250);
  await checkPage(page, `${view} ${w} (${label})`);
  if (w === 320) await fullShot(page, `edge-${view}-${w}-${q.replace(/[^a-z0-9]+/g, '-')}.png`, w, h);
  await page.context().close();
}

// 3. Larger text settings: the root font size is raised, as a browser text-size setting does.
for (const pct of [125, 150, 200]) for (const [w, h] of [[320, 568], [390, 844]]) for (const view of ['home', 'children']) {
  const page = await open(w, h);
  await page.goto(`${PROTO}?children=6&long=1#${view}`);
  await page.addStyleTag({ content: `html{font-size:${pct}%}` }); await page.waitForTimeout(200);
  const r = await page.evaluate(inspect);
  record(`${view} ${w} at ${pct}% text: no horizontal page overflow`, r.pageOverflow <= 0, `${r.pageOverflow}px`);
  record(`${view} ${w} at ${pct}% text: nothing outside the viewport`, r.offscreen.length === 0, r.offscreen.slice(0, 3).join(' | '));
  record(`${view} ${w} at ${pct}% text: no clipped text`, r.clipped.length === 0, r.clipped.slice(0, 3).join(' | '));
  record(`${view} ${w} at ${pct}% text: no word squeezed into a column of letters`, r.stacked.length === 0, r.stacked.slice(0, 3).join(' | '));
  if (pct === 200 && w === 320) await fullShot(page, `text-200-${view}-${w}.png`, w, h);
  await page.context().close();
}

// 4. Interactions (synthetic state only).
{
  const page = await open(390, 844);
  await page.goto(`${PROTO}#home`); await page.waitForTimeout(200);
  const bal = async () => Number(await page.locator('#balance').textContent());
  const b0 = await bal();
  await page.locator('[data-quick="Kindness"]').click();
  record('quick point adds 1 to the balance', (await bal()) === b0 + 1, `${b0} -> ${await bal()}`);
  record('quick point shows a toast with Undo', await page.locator('#toast').isVisible());
  await page.locator('#toast-undo').click();
  record('undo restores the balance', (await bal()) === b0, `${await bal()}`);
  await page.locator('.pv-goal__check[data-goal-toggle="g3"]').click();
  record('completing a goal marks the row done', (await page.locator('.pv-goal[data-goal="g3"][data-done]').count()) === 1);
  record('completing a goal adds its points', (await bal()) === b0 + 1);
  record('goal count reads 3 of 3', /3 of 3 done/.test(await page.locator('#goals-title + p').textContent()));
  await page.locator('.pv-goal__undo[data-goal-toggle="g3"]').click();
  record('goal undo restores the balance', (await bal()) === b0);
  await page.locator('[data-select-child="c2"]').click();
  record('switching child changes the headline', /Omar/.test(await page.locator('#home-title').textContent()));
  record('switching child changes the balance', (await bal()) === 40);
  record('selected child is announced as pressed', (await page.locator('[data-select-child="c2"]').getAttribute('aria-pressed')) === 'true');
  await page.locator('a[href="#children"]').first().click(); await page.waitForTimeout(150);
  record('child selection carries over to Children', /Omar/.test(await page.locator('#child-title').textContent()));
  record('Children has no Quick Points tiles', (await page.locator('.pv-quick-tile').count()) === 0);
  record('Children has no goal completion controls', (await page.locator('.pv-goal__check').count()) === 0);
  await page.locator('[data-select-child="c1"]').click();
  const week = page.locator('.pv-ring[data-metric="week"]');
  record('week ring is full when over target', (await week.getAttribute('data-full')) !== null);
  record('over-target number is shown unclamped (34 of 30)', /34\s*of 30 points/.test((await page.locator('.pv-stop').nth(1).textContent()).replace(/\s+/g, ' ')));
  record('week arc offset is clamped at 0', (await week.locator('.pv-ring__value').getAttribute('stroke-dashoffset')) === '0.00');
  await page.locator('[data-edit-target]').click();
  await page.locator('#target-input').fill('50'); await page.locator('#target-dialog button[value="save"]').click(); await page.waitForTimeout(150);
  record('editing the weekly target updates the figure', /34\s*of 50 points/.test((await page.locator('.pv-stop').nth(1).textContent()).replace(/\s+/g, ' ')));
  await page.locator('[data-edit-target]').click(); await page.locator('#target-input').fill('0'); await page.locator('#target-dialog button[value="save"]').click(); await page.waitForTimeout(150);
  record('zero target draws the neutral ring, no fraction', (await page.locator('.pv-ring[data-metric="week"][data-empty]').count()) === 1 && !/of 0/.test(await page.locator('.pv-stop').nth(1).textContent()));
  await page.goto(`${PROTO}#home`); await page.waitForTimeout(150);
  record('Home has no progress rings (balance is a number)', (await page.locator('.pv-ring').count()) === 0);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-select-child]'));
  record('keyboard reaches the child selector', focused);
  await page.keyboard.press('Enter');
  record('Enter selects a child', /Omar/.test(await page.locator('#home-title').textContent()));
  const anim = await page.evaluate(() => { document.querySelector('[data-quick="Bravery"]').click(); return getComputedStyle(document.querySelector('#home-fox img')).animationName; });
  record('reduced motion: Percy does not animate', anim === 'none', anim);
  await page.context().close();
}

// 5. Showcase and Fox board.
for (const [file, name] of [['component-showcase.html', 'showcase'], ['fox1a-production-board.html', 'fox board']]) for (const [w, h] of [[320, 568], [390, 844], [1280, 800]]) {
  const page = await open(w, h);
  await page.goto(url(`design/v11/review/${file}`)); await page.waitForTimeout(300);
  await checkPage(page, `${name} ${w}`, { targets: false });
  if (w !== 320) await axe(page, `${name} ${w}`);
  if (w === 1280) await fullShot(page, `${name.replace(' ', '-')}-${w}.png`, w, h);
  await page.context().close();
}

record('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
record('no network requests (pages are self-contained)', requests.length === 0, requests.slice(0, 3).join(' | '));

// 6. Control: the PR #71 prototype must FAIL the type-size check (it has 10px labels).
{
  const page = await open(390, 844);
  await page.goto(url('design/previews/percy-v11-working-home-children.html')); await page.waitForTimeout(300);
  const r = await page.evaluate(inspect);
  record('control: type-size check fails on the PR #71 prototype', r.smallText.length > 0, `${r.smallText.length} elements under the limit, e.g. ${r.smallText[0] || 'none'}`);
  results[results.length - 1].control = { smallText: r.smallText.length, smallTargets: r.smallTargets.length };
  await page.context().close();
}
await browser.close();

const failed = results.filter((r) => !r.pass);
const report = { version: '0.1.0', issued: new Date().toISOString().slice(0, 10), owner: 'Percy V1.1 design engineering', status: failed.length ? 'FAILING' : 'PASSING', total: results.length, passed: results.length - failed.length, failed: failed.length, widths: WIDTHS.map((w) => w[0]), results };
writeFileSync(join(out, 'qa-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} checks passed`);
process.exit(failed.length ? 1 : 0);
