// Batch C PR3: verify the parent can download a real, openable PDF on mobile.
import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test('Family settings downloads a multi-page A4 PDF and still offers technical JSON', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'One mobile browser covers generation');
  await page.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);

  await page.goto('/parentprofile');
  await expect(page.getByRole('button', { name: 'Download technical data (JSON)' })).toBeVisible();
  const report = page.getByRole('button', { name: 'Download Family Report (PDF)' });
  await expect(report).toBeVisible();
  const pendingDownload = page.waitForEvent('download', { timeout: 90000 });
  await report.click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toMatch(/^positive-percy-family-report-\d{4}-\d{2}-\d{2}\.pdf$/);

  const buffer = await readFile(await download.path());
  expect(buffer.subarray(0, 8).toString('latin1')).toContain('%PDF-1.4');
  expect(buffer.subarray(-80).toString('latin1')).toContain('%%EOF');
  const contents = buffer.toString('latin1');
  expect(contents).toMatch(/\/Type \/Pages/);
  expect(contents).toMatch(/\/Count [3-9]\d*/);
  expect(contents).toContain('/MediaBox [0 0 595.28 841.89]');
  expect(buffer.length).toBeGreaterThan(10000);
  await testInfo.attach('positive-percy-family-report.pdf', {
    body: buffer, contentType: 'application/pdf',
  });
  // Keep a synthetic sample in CI's screenshot artifact for visual PDF QA.
  // Only the throwaway fixture family's data is used here.
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/sample-family-report.pdf', buffer);
  await expect(page.getByRole('button', { name: 'Download technical data (JSON)' })).toBeEnabled();
});
