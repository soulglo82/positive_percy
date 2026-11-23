// Batch C PR2, revised in V1-E: the Settings JSON tile is removed (plan §2),
// but the export endpoint stays (the Family Report uses it). This proves the
// endpoint still returns the family's data without its access code.
import { test, expect } from '@playwright/test';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test('the family data export stays available without exposing the access code', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'One project is enough for an API check');
  const res = await page.request.get('/api/family/export', { headers: { Authorization: `Bearer ${family.token}` } });
  expect(res.status()).toBe(200);
  const body = await res.text();
  const data = JSON.parse(body);
  expect(data.family.family_name).toBe('The Fixture Family');
  expect(data.children.map(c => c.name)).toContain('Sam');
  expect(data.behaviours).toHaveLength(9); // eight defaults plus Tidy room
  expect(data.format).toBe('positive-percy-family-export');
  expect(body).not.toContain(family.code);
  expect(body).not.toContain(family.token);
});

test('Settings no longer shows the technical JSON tile (V1-E)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'One viewport is enough');
  await page.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
  await page.goto('/parentprofile');
  await expect(page.getByRole('heading', { name: 'Reports & privacy' })).toBeVisible();
  await expect(page.getByRole('button', { name: /technical data|JSON/ })).toHaveCount(0);
});
