// Batch E2: parent UI -> server ledger -> dashboard state, on desktop and mobile.
import { test, expect } from '@playwright/test';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

test('parent can add, complete once, edit and archive a dated goal', async ({ page, request }) => {
  const headers = { Authorization: 'Bearer ' + family.token };
  const beforeResponse = await request.get('/api/todays-goals', { headers });
  expect(beforeResponse.ok()).toBeTruthy();
  const today = (await beforeResponse.json()).date;
  const title = 'Read together ' + Date.now().toString(36);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Today's goals" })).toBeVisible();
  await page.getByRole('button', { name: 'Sam', exact: true }).click();
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Manage goals for Sam' })).toBeVisible();
  await dialog.getByLabel('Goal', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'One-off' }).click();
  await dialog.getByLabel('Date').fill(today);
  await dialog.getByRole('button', { name: 'Add goal' }).click();
  await expect(dialog.getByText(title)).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: 'Complete ' + title })).toBeVisible();
  await page.getByRole('button', { name: 'Complete ' + title }).click();
  // Wait for the async award and query refresh before inspecting the ledger.
  // A click only starts a request; on fast mobile emulation, a GET can race it.
  await expect(page.getByRole('button', { name: 'Complete ' + title })).toHaveCount(0);
  await expect(page.getByText(title)).toBeVisible();
  const goalResponse = await request.get('/api/todays-goals', { headers });
  const goals = (await goalResponse.json()).goals.filter(goal => goal.title === title);
  expect(goals).toHaveLength(1);
  expect(goals[0].completion_id).toBeTruthy();
  expect(goals[0].awarded_points).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Complete ' + title })).toHaveCount(0);

  // The management screen keeps completed entries editable and auditable.
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  await dialog.getByRole('button', { name: 'Edit ' + title }).click();
  await dialog.getByLabel('Goal', { exact: true }).fill(title + ' updated');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByText(title + ' updated')).toBeVisible();
  await dialog.getByRole('button', { name: 'Archive ' + title + ' updated' }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByText('Archive this goal?')).toBeVisible();
  await confirmation.getByRole('button', { name: 'Archive goal' }).click();
  await expect(dialog.getByText(title + ' updated')).toHaveCount(0);
});
