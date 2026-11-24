// Reward forms and confirmation dialogs at 320, 359, 360, 390, 834 and 1280px
// (owner's release review, 22 November). 359 and 360 sit either side of the
// `xs` breakpoint, where a dialog changes from full width to a card with a
// margin; the four project sizes do not land on it.
//
// On each width, for the new-reward form, the edit form with its "savings
// will end" warning, the three confirmations (end savings, delete a goal with
// savings, redeem a goal) and the savings dialog:
// - the shared screen checks (axe, no sideways scroll, no text under 12px, no
//   text wider than its box, every control named, 44px targets on touch);
// - every button of the dialog can be brought fully inside the window and is
//   not covered by something else;
// - the dialog itself fits inside the window.
//
// The touch project runs the five widths up to 834 (so touch targets are
// measured); the desktop project runs 1280. Nothing is saved or deleted: every
// dialog is cancelled. One child and one goal are made for the run and removed.
import { test, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');
const headers = { Authorization: `Bearer ${family.token}` };
const WIDTHS = { 'phone-390-touch': [320, 359, 360, 390, 834], 'desktop-1280': [1280] };

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

// Every visible button of the open dialog: reachable, inside the window, on top.
async function controlsReachable(page, dialog, label) {
  const size = page.viewportSize();
  const box = await dialog.boundingBox();
  expect(box.x, `${label}: dialog starts inside the window`).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width, `${label}: dialog ends inside the window`).toBeLessThanOrEqual(size.width + 0.5);
  expect(box.y + box.height, `${label}: dialog bottom inside the window`).toBeLessThanOrEqual(size.height + 0.5);
  const buttons = dialog.getByRole('button');
  const n = await buttons.count();
  expect(n, `${label}: the dialog has buttons`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible())) continue;
    await b.scrollIntoViewIfNeeded();
    const r = await b.boundingBox();
    const name = (await b.getAttribute('aria-label')) || (await b.innerText()).trim();
    expect(r.x >= -0.5 && r.x + r.width <= size.width + 0.5 && r.y >= -0.5 && r.y + r.height <= size.height + 0.5,
      `${label}: "${name}" fits inside the window (${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} in ${size.width}x${size.height})`).toBe(true);
    // The point at its middle belongs to the button (nothing lies over it).
    // A disabled button takes no pointer hits by design (an empty form's
    // "Save reward"), so the probe would see what is behind it: it only has to fit.
    if (await b.isDisabled()) continue;
    const onTop = await b.evaluate((el) => {
      const q = el.getBoundingClientRect();
      const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return !!hit && (el === hit || el.contains(hit));
    });
    expect(onTop, `${label}: "${name}" is not covered`).toBe(true);
  }
}

test('reward forms and confirmations at six widths', async ({ page }, testInfo) => {
  const widths = WIDTHS[testInfo.project.name];
  test.skip(!widths, 'The touch phone project runs 320-834; the desktop project runs 1280');
  test.setTimeout(240000);
  const api = async (method, path, data) => {
    const r = await page.request.fetch(path, { method, headers, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const tag = testInfo.project.name.startsWith('phone') ? 'P' : 'D';
  const name = `Resp${tag}`;
  const kid = await api('POST', '/api/children', { name, weekly_target: 20 });
  let goal;
  try {
    await api('POST', `/api/children/${kid.id}/award`, { points: 400, category: 'Kindness', request_id: crypto.randomUUID() });
    goal = await api('POST', '/api/rewards', { title: `${name} telescope for the garden`, cost_points: 300, is_bigger_goal: true, assigned_child_ids: [kid.id] });
    await api('POST', `/api/children/${kid.id}/savings/save`, { reward_id: goal.id, points: 120, request_id: crypto.randomUUID() });

    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 834 ? 1000 : 780 });
      const at = (what) => `${what} at ${width}`;

      // New reward form.
      await page.goto('/rewards');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /New reward/ }).first().click();
      const form = page.getByRole('dialog');
      await expect(form.getByRole('heading', { name: 'Add reward' })).toBeVisible();
      await checkScreen(page, at('new reward form'), testInfo);
      await controlsReachable(page, form, at('new reward form'));
      await page.keyboard.press('Escape');
      await expect(form).toHaveCount(0);

      // Edit form with the "savings will end" warning, then the confirmation.
      await page.getByRole('button', { name: `Edit ${goal.title}` }).click();
      await expect(form.getByRole('heading', { name: 'Edit reward' })).toBeVisible();
      await form.getByRole('checkbox', { name: /Big Goal/ }).click();
      await expect(form.getByRole('status')).toContainText(`${name}: 120 saved points will become available again.`);
      await form.getByRole('status').scrollIntoViewIfNeeded();
      await checkScreen(page, at('edit reward form with warning'), testInfo);
      await controlsReachable(page, form, at('edit reward form with warning'));
      await form.getByRole('button', { name: 'Save reward' }).click();
      const confirm = page.getByRole('alertdialog');
      await expect(confirm.getByRole('heading', { name: "End this Big Goal's savings?" })).toBeVisible();
      await checkScreen(page, at('end savings confirmation'), testInfo);
      await controlsReachable(page, confirm, at('end savings confirmation'));
      await confirm.getByRole('button', { name: 'Keep saving' }).click();
      await expect(confirm).toHaveCount(0);

      // Delete confirmation for a goal with savings.
      await form.getByRole('button', { name: 'Delete Reward' }).click();
      await expect(confirm.getByRole('heading', { name: `Delete ${goal.title}?` })).toBeVisible();
      await checkScreen(page, at('delete confirmation'), testInfo);
      await controlsReachable(page, confirm, at('delete confirmation'));
      await confirm.getByRole('button', { name: 'Cancel' }).click();
      await expect(confirm).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(form).toHaveCount(0);

      // Savings dialog and the redeem confirmation.
      await page.goto(`/children?child=${kid.id}`);
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: `Edit Big Goals for ${name}` }).click();
      const savings = page.getByRole('dialog');
      await expect(savings.locator('[data-saved]')).toHaveText('120');
      await checkScreen(page, at('savings dialog'), testInfo);
      await controlsReachable(page, savings, at('savings dialog'));
      await savings.getByRole('button', { name: `Redeem ${goal.title}` }).click();
      await expect(confirm.getByText(`This will spend 300 points from ${name}'s balance: 120 saved and 180 available.`)).toBeVisible();
      await checkScreen(page, at('redeem confirmation'), testInfo);
      await controlsReachable(page, confirm, at('redeem confirmation'));
      await confirm.getByRole('button', { name: 'Cancel' }).click();
      await expect(confirm).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    // Nothing was saved, ended or deleted along the way.
    const after = (await api('GET', '/api/children')).find((c) => c.id === kid.id);
    expect(after).toMatchObject({ total_points: 400, saved_total: 120, available_points: 280 });
    expect((await api('GET', '/api/rewards')).some((r) => r.id === goal.id)).toBe(true);
  } finally {
    // The child first: its savings go with it, so the goal deletes without a confirmation.
    await page.request.fetch(`/api/children/${kid.id}`, { method: 'DELETE', headers });
    if (goal) await page.request.fetch(`/api/rewards/${goal.id}`, { method: 'DELETE', headers });
  }
});
