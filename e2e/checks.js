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
    const out = { scroll: [], small: [], tiny: [], unnamed: [], clipped: [], wrapped: [], uneven: [] };
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
    // Text wider than its own box runs under whatever sits beside it (final
    // validation 2026-11-22: at 320px the "+1" badge covered the end of
    // "Kindness" in Quick Points). Any element holding text directly whose
    // content is wider than the element is reported. Form fields scroll their
    // own text and are left out; so are visually hidden labels.
    const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !el || seen.has(el) || !visible(el) || el.closest('.sr-only, input, textarea, select, [role="listbox"]')) continue;
      seen.add(el);
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        out.clipped.push(`"${n.textContent.trim().slice(0, 30)}" ${el.scrollWidth} > ${el.clientWidth}`);
      }
    }
    // The main navigation is one line: a label that wraps is squeezed (final
    // validation 2026-11-22: at 834px "/ Family" beside the tabs broke onto
    // two lines). Each element holding text there must sit on a single line. Checked on
    // the page only; behind an open dialog the bar is the same.
    if (scope === document.body) {
      for (const nav of document.querySelectorAll('nav[aria-label="Main"]')) {
        const nw = document.createTreeWalker(nav, NodeFilter.SHOW_TEXT);
        const held = new Set();
        for (let n = nw.nextNode(); n; n = nw.nextNode()) {
          const el = n.parentElement;
          if (!n.textContent.trim() || !el || held.has(el) || !visible(el) || el.closest('.sr-only')) continue;
          held.add(el);
          // The whole element, not the text node: "/ " and the page name are
          // two nodes, and the break fell between them.
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
          if (lines.size > 1) out.wrapped.push(`"${el.textContent.trim().slice(0, 30)}" on ${lines.size} lines`);
        }
      }
    }
    // Tiles in one grid look the same whatever their names (owner review
    // 2026-11-22: in Quick Points at 320px each tile wrapped its own way).
    // In every [data-tile-grid], each [data-tile] has its icon, name and
    // badge at the same place inside the tile; the name and the badge never
    // overlap; tiles in one row are one height, and in a grid marked "even"
    // all tiles are. Measured from inside the border (the selected tile's is
    // thicker), to half a pixel.
    for (const grid of scope.querySelectorAll('[data-tile-grid]')) {
      const tiles = [...grid.querySelectorAll('[data-tile]')].filter(visible);
      const at = tiles.map((t) => {
        const outer = t.getBoundingClientRect();
        // Inside the border, from fractional figures (clientWidth is a whole
        // number, so half-pixel tiles would read a pixel apart).
        const cs = getComputedStyle(t);
        const edge = (side) => parseFloat(cs[`border${side}Width`]) || 0;
        const box = { left: outer.left + edge('Left'), top: outer.top + edge('Top'), right: outer.right - edge('Right'), bottom: outer.bottom - edge('Bottom') };
        const part = (name) => t.querySelector(`[data-tile-part="${name}"]`)?.getBoundingClientRect();
        const [icon, name, badge] = ['icon', 'name', 'badge'].map(part);
        if (!icon || !name || !badge) return null;
        const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        const overlap = meet(name, badge) || meet(name, icon) || meet(icon, badge);
        // A name cut off at the bottom (a fixed height or a line clamp).
        const nameEl = t.querySelector('[data-tile-part="name"]');
        const cut = nameEl.scrollHeight > nameEl.clientHeight + 1;
        // Two rows (narrow): parts hang from the top of the tile. One row
        // (wide): parts are centred on the tile's middle line.
        const centred = cs.alignContent === 'center';
        const middle = (box.top + box.bottom) / 2;
        const y = (r) => (centred ? (r.top + r.bottom) / 2 - middle : r.top - box.top);
        return { top: outer.top, bottom: outer.bottom, height: outer.height, overlap, cut, label: t.textContent.trim().slice(0, 20),
          same: { iconLeft: icon.left - box.left, iconY: y(icon), nameLeft: name.left - box.left,
            nameY: y(name), badgeRight: box.right - badge.right, badgeY: y(badge) } };
      });
      if (at.some((x) => !x)) { out.uneven.push('a tile has no icon, name or badge part'); continue; }
      const spread = (values) => Math.max(...values) - Math.min(...values);
      for (const key of Object.keys(at[0]?.same || {})) {
        const values = at.map((x) => x.same[key]);
        if (spread(values) > 0.5) out.uneven.push(`${key}: ${values.map((v) => Math.round(v * 10) / 10).join(', ')}`);
      }
      for (const x of at) {
        if (x.overlap) out.uneven.push(`parts overlap: "${x.label}"`);
        if (x.cut) out.uneven.push(`name cut off: "${x.label}"`);
      }
      // A row is the tiles that share any height on screen, so a short tile
      // centred beside a tall one is still compared with it.
      const rows = grid.getAttribute('data-tile-grid') === 'even' ? [at] : [];
      if (!rows.length) {
        for (const x of [...at].sort((a, b) => a.top - b.top)) {
          const row = rows.find((r) => r.some((y) => x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5));
          if (row) row.push(x); else rows.push([x]);
        }
      }
      for (const row of rows) {
        if (spread(row.map((x) => x.height)) > 0.5) out.uneven.push(`height: ${row.map((x) => Math.round(x.height)).join(', ')}`);
      }
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
  expect(report.clipped, `${label}: text wider than its box`).toEqual([]);
  expect(report.wrapped, `${label}: navigation text on more than one line`).toEqual([]);
  expect(report.uneven, `${label}: tiles in one grid differ`).toEqual([]);
  expect(report.unnamed, `${label}: controls with no name`).toEqual([]);
  expect(report.small, `${label}: touch targets under 44px`).toEqual([]);
  // Kept as a file, so the CI artifact holds the screenshots.
  const file = testInfo.outputPath(`${label.replace(/[^\w]+/g, '-')}.png`);
  // Viewport only: a fullPage shot in Chromium drops the touch emulation
  // (pointer: coarse) for the rest of the test.
  await page.screenshot({ path: file });
  await testInfo.attach(label, { path: file, contentType: 'image/png' });
}
