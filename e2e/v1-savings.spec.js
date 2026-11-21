// D1 savings journey (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §19), at
// all four sizes, with the Batch D checks (axe, touch targets, text floor,
// no sideways scroll) on every new screen and dialog. A parent marks a bigger
// goal, saves towards it, undoes, moves points back, sees the goal on Home,
// Child View, Rewards and Activity, then redeems it and undoes the
// redemption. One child and one goal are made for the run and removed after.
import { test, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');
const headers = { Authorization: `Bearer ${family.token}` };

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

test('a parent saves towards a bigger goal, undoes, moves back and redeems', async ({ page }, testInfo) => {
  const tag = { 'phone-320': 'A', 'phone-390-touch': 'B', 'ipad-834-touch': 'C', 'desktop-1280': 'D' }[testInfo.project.name] || 'X';
  const name = `Sav${tag}`;
  const api = async (method, path, data) => {
    const r = await page.request.fetch(path, { method, headers, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const me = async () => (await api('GET', '/api/children')).find((c) => c.id === kid.id);
  const kid = await api('POST', '/api/children', { name, weekly_target: 20 });
  let bike;
  let tent;
  try {
    await api('POST', `/api/children/${kid.id}/award`, { points: 320, category: 'Kindness', request_id: crypto.randomUUID() });
    bike = await api('POST', '/api/rewards', { title: `${name} bike`, cost_points: 300, is_bigger_goal: true, assigned_child_ids: [kid.id] });
    await api('POST', `/api/children/${kid.id}/savings/save`, { reward_id: bike.id, points: 120, request_id: crypto.randomUUID() });

    // Children: the card, then the dialog.
    await page.goto(`/children?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Saving for something bigger' })).toBeVisible();
    await expect(page.getByText('120 of 300 points saved')).toBeVisible();
    // The card itself, scrolled into view (owner review of #64: on phones it is below the fold).
    await page.getByRole('heading', { name: 'Saving for something bigger' }).scrollIntoViewIfNeeded();
    await checkScreen(page, 'children with savings', testInfo);
    await page.getByRole('button', { name: `Edit saving for something bigger for ${name}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Saved: 120')).toBeVisible();
    await expect(dialog.getByText('Save up to 180 · Move back up to 120')).toBeVisible();
    await checkScreen(page, 'savings dialog', testInfo);

    // Save 30, then Undo from the toast.
    await dialog.getByLabel('Points', { exact: true }).fill('30');
    await dialog.getByRole('button', { name: 'Save points' }).click();
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: `Saved 30 points towards ${bike.title}` });
    await expect(toast).toBeVisible();
    await expect(dialog).toHaveCount(0); // closed, so the toast's Undo can be used
    expect((await me()).saved_total).toBe(150);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone.')).toBeVisible();
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await me()).saved_total).toBe(120);

    // Move 20 back.
    await page.getByRole('button', { name: `Edit saving for something bigger for ${name}` }).click();
    await expect(dialog.getByText('Saved: 120')).toBeVisible();
    await dialog.getByLabel('Points', { exact: true }).fill('20');
    await dialog.getByRole('button', { name: 'Move points back' }).click();
    await expect(page.getByText(`Moved 20 points back from ${bike.title}`)).toBeVisible();
    await expect.poll(async () => (await me())).toMatchObject({ saved_total: 100, available_points: 220, total_points: 320 });

    // Child View: the approved tiles; nothing moves points.
    await page.goto(`/childview?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(`Saved towards ${bike.title}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My next big adventure' })).toBeVisible();
    await expect(page.getByText('200 points to go')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save points|Move points back|Redeem/ })).toHaveCount(0);
    await checkScreen(page, 'child view with savings', testInfo);

    // Home: the selected child's goal.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByText('100 of 300 points saved')).toBeVisible();

    // Rewards: the Bigger rewards section.
    await page.goto('/rewards');
    await page.waitForLoadState('networkidle');
    const bigger = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Bigger rewards' }) });
    await expect(bigger.getByText('300 points · Bigger achievement').first()).toBeVisible();
    await checkScreen(page, 'rewards with bigger rewards', testInfo);

    // Activity: the moves, under All only.
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-row-key^="moved_back-"]').filter({ hasText: bike.title }).first()).toBeVisible();
    await expect(page.locator('[data-row-key^="saving-"]').filter({ hasText: bike.title }).first()).toBeVisible();
    await page.getByRole('group', { name: 'Show activity' }).getByRole('button', { name: 'Earned' }).click();
    await expect(page.locator('[data-row-key^="saving-"]')).toHaveCount(0);

    // Redeem from Children, with the confirm, then undo it.
    await page.goto(`/children?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: `Edit saving for something bigger for ${name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Redeem ${bike.title}` }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm.getByText(`This will spend 300 points from ${name}'s balance: 100 saved and 200 available.`)).toBeVisible();
    await checkScreen(page, 'redeem goal confirm', testInfo);
    await confirm.getByRole('button', { name: 'Redeem' }).click();
    const redeemed = page.locator('[data-sonner-toast]').filter({ hasText: `${bike.title} redeemed for ${name}` });
    await expect(redeemed).toBeVisible();
    await expect.poll(async () => (await me())).toMatchObject({ total_points: 20, saved_total: 0, available_points: 20 });
    await redeemed.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => (await me())).toMatchObject({ total_points: 320, saved_total: 100, available_points: 220 });

    // Un-marking warns, per child, and asks first (§20.3); Keep saving cancels.
    await page.goto('/rewards');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: `Edit ${bike.title}` }).click();
    const form = page.getByRole('dialog');
    await form.getByRole('checkbox', { name: /Bigger goal/ }).click();
    await expect(form.getByRole('status')).toContainText(`${name}: 100 saved points will become available again.`);
    await form.getByRole('status').scrollIntoViewIfNeeded();
    await checkScreen(page, 'unmark warning', testInfo);
    await form.getByRole('button', { name: 'Save reward' }).click();
    const endConfirm = page.getByRole('alertdialog');
    await expect(endConfirm.getByText("Past savings won't be restored if you re-enable the goal.", { exact: false })).toBeVisible();
    await checkScreen(page, 'end savings confirm', testInfo);
    await endConfirm.getByRole('button', { name: 'Keep saving' }).click();
    await page.keyboard.press('Escape');
    expect((await me()).saved_total).toBe(100); // nothing ended

    // A funded goal: the owner's celebration, never "0 points to go" (§20.2, owner wording 21 Nov).
    tent = await api('POST', '/api/rewards', { title: `${name} tent`, cost_points: 100, is_bigger_goal: true, assigned_child_ids: [kid.id] });
    await api('POST', `/api/children/${kid.id}/savings/save`, { reward_id: tent.id, points: 100, request_id: crypto.randomUUID() });
    await page.goto(`/childview?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(`${name} has saved enough for ${tent.title}!`)).toBeVisible();
    await expect(page.getByText(/0 points to go/)).toHaveCount(0);
    await page.getByRole('heading', { name: 'My next big adventure' }).scrollIntoViewIfNeeded();
    await checkScreen(page, 'child view fully saved', testInfo);

    // Deleting a goal with savings: a per-child warning and confirmation (§21.2).
    await page.goto('/rewards');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: `Edit ${tent.title}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Reward' }).click();
    const delConfirm = page.getByRole('alertdialog');
    await expect(delConfirm.getByRole('status')).toContainText(`${name}: 100 saved points will become available again.`);
    await checkScreen(page, 'delete goal with savings', testInfo);
    await delConfirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Reward deleted')).toBeVisible();
    tent = null;

    // Activity: the cancellation line, distinct from success (owner wording).
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');
    const endedRow = page.locator('[data-row-key^="savings_ended-"]').filter({ hasText: `${name}’s` }).first();
    await expect(endedRow).toContainText('savings are back in their points.');
    await expect(endedRow).toContainText('100 points returned · Reward deleted');
    await endedRow.scrollIntoViewIfNeeded();
    await checkScreen(page, 'activity with savings rows', testInfo);
  } finally {
    // The child first: its savings go with it, so the goals then delete
    // without a savings confirmation (§21.2).
    await page.request.fetch(`/api/children/${kid.id}`, { method: 'DELETE', headers });
    if (tent) await page.request.fetch(`/api/rewards/${tent.id}`, { method: 'DELETE', headers });
    if (bike) await page.request.fetch(`/api/rewards/${bike.id}`, { method: 'DELETE', headers });
  }
});
