// Photographs the owner-approved V1 design (the approved HTML, passed as a
// file path) at the same four widths, one image per screen.
//   node reference.cjs <approved.html> <out dir>
const { chromium } = require('playwright');
const path = require('path');
const [file, out] = [path.resolve(process.argv[2]), process.argv[3]];
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[320, 568], [390, 844], [834, 1194], [1280, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + file); await p.waitForTimeout(800);
    const screens = await p.$$eval('[data-screen]', (els) => [...new Set(els.map((e) => e.getAttribute('data-screen')))]);
    for (const sc of screens) {
      const el = await p.$(`[data-screen="${sc}"]`);
      await el.evaluate((e) => e.click()); await p.waitForTimeout(350);
      await p.screenshot({ path: `${out}/${sc}-${w}.png`, fullPage: true });
    }
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
