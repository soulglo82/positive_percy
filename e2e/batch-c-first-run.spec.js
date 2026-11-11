// Batch C: real-browser first-run smoke test, including the paths missed by
// the existing fixtures (which start in an already authenticated family).
import { test, expect } from '@playwright/test';

test('new family sees code, one-point behaviours, and editable screen-time reward', async ({ browser }, testInfo) => {
  // One new family per CI run; creation is intentionally rate-limited.
  test.skip(testInfo.project.name !== 'phone-390-touch', 'Single viewport avoids the signup rate limit');
  const context = await browser.newContext({
    baseURL: 'http://localhost:3300',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Create a Family' }).click();
    await page.getByLabel('Family Name').fill('Batch C smoke-test family');
    await page.getByRole('button', { name: 'Create Family', exact: true }).click();

    const welcome = page.getByRole('dialog');
    await expect(welcome.getByRole('heading', { name: 'Welcome to Positive Percy' })).toBeVisible();
    await expect(welcome).toContainText('Every behaviour starts at 1 point');
    const auth = await page.evaluate(() => ({
      family: localStorage.getItem('positive_percy_family_code'),
      token: localStorage.getItem('positive_percy_token'),
    }));
    expect(auth.family).toMatch(/^[A-Z2-9]{6}$/);
    expect(auth.token).toBeTruthy();

    const categoriesResponse = await context.request.get('/api/behavior-categories', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    expect(categoriesResponse.status()).toBe(200);
    const categories = await categoriesResponse.json();
    expect(categories).toHaveLength(8);
    expect(categories.every((category) => category.points === 1)).toBe(true);
    expect(categories.filter((category) => category.is_quick_action)).toHaveLength(4);

    await welcome.getByRole('button', { name: 'Set up a reward' }).click();
    await expect(page.getByText('No rewards yet')).toBeVisible();
    await page.getByRole('button', { name: 'Start with screen time' }).click();
    const rewardDialog = page.getByRole('dialog');
    await expect(rewardDialog.getByLabel('Reward Title')).toHaveValue('Extra Screen Time');
    await expect(rewardDialog.getByLabel('Point Cost')).toHaveValue('30');
    await rewardDialog.getByLabel('Point Cost').fill('12');
    await rewardDialog.getByRole('button', { name: 'Create Reward', exact: true }).click();
    await expect(page.getByText('Extra Screen Time').first()).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page.getByRole('alertdialog')).toContainText("need your family code");
    await page.getByRole('button', { name: 'Cancel' }).click();
  } finally {
    await context.close();
  }
});
