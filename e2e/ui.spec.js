// Batch D: every screen, dialog, select and the Undo toast, at four sizes.
// Asserts: axe finds nothing serious or critical; no horizontal scroll; no
// text under 12px; no control without a name; on touch screens every
// control is at least 44px (a control inside a 44px label counts as the label).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

async function checkScreen(page, label, testInfo) {
  await page.waitForTimeout(400);
  // With a Select open, Radix traps focus in the list and hides the rest, so
  // only the list is checked (axe otherwise reports the hidden page).
  const listbox = await page.locator('[role="listbox"]').count();
  const builder = new AxeBuilder({ page });
  if (listbox) builder.include('[role="listbox"]');
  const axe = await builder.analyze();
  const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `${label}: axe`).toEqual([]);

  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  // A touch project that stops emulating touch would skip the 44px check silently.
  expect(touch, `${label}: touch emulation`).toBe(testInfo.project.name.includes('touch'));

  const report = await page.evaluate((touch) => {
    const out = { scroll: [], small: [], tiny: [], unnamed: [] };
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      out.scroll.push(`page ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const visible = (el) => shown(el) && !el.closest('[aria-hidden="true"]');
    // Scope: an open list, else an open dialog (the page behind is inert), else the page.
    const scope = document.querySelector('[role="listbox"]') ||
      // A confirm opened over a dialog is on top: check it, not the dialog under it.
      document.querySelector('[role="alertdialog"][data-state="open"]') ||
      [...document.querySelectorAll('[role="dialog"][data-state="open"]')].pop() || document.body;
    // Anything inside that would scroll sideways (dialog bodies, lists).
    for (const el of scope.querySelectorAll('*')) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1 && shown(el)) {
        out.scroll.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      }
    }
    // 12px floor: all shown text, decoration included; form field text too.
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement || !shown(n.parentElement)) continue;
      if (n.parentElement.closest('.sr-only')) continue;
      const size = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (size < 12) out.tiny.push(`${size}px "${n.textContent.trim().slice(0, 30)}"`);
    }
    for (const el of scope.querySelectorAll('input, textarea, select')) {
      if (!shown(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) out.tiny.push(`${size}px <${el.tagName.toLowerCase()}>`);
    }
    const textOf = (id) => { const t = id && document.getElementById(id); return t ? t.textContent.trim() : ''; };
    const controls = scope.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"], [role="combobox"], [role="option"], [tabindex]:not([tabindex="-1"])');
    for (const el of controls) {
      if (!visible(el) || el.closest('.sr-only')) continue;
      const labelFor = el.id && document.querySelector(`label[for="${el.id}"]`);
      const name = (el.getAttribute('aria-label') || '').trim() ||
        (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(textOf).join(' ').trim() ||
        el.textContent.trim() || (el.getAttribute('title') || '').trim() ||
        (labelFor ? labelFor.textContent.trim() : '') ||
        (el.closest('label') ? el.closest('label').textContent.trim() : '');
      if (!name) out.unnamed.push(el.outerHTML.slice(0, 80));
      if (!touch) continue;
      // A control inside a label counts as the label (the whole row is the target).
      const box = (el.closest('label') || el).getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const h = Math.max(box.height, r.height);
      const w = Math.max(box.width, r.width);
      if (h < 43.5 || w < 43.5) out.small.push(`${Math.round(w)}x${Math.round(h)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${el.outerHTML.slice(0, 70)}`);
    }
    return out;
  }, touch);

  expect(report.scroll, `${label}: sideways scroll`).toEqual([]);
  expect(report.tiny, `${label}: text under 12px`).toEqual([]);
  expect(report.unnamed, `${label}: controls with no name`).toEqual([]);
  expect(report.small, `${label}: touch targets under 44px`).toEqual([]);
  // Kept as a file, so the CI artifact holds the screenshots.
  const file = testInfo.outputPath(`${label.replace(/[^\w]+/g, '-')}.png`);
  // Viewport only: a fullPage shot in Chromium drops the touch emulation
  // (pointer: coarse) for the rest of the test.
  await page.screenshot({ path: file });
  await testInfo.attach(label, { path: file, contentType: 'image/png' });
}

async function go(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

test('home, its dialogs and the Undo toast', async ({ page }, testInfo) => {
  await go(page, '/');
  await checkScreen(page, 'home', testInfo);

  await page.getByRole('button', { name: /^Add Points/ }).first().click();
  await checkScreen(page, 'add points', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Spend$/ }).first().click();
  await checkScreen(page, 'spend', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Edit Alexandra/ }).first().click();
  await checkScreen(page, 'edit child', testInfo);
  await page.getByRole('button', { name: 'Delete Child' }).click();
  await checkScreen(page, 'delete child', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: / for Sam$/ }).first().click();
  await page.getByRole('button', { name: 'Undo' }).first().waitFor();
  // The award made here pops that child's star (and only that one).
  await expect(page.locator('.star-pop')).toHaveCount(1);
  await checkScreen(page, 'undo toast', testInfo);
  await page.getByRole('button', { name: 'Undo' }).first().click();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await checkScreen(page, 'sign out', testInfo);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('child view', async ({ page }, testInfo) => {
  await go(page, '/childview');
  await checkScreen(page, 'child view', testInfo);
});

test('activity, with the log open and the child filter open', async ({ page }, testInfo) => {
  await go(page, '/activity');
  await checkScreen(page, 'activity', testInfo);
  await page.getByRole('button', { name: /Activity log/ }).click();
  await checkScreen(page, 'activity log', testInfo);
  await page.getByRole('combobox', { name: 'Child' }).click();
  await checkScreen(page, 'activity child select', testInfo);
  await closeDialog(page);
});

test('rewards and its dialogs', async ({ page }, testInfo) => {
  await go(page, '/rewards');
  await checkScreen(page, 'rewards', testInfo);
  await page.getByRole('button', { name: /New Reward/ }).click();
  await page.getByRole('button', { name: /Browse Reward Ideas/ }).click();
  await checkScreen(page, 'create reward with ideas', testInfo);
  // #34: with the long ideas list open, the title and the buttons stay on screen.
  await expect(page.getByRole('heading', { name: 'Create Reward' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Create Reward' })).toBeInViewport();
  await closeDialog(page);
  await page.getByRole('button', { name: /^Edit Screen time/ }).click();
  await checkScreen(page, 'edit reward', testInfo);
  await page.getByRole('button', { name: 'Delete Reward' }).click();
  await checkScreen(page, 'delete reward', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('settings, its selects and dialogs', async ({ page }, testInfo) => {
  await go(page, '/parentprofile');
  await checkScreen(page, 'settings', testInfo);

  await page.getByRole('combobox', { name: 'Timezone' }).click();
  await checkScreen(page, 'timezone select', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Kindness/ }).first().click();
  await page.getByRole('combobox').filter({ hasText: /children|only/ }).first().click();
  await checkScreen(page, 'behaviour assign select', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Kindness/ }).first().click();
  await page.getByRole('button', { name: /^Tidy room/ }).first().click();
  await page.getByRole('button', { name: /^Delete$/ }).first().click();
  await checkScreen(page, 'delete behaviour', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await page.getByRole('button', { name: /Add Category/ }).click();
  await checkScreen(page, 'new behaviour', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Add Child/ }).click();
  await checkScreen(page, 'add child', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /Parenting Tips/ }).click();
  await checkScreen(page, 'tips', testInfo);
  await closeDialog(page);
});

test('timezone: a refused save goes back to what is stored', async ({ page }) => {
  await page.route('**/api/family/timezone', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { timezone: null } });
    return route.fulfill({ status: 400, json: { error: 'Unknown timezone' } });
  });
  await go(page, '/parentprofile');
  const trigger = page.getByRole('combobox', { name: 'Timezone' });
  await expect(trigger).toHaveText(/Choose your timezone/);
  await trigger.click();
  await page.getByRole('option', { name: 'Europe/London' }).click();
  await expect(page.getByText('Unknown timezone')).toBeVisible();
  await expect(trigger).toHaveText(/Choose your timezone/);
});
