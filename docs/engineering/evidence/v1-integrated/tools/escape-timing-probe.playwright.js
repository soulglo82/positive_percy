// Escape timing probe (22 November 2026). Not part of the test suite: it lives
// outside e2e/ so CI does not run it.
//
// Question: after a dialog opens, from which moment does an Escape close it?
// It fires one Escape inside the page at a chosen moment after "Manage goals"
// opens from Settings, ten times per moment, and counts how often the dialog
// closed. It also prints the gap between focus entering the dialog and the
// dialog carrying the library's inline `pointer-events: auto`.
//
// Result at 3f9747f, desktop 1280, processor at normal speed and slowed six
// times (20 trials per moment):
//   focus enters the dialog ............ 0 of 20 closed
//   the mark appears ................... 20 of 20 closed
//   the mark, then the next task ....... 20 of 20 closed
//   the mark, then two frames .......... 20 of 20 closed
//   focus-to-mark gap: 2.5 to 5 ms at normal speed, 12 to 35 ms slowed.
// So "focus is inside the dialog" is too early a signal and the mark is not.
// e2e/ui.spec.js waits for the mark before it presses Escape.
// This probe sends its Escape from inside the page. Whether a real key press
// can land in that gap is shown by escape-real-key/run.cjs beside this file.
//
// To run: copy this file into e2e/ as escape-timing-probe.spec.js (the name
// here has no ".spec." so the unit-test runner leaves it alone), build, then
//   PROBE_RATE=6 E2E_DATABASE_URL=postgres://... npx playwright test e2e/escape-timing-probe.spec.js --project=desktop-1280
import { test, expect } from '@playwright/test';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');
const RATE = Number(process.env.PROBE_RATE || 1);
const N = Number(process.env.PROBE_N || 10);

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

// In-page: fire one Escape at a chosen moment after the dialog appears.
const MODES = ['focus', 'style', 'style+task', 'style+2raf'];

test('probe: in-page Escape at chosen moments', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280');
  test.setTimeout(600000);
  const cdp = await page.context().newCDPSession(page);
  await page.goto('/parentprofile');
  await page.waitForLoadState('networkidle');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  for (const mode of MODES) {
    let closed = 0; const gaps = [];
    for (let i = 0; i < N; i++) {
      await page.evaluate((m) => {
        const p = window.__p = { mode: m, fired: false, t: {} };
        const esc = () => { p.t.esc = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); };
        const fire = () => {
          if (p.fired) return; p.fired = true;
          if (m === 'focus' || m === 'style') esc();
          else if (m === 'style+task') setTimeout(esc, 0);
          else requestAnimationFrame(() => requestAnimationFrame(esc));
        };
        p.onFocus = (e) => { if (e.target.closest?.('[role="dialog"]')) { p.t.focus ??= performance.now(); if (m === 'focus') fire(); } };
        document.addEventListener('focusin', p.onFocus, true);
        p.mo = new MutationObserver(() => {
          const d = document.querySelector('[role="dialog"]');
          if (d) p.t.mount ??= performance.now();
          if (d && d.style.pointerEvents === 'auto') { p.t.style ??= performance.now(); if (m !== 'focus') fire(); }
        });
        p.mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
      }, mode);
      await page.getByRole('button', { name: 'Edit Today’s Goals' }).click();
      await page.waitForTimeout(700 * Math.max(1, RATE / 4));
      const r = await page.evaluate(() => { const p = window.__p; p.mo.disconnect(); document.removeEventListener('focusin', p.onFocus, true); return { t: p.t, fired: p.fired, open: document.querySelectorAll('[role="dialog"]').length }; });
      if (r.open === 0) closed++;
      gaps.push(`${r.fired ? '' : 'NOFIRE '}f-m=${((r.t.focus ?? NaN) - r.t.mount).toFixed(1)} s-f=${((r.t.style ?? NaN) - (r.t.focus ?? NaN)).toFixed(1)}`);
      if (r.open) { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); }
      await page.waitForTimeout(100);
    }
    console.log(`PROBE rate=${RATE} mode=${mode}: ${closed}/${N} closed; ${gaps.slice(0, 4).join(' | ')}`);
  }
});
