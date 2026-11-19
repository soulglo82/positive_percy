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
    // A test that checks first-run onboarding opts out for this tab.
    if (!sessionStorage.getItem('percy_e2e_show_onboarding')) localStorage.setItem('percy_onboarding_done', 'true');
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
  // V1 Home: family strip selects the child; Goals before the summary.
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  const sam = page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: /^Sam / });
  await sam.click();
  await expect(sam).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText("Sam's checklist")).toBeVisible();
  // Review of PR #57: the DOM (Tab and screen-reader) order is the reading
  // order Goals, Little wins, Working towards, Quick Points; on one-column
  // layouts it is also the visual order.
  const order = await page.evaluate(() => {
    const titles = ["Today's Goals", 'Little wins, big adventures!', "What you're working towards", 'Quick Points'];
    const hs = titles.map((t) => [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === t));
    if (hs.some((h) => !h)) return { missing: titles.filter((_, i) => !hs[i]) };
    const domOrdered = hs.every((h, i) => i === 0 || (hs[i - 1].compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING));
    const tops = hs.map((h) => h.getBoundingClientRect().top);
    return { domOrdered, visuallyOrdered: tops.every((t, i) => i === 0 || t > tops[i - 1]), oneColumn: window.innerWidth < 1024 };
  });
  expect(order.domOrdered).toBe(true);
  if (order.oneColumn) expect(order.visuallyOrdered).toBe(true);

  // V1-D (D5): a child's request shows in the parent's Rewards dialog; "Not this time" removes it.
  const headers = { Authorization: `Bearer ${family.token}` };
  const kids = await (await page.request.get('/api/children', { headers })).json();
  const samId = kids.find((k) => k.name === 'Sam').id;
  // A 1-point reward made for this check (Sam has only a few points), removed after.
  const cheap = await (await page.request.post('/api/rewards', { headers, data: { title: 'Sticker ' + testInfo.project.name, cost_points: 1, emoji: '⭐', visible_to_child: true } })).json();
  expect((await page.request.post(`/api/children/${samId}/stack/add`, { headers, data: { reward_id: cheap.id } })).status()).toBe(200);
  await go(page, '/');
  await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: /^Sam / }).click();
  await page.getByRole('button', { name: /^Rewards$/ }).last().click();
  const spend = page.getByRole('dialog');
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toBeVisible();
  await checkScreen(page, 'spend', testInfo);
  await expect(spend.locator('[data-requests-total]')).toHaveText(new RegExp(`^This will spend \\d+ points? from Sam's balance\\.$`));
  await spend.getByRole('button', { name: `Not this time: ${cheap.title}` }).click();
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toHaveCount(0);
  await closeDialog(page);
  await page.request.delete(`/api/rewards/${cheap.id}`, { headers });

  // V1-F: "Give Percy Points" - child, behaviour (its own points), note.
  await page.getByRole('button', { name: /^Award points/ }).first().click();
  const award = page.getByRole('dialog');
  await expect(award.getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
  await expect(award.getByText('What did Sam do?')).toBeVisible();
  await checkScreen(page, 'add points', testInfo);
  await award.getByRole('group', { name: /What did Sam do/ }).getByRole('button').first().click();
  await award.getByLabel('Add a note (optional)').fill('Shared the crayons');
  await award.getByRole('button', { name: /^Award \d+ points?$/ }).click();
  await expect(award).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  // The Undo really ran (its toast appears), then clears before the next taps.
  await expect(page.getByText(/^Undone\./)).toBeVisible();
  await expect(page.getByText(/^Undone\./)).toHaveCount(0, { timeout: 15000 });

  // V1-F: Manage goals list and the goal form.
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  const manage = page.getByRole('dialog');
  await expect(manage.getByRole('heading', { name: "Manage Sam's goals" })).toBeVisible();
  await checkScreen(page, 'manage goals', testInfo);
  await manage.getByRole('button', { name: 'Add goal' }).click();
  await expect(manage.getByRole('heading', { name: 'New goal' })).toBeVisible();
  await checkScreen(page, 'goal form', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /\+\d+ for Sam$/ }).first().click();
  await page.getByRole('button', { name: 'Undo' }).first().waitFor();
  await checkScreen(page, 'undo toast', testInfo);
  await page.getByRole('button', { name: 'Undo' }).first().click();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await checkScreen(page, 'sign out', testInfo);
  await page.getByRole('button', { name: 'Cancel' }).click();

  // V1-F: first-run onboarding, "Let's get started".
  await page.evaluate(() => { sessionStorage.setItem('percy_e2e_show_onboarding', '1'); localStorage.removeItem('percy_onboarding_done'); });
  await go(page, '/');
  const start = page.getByRole('dialog');
  await expect(start.getByRole('heading', { name: "Let's get started" })).toBeVisible();
  await checkScreen(page, 'onboarding', testInfo);
  await start.getByRole('button', { name: 'Explore Percy' }).click();
  await expect(start).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('percy_onboarding_done'))).toBe('true');
});

// V1-B: the Children page (nav "Children") and the request-only Child View.
test('children page', async ({ page }, testInfo) => {
  await go(page, '/');
  await page.getByRole('link', { name: 'Children' }).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Children', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly treats to choose from' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Children' }).first()).toHaveAttribute('aria-current', 'page');
  await checkScreen(page, 'children', testInfo);
  await page.getByRole('link', { name: 'View as child' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'My Percy adventure' })).toBeVisible();
  // Child View keeps the Children item marked as the current section.
  await expect(page.getByRole('link', { name: 'Children' }).first()).toHaveAttribute('aria-current', 'page');
});

test('child view: choosing a reward is a request, never a spend', async ({ page }, testInfo) => {
  const headers = { Authorization: `Bearer ${family.token}` };
  await go(page, '/childview');
  await expect(page.getByText('Choosing a reward is a request. Only a parent-authorised confirmation can spend points.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Spend|^Edit/ })).toHaveCount(0);
  await checkScreen(page, 'child view', testInfo);
  const before = (await (await page.request.get('/api/children', { headers })).json()).find((c) => /^Alexandra/.test(c.name));
  try {
    await page.getByRole('button', { name: 'Ask a parent for Screen time, 30 minutes' }).click();
    await expect(page.getByText('20 points · Ready when a parent agrees')).toBeVisible();
    const after = (await (await page.request.get('/api/children', { headers })).json()).find((c) => c.id === before.id);
    expect(after.total_points).toBe(before.total_points); // nothing was spent
    expect(after.available_points).toBe(before.available_points - 20);
    await checkScreen(page, 'child view requested', testInfo);
  } finally {
    // Leave the family as it was for the other screens, even after a failure.
    const now = (await (await page.request.get('/api/children', { headers })).json()).find((c) => c.id === before.id);
    for (const item of [...(now.reward_stack_priced || [])].reverse()) {
      if (item.name === 'Screen time, 30 minutes') {
        await page.request.delete(`/api/children/${now.id}/stack/${item.stackIndex}?reward_id=${item.rewardId}`, { headers });
      }
    }
  }
});

test('activity, with the log open and the child filter open', async ({ page }, testInfo) => {
  await go(page, '/activity');
  await checkScreen(page, 'activity', testInfo);
  // The two "This week" boxes: number and label centred in each (Nael, 16:04).
  const offsets = await page.evaluate(() => [...document.querySelectorAll('.bg-earn-soft > div, .bg-star-soft > div')]
    .map((d) => { const r = d.getBoundingClientRect(), p = d.parentElement.getBoundingClientRect(); return Math.abs((r.left + r.width / 2) - (p.left + p.width / 2)); }));
  expect(offsets.length).toBe(4);
  for (const o of offsets) expect(o).toBeLessThan(1.5);
  await page.getByRole('button', { name: /Activity log/ }).click();
  await checkScreen(page, 'activity log', testInfo);
  await page.getByRole('combobox', { name: 'Child' }).click();
  await checkScreen(page, 'activity child select', testInfo);
  await closeDialog(page);
});

test('rewards and its dialogs', async ({ page }, testInfo) => {
  await go(page, '/rewards');
  await checkScreen(page, 'rewards', testInfo);
  // V1-D catalogue: filters.
  await page.getByRole('button', { name: 'Hidden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hidden', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All rewards' }).click();

  // V1-D reward form: a new reward opens the icon picker.
  await page.getByRole('button', { name: /New reward/ }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('heading', { name: 'Add reward' })).toBeVisible();
  await checkScreen(page, 'create reward with picker', testInfo);
  // The title and the buttons stay on screen with the picker open (#34).
  await expect(form.getByRole('heading', { name: 'Add reward' })).toBeInViewport();
  await expect(form.getByRole('button', { name: 'Save reward' })).toBeInViewport();
  // Owner-approved grid: 3 columns under 520px of picker width, 5 to 759px, 6 from 760px.
  const grid = form.getByRole('group', { name: 'Reward icons' });
  const { width, cols } = await grid.evaluate((el) => ({
    width: el.parentElement.getBoundingClientRect().width,
    cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
  }));
  expect(cols).toBe(width >= 760 ? 6 : width >= 520 ? 5 : 3);
  await form.getByLabel('Find an icon').fill('bike');
  await expect(form.getByText('1 icon matches your search')).toBeVisible();
  await form.getByRole('button', { name: 'Bicycle' }).click();
  await expect(form.getByRole('button', { name: 'Bicycle' })).toHaveAttribute('aria-pressed', 'true');
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

  await page.getByRole('button', { name: /Add behaviour/ }).click();
  await checkScreen(page, 'new behaviour', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /^Add child/ }).click();
  await checkScreen(page, 'add child', testInfo);
  await closeDialog(page);

  // Child edit and delete moved from Home cards to Settings in V1.
  await page.getByRole('button', { name: /^Edit Alexandra/ }).first().click();
  await checkScreen(page, 'edit child', testInfo);
  await page.getByRole('button', { name: 'Delete Child' }).click();
  await checkScreen(page, 'delete child', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: /parenting tips/i }).click();
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
