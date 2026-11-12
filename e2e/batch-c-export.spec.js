// Batch C PR2: browser-level proof that Settings actually starts a download.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test('Settings downloads the current family data without exposing its access code', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'One browser viewport is enough for download behavior');

  await page.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);

  await page.goto('/parentprofile');
  const button = page.getByRole('button', { name: 'Download technical data (JSON)' });
  await expect(button).toBeVisible();

  const pendingDownload = page.waitForEvent('download');
  await button.click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('positive-percy-family-data.json');
  const body = await readFile(await download.path(), 'utf8');
  const data = JSON.parse(body);
  expect(data.family.family_name).toBe('The Fixture Family');
  expect(data.children.map(c => c.name)).toContain('Sam');
  expect(data.behaviours).toHaveLength(9); // eight defaults plus Tidy room
  expect(data.format).toBe('positive-percy-family-export');
  expect(body).not.toContain(family.code);
  expect(body).not.toContain(family.token);
});
