// The Batch D screen checks, shared by the UI specs: axe (nothing serious or
// critical), no horizontal scroll, no text under 12px, every control named,
// 44px touch targets on touch screens; and a screenshot kept as an artifact.
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function checkScreen(page, label, testInfo) {
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
