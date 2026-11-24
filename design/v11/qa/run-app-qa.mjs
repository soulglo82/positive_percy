#!/usr/bin/env node
// V1.1 QA on the REAL React app (Home and Children), run against a LOCAL server
// with fictional seeded families. Never points at production.
//
//   npm run build
//   DATABASE_URL=postgres://... JWT_SECRET=... PORT=3301 node server/index.js &
//   node design/v11/qa/run-app-qa.mjs http://localhost:3301
//
// Writes design/v11/evidence/app/*.png and design/v11/evidence/app-qa-report.json.
// Exit 1 if any check fails. The type-size and overflow checks are the same
// as run-qa.mjs (design prototype); the V1 header and tab bar around the page
// are V1 chrome, not part of this redesign, so checks look inside .pv only,
// except page overflow, which covers the whole page.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed-family.mjs';

const BASE = process.argv[2] || 'http://localhost:3301';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('run-app-qa only runs against a local server');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'design/v11/evidence/app');
mkdirSync(out, { recursive: true });
const WIDTHS = [[320, 568], [359, 740], [360, 740], [390, 844], [834, 1194], [1280, 800]];
const results = [];
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); if (!pass) console.log(`FAIL  ${name}  ${detail}`); };

// Shared with run-qa.mjs in substance; scoped to the V1.1 page.
// V1 RewardTile (Rewards tab component, reused unchanged in Children's treats)
// is not part of this redesign; its 12px tag is reported separately.
function inspect() {
  const scope = document.querySelector('.pv') || document.body;
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const label = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
  const v1Tile = (el) => el.closest('.rounded-lg.border.bg-card');
  const all = [...scope.querySelectorAll('*')].filter(visible);
  const smallText = [], v1Small = [], offscreen = [], clipped = [], smallTargets = [], stacked = [], mirrored = [];
  for (const el of all) {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && !el.closest('svg') && !el.closest('.sr-only')) {
      const size = parseFloat(s.fontSize);
      if (size < 13.99) (v1Tile(el) ? v1Small : smallText).push(`${label(el)} ${size}px`);
      if (s.display !== 'inline' && el.textContent.trim().length > 3 && el.clientWidth > 0 && el.clientWidth < size * 1.6) stacked.push(`${label(el)} ${el.clientWidth}px wide`);
      if (s.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('pv-selector__name')) clipped.push(label(el));
    }
    if (!el.closest('.pv-selector') && !el.closest('.pv-scene__art') && !el.closest('.sr-only') && (r.right > vw + 0.5 || r.left < -0.5)) offscreen.push(`${label(el)} ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
    if (el.matches('button, a[href], input:not([type=hidden]):not([type=file])')) {
      // A stretched label (.pv-stretch) is hit through its ::after, which must
      // really cover the card; then the card's box is the target.
      let t = r;
      if (el.classList.contains('pv-stretch')) {
        const after = getComputedStyle(el, '::after');
        const card = el.closest('.pv-manage-action');
        if (after.position === 'absolute' && after.content !== 'none' && card) t = card.getBoundingClientRect();
      }
      if (t.width < 43.5 || t.height < 43.5) smallTargets.push(`${label(el)} ${Math.round(t.width)}x${Math.round(t.height)}`);
    }
    if (el.closest('.pv-fox')) { const t = s.transform; if (t && t !== 'none' && parseFloat(t.split('(')[1]) < 0) mirrored.push(label(el)); }
  }
  return { pageOverflow: document.documentElement.scrollWidth - window.innerWidth, smallText, v1Small, offscreen, clipped, smallTargets, stacked, mirrored };
}

const browser = await chromium.launch();
const errors = [];
async function open(fam, w, h, dsf = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, reducedMotion: 'reduce' });
  await ctx.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code); localStorage.setItem('positive_percy_token', token); localStorage.setItem('percy_onboarding_done', 'true');
  }, [fam.code, fam.token]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return page;
}
async function go(page, path) { await page.goto(BASE + path); await page.waitForLoadState('networkidle'); await page.locator('.pv').first().waitFor(); await page.waitForTimeout(300); }
async function full(page, file, w, h) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: w, height: Math.max(h, H) }); await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, file) }); await page.setViewportSize({ width: w, height: h });
}
async function check(page, name, { axe = false } = {}) {
  const r = await page.evaluate(inspect);
  record(`${name}: no horizontal page overflow`, r.pageOverflow <= 0, `${r.pageOverflow}px`);
  record(`${name}: nothing outside the viewport`, r.offscreen.length === 0, r.offscreen.slice(0, 3).join(' | '));
  record(`${name}: no V1.1 text under 14px`, r.smallText.length === 0, r.smallText.slice(0, 3).join(' | '));
  record(`${name}: no clipped text`, r.clipped.length === 0, r.clipped.slice(0, 3).join(' | '));
  record(`${name}: no word squeezed into a column of letters`, r.stacked.length === 0, r.stacked.slice(0, 3).join(' | '));
  record(`${name}: touch targets at least 44px`, r.smallTargets.length === 0, r.smallTargets.slice(0, 3).join(' | '));
  record(`${name}: fox never mirrored`, r.mirrored.length === 0);
  if (axe) {
    const res = await new AxeBuilder({ page }).include('.pv').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    record(`${name}: axe WCAG 2.1 A and AA`, res.violations.length === 0, res.violations.map((v) => `${v.id} x${v.nodes.length}`).join(', '));
  }
  return r;
}

const fam = await seed(BASE, 'full');
const six = await seed(BASE, 'six');
const empty = await seed(BASE, 'empty');
const manyGoals = await seed(BASE, 'many-goals');
const v1Small = new Set();

// 1. Six widths, both screens, with screenshots and axe.
for (const [w, h] of WIDTHS) for (const [view, path] of [['home', '/'], ['children', '/Children']]) {
  const page = await open(fam, w, h);
  await go(page, path);
  const r = await check(page, `${view} ${w}`, { axe: true });
  r.v1Small.forEach((x) => v1Small.add(x.replace(/ \d+(\.\d+)?px$/, '')));
  await full(page, `${view}-${w}.png`, w, h);
  await page.context().close();
}
for (const [w, h] of [[390, 844], [1280, 800]]) for (const [view, path] of [['home', '/'], ['children', '/Children']]) {
  const page = await open(fam, w, h, 2); await go(page, path); await full(page, `${view}-${w}@2x.png`, w, h); await page.context().close();
}

// 2. Edge families: six children with a long name (selected), one child with nothing set up.
const longId = six.children[3].id;
for (const [famX, label, q] of [[six, 'six children, long name selected', `?child=${longId}`], [empty, 'one child, nothing set up', '']]) {
  for (const [w, h] of [[320, 568], [390, 844], [1280, 800]]) for (const [view, path] of [['home', '/'], ['children', '/Children' + q]]) {
    const page = await open(famX, w, h);
    await go(page, path);
    if (view === 'home' && q) { await page.locator(`.pv-selector__item[title="${six.children[3].name}"]`).click(); await page.waitForTimeout(200); }
    await check(page, `${view} ${w} (${label})`, { axe: w === 390 });
    if (w === 320) await full(page, `edge-${view}-${w}-${famX === six ? 'six' : 'empty'}.png`, w, h);
    await page.context().close();
  }
}

// 2b. Twenty goals today (Codex review of PR #72): the progress dots wrap.
for (const pct of [100, 200]) {
  const page = await open(manyGoals, 320, 568);
  await go(page, '/');
  if (pct !== 100) { await page.addStyleTag({ content: `html{font-size:${pct}%}` }); await page.waitForTimeout(200); }
  const r = await page.evaluate(inspect);
  record(`home 320 at ${pct}% text, 20 goals today: no horizontal page overflow`, r.pageOverflow <= 0, `${r.pageOverflow}px`);
  record(`home 320 at ${pct}% text, 20 goals today: nothing outside the viewport`, r.offscreen.length === 0, r.offscreen.slice(0, 3).join(' | '));
  await page.context().close();
}

// 3. Larger text: the root size raised as a browser text setting does.
for (const pct of [150, 200]) for (const [w, h] of [[320, 568], [390, 844]]) for (const [view, path] of [['home', '/'], ['children', '/Children']]) {
  const page = await open(six, w, h);
  await go(page, path);
  await page.addStyleTag({ content: `html{font-size:${pct}%}` }); await page.waitForTimeout(200);
  const r = await page.evaluate(inspect);
  record(`${view} ${w} at ${pct}% text: no horizontal page overflow`, r.pageOverflow <= 0, `${r.pageOverflow}px`);
  record(`${view} ${w} at ${pct}% text: nothing outside the viewport`, r.offscreen.length === 0, r.offscreen.slice(0, 3).join(' | '));
  record(`${view} ${w} at ${pct}% text: no clipped text`, r.clipped.length === 0, r.clipped.slice(0, 3).join(' | '));
  record(`${view} ${w} at ${pct}% text: no word squeezed into a column of letters`, r.stacked.length === 0, r.stacked.slice(0, 3).join(' | '));
  if (pct === 200 && w === 320) await full(page, `text-200-${view}-${w}.png`, w, h);
  await page.context().close();
}

// 4. Real interactions through the real server (V1 behaviour preserved).
{
  const page = await open(fam, 390, 844);
  await go(page, '/');
  const bal = async () => Number(await page.locator('[data-available]').first().textContent());
  const b0 = await bal();
  const tile = page.locator('.pv-quick-tile').first();
  const tileName = await tile.getAttribute('aria-label');
  record('quick point tile is named "<behaviour> +N for <child>"', /^.+ \+\d+ for Lara$/.test(tileName), tileName);
  await tile.click();
  await page.waitForFunction((b) => Number(document.querySelector('[data-available]').textContent) > b, b0, { timeout: 10000 }).catch(() => {});
  const b1 = await bal();
  record('quick point raises the balance by the server amount', b1 === b0 + 1, `${b0} -> ${b1}`);
  const undo = page.getByRole('button', { name: 'Undo' }).last();
  record('the award toast offers Undo', await undo.isVisible());
  await undo.click();
  await page.waitForFunction((b) => Number(document.querySelector('[data-available]').textContent) === b, b0, { timeout: 10000 }).catch(() => {});
  record('Undo restores the balance on the server', (await bal()) === b0, `${await bal()}`);
  const complete = page.getByRole('button', { name: /^Complete / }).first();
  const goalName = (await complete.getAttribute('aria-label')).replace(/^Complete /, '');
  await complete.click();
  const doneMark = page.locator('.pv-goal', { hasText: goalName }).getByText('Done');
  await doneMark.waitFor({ timeout: 10000 }).catch(() => {});
  record('completing a goal shows Done and moves focus to it', await doneMark.evaluate((el) => el === document.activeElement).catch(() => false));
  record('completing a goal adds its points', (await bal()) === b0 + 1, `${await bal()}`);
  // The newest toast is the goal's (the award's Undone toast may still show).
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await page.waitForTimeout(1500);
  record('goal Undo restores the balance', (await bal()) === b0, `${await bal()}`);
  record('Home has no progress rings (the balance is a number)', (await page.locator('.pv-ring').count()) === 0);
  await page.getByRole('button', { name: 'Omar' }).click();
  record('switching child changes the headline and balance', /Omar/.test(await page.locator('#home-title').textContent()));
  await page.getByRole('button', { name: 'Custom points' }).click();
  record('Custom points opens the Give Percy Points dialog', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rewards' }).click();
  record('Rewards opens the V1 rewards dialog for the child', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.context().close();
}
{
  const page = await open(fam, 390, 844);
  await go(page, '/Children');
  record('Children has no Quick Points tiles', (await page.locator('.pv-quick-tile').count()) === 0);
  record('Children has no goal completion controls', (await page.getByRole('button', { name: /^Complete / }).count()) === 0);
  const firstManage = await page.locator('.pv-manage').boundingBox();
  const journey = await page.locator('.pv-meadow').boundingBox();
  record('Manage actions come before the journey', firstManage.y < journey.y, `${Math.round(firstManage.y)} < ${Math.round(journey.y)}`);
  const bar = page.getByRole('progressbar', { name: 'Weekly target' });
  record('the week ring is the Weekly target progressbar', (await bar.count()) === 1);
  const vn = Number(await bar.getAttribute('aria-valuenow')), vm = Number(await bar.getAttribute('aria-valuemax'));
  record('week ring valuenow never exceeds valuemax', vn <= vm, `${vn}/${vm}`);
  const figure = await page.locator('.pv-stop', { hasText: 'This week' }).locator('.pv-stop__figure').textContent();
  record('the week figure is shown unclamped from the server (35 of 30 for the sample)', figure.replace(/\s+/g, ' ').trim() === '35 of 30 points', figure);
  const today = await page.locator('.pv-stop', { hasText: "Today's goals" }).locator('.pv-stop__figure').textContent();
  record("today's ring counts only goals scheduled today (1 of 3 for the sample)", today.replace(/\s+/g, ' ').trim() === '1 of 3 done', today);
  record('savings show the approved wording', await page.getByText('60 of 300 points saved').isVisible());
  await page.getByRole('button', { name: "Edit Lara's weekly target" }).click();
  record('Weekly target opens the V1 edit dialog', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit saving for something bigger for Lara' }).click();
  record('Savings opens the V1 savings dialog', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Manage all goals for Lara' }).click();
  record('Goals opens the V1 manage-goals dialog', await page.getByRole('dialog').isVisible());
  await page.context().close();
}
// 5. Controls: the checks must be able to fail.
{
  const page = await open(fam, 390, 844);
  await go(page, '/Children');
  // The labels are 44px themselves and stretched over the card; take both away.
  await page.addStyleTag({ content: '.pv-stretch::after{position:static} .pv-manage-action__label{min-height:0}' });
  const r = await page.evaluate(inspect);
  record('control: without their 44px height and stretched hit area the Manage labels fail the 44px check', r.smallTargets.some((x) => /pv-manage-action__label/.test(x)), `${r.smallTargets.length} small`);
  // The checker must flag 10px labels. Inject them and wait until they are
  // really 10px before checking (an injected style was once seen not to
  // apply in time; that is a harness failure and is reported as one).
  await go(page, '/');
  await page.addStyleTag({ content: '.pv-quick-tile__label{font-size:10px !important}' });
  const applied = await page.waitForFunction(() => {
    const l = [...document.querySelectorAll('.pv-quick-tile__label')];
    return l.length > 0 && l.every((x) => getComputedStyle(x).fontSize === '10px');
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  record('control harness: the injected 10px labels took effect', applied);
  const r2 = await page.evaluate(inspect);
  record('control: 10px Quick Point labels fail the type-size check', r2.smallText.some((x) => /pv-quick-tile__label/.test(x)), `${r2.smallText.length} small`);
  await page.context().close();
}
await browser.close();

record('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.pass);
const report = {
  version: '0.1.0', issued: new Date().toISOString().slice(0, 10), owner: 'Percy V1.1 design engineering',
  status: failed.length ? 'FAILING' : 'PASSING', base: 'local server, fictional seeded families',
  total: results.length, passed: results.length - failed.length, failed: failed.length,
  known_v1_component_text_under_14px: [...v1Small],
  results,
};
writeFileSync(join(root, 'design/v11/evidence/app-qa-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} checks passed`);
process.exit(failed.length ? 1 : 0);
