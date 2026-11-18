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

// E05: a weekly routine end to end, against the server ledger. Runs on every
// project (390/834/1280 and touch), so the 44px target is checked on desktop too.
test('E05: weekly goal - complete, undo, redo, rename keeps start, reschedule, schedule-change message, archive', async ({ page, request }) => {
  const headers = { Authorization: 'Bearer ' + family.token };
  const api = async () => (await (await request.get('/api/todays-goals?manage=true', { headers })).json());
  const balance = async () => {
    const kids = await (await request.get('/api/children', { headers })).json();
    return kids.find(k => k.name === 'Sam').total_points;
  };
  const title = 'Brush teeth ' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  await page.goto('/');
  await page.getByRole('button', { name: 'Sam', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sam', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Goal', { exact: true }).fill(title);
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
    const b = dialog.getByRole('button', { name: day, exact: true });
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  }
  for (const day of ['Sat', 'Sun']) {
    const b = dialog.getByRole('button', { name: day, exact: true });
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  }
  await dialog.getByRole('button', { name: 'Add goal' }).click();
  await expect(dialog.getByText(title)).toBeVisible();
  await expect(dialog.getByText(/Every day/).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  const completeBtn = page.getByRole('button', { name: new RegExp('^Complete ' + title + ', \\+\\d+ points?$') });
  await expect(completeBtn).toBeVisible();
  const box = await completeBtn.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  expect(box.width).toBeGreaterThanOrEqual(43.5);
  await expect(page.getByText('Repeats every day').first()).toBeVisible();

  const start = await balance();
  await completeBtn.click();
  await expect(completeBtn).toHaveCount(0);
  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row.getByText('Done')).toBeVisible();
  await expect(row.getByText('Done')).toBeFocused();
  const pts = (await api()).goals.find(g => g.title === title).category_points;
  expect(await balance()).toBe(start + pts);

  // Undo from the toast restores the balance and the button.
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(completeBtn).toBeVisible();
  await expect.poll(balance).toBe(start);
  // Complete again the same day: one award, net.
  await completeBtn.click();
  await expect(completeBtn).toHaveCount(0);
  await expect.poll(balance).toBe(start + pts);

  // Rename keeps the start date (server value unchanged).
  const before = (await api()).goals.find(g => g.title === title);
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  await dialog.getByRole('button', { name: 'Edit ' + title }).click();
  await dialog.getByLabel('Goal', { exact: true }).fill(title + ' x');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByText(title + ' x')).toBeVisible();
  const renamed = (await api()).goals.find(g => g.title === title + ' x');
  expect(renamed.start_date).toBe(before.start_date);

  // Changing the days shows when the new schedule starts.
  await dialog.getByRole('button', { name: 'Edit ' + title + ' x' }).click();
  await dialog.getByRole('button', { name: 'Sun', exact: true }).click();
  await expect(dialog.getByText(/The new schedule starts on/)).toBeVisible();

  // Turning a completed weekly goal into a one-off is refused, inline.
  await dialog.getByRole('button', { name: 'One-off' }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Create a separate goal');
  await dialog.getByRole('button', { name: 'Cancel edit' }).click();

  await dialog.getByRole('button', { name: 'Archive ' + title + ' x' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive goal' }).click();
  await expect(dialog.getByText(title + ' x')).toHaveCount(0);
  expect(await balance()).toBe(start + pts); // archive keeps earned points
});
