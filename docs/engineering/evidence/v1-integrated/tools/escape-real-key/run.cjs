// Can a real key press be lost just after a dialog opens? (22 November 2026)
//
// Opens the dialog in page.js with a real click, waits in one of two ways,
// presses Escape once with a real key press, and counts how often the dialog
// stayed open. It also records what the dialog looked like when the key
// arrived.
//   old   the wait e2e/ui.spec.js used at a9bc57b: focus is inside the dialog
//   mark  the wait it uses now: the dialog carries inline pointer-events: auto
//
// Result on 22 November (React 18.3.1, @radix-ui/react-dialog 1.1.15,
// the Chromium that Playwright installs), four runs of 100 presses each:
//   old   lost 19, 20, 17 and 11 of 100; every lost key arrived before the mark
//   mark  lost 0 of 100 in every run
// An independent reviewer's runs of the same experiment: old lost between 0
// and 52 of 150 from batch to batch; mark lost 0 of 480.
//
// To run, from the repository root after `npm ci`:
//   node docs/engineering/evidence/v1-integrated/tools/escape-real-key/run.cjs
// N=<presses per mode> changes the count (default 100). Nothing is written
// outside the system's temporary directory. No server or database is needed.
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '../../../../../..');
const req = createRequire(path.join(root, 'package.json'));
const { chromium } = req('playwright');
const { expect } = req('@playwright/test');
const esbuild = req('esbuild');
const N = Number(process.env.N || 100);

const WAITS = {
  old: async (page) => {
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Manage goals' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.waitForFunction(() => !!document.activeElement?.closest('[role="dialog"], [role="alertdialog"]'), null, { timeout: 1000 }).catch(() => {});
  },
  mark: async (page) => {
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveAttribute('style', /pointer-events:\s*auto/);
  },
};

(async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'escape-real-key-')), 'bundle.js');
  await esbuild.build({ entryPoints: [path.join(__dirname, 'page.js')], bundle: true, outfile: out, absWorkingDir: root, nodePaths: [path.join(root, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const bundle = fs.readFileSync(out);
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/bundle.js')) { response.setHeader('content-type', 'text/javascript'); response.end(bundle); return; }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__escapes = [];
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') window.__escapes.push([...document.querySelectorAll('[role="dialog"]')].map((d) => `${d.getAttribute('data-state')}|${d.style.pointerEvents || 'unset'}`).join(',') || 'no dialog');
    }, true);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#open').waitFor();
  let failed = false;
  for (const [mode, wait] of Object.entries(WAITS)) {
    let lost = 0; let early = 0; const states = {};
    for (let i = 0; i < N; i++) {
      await page.evaluate(() => { window.__escapes.length = 0; });
      await page.locator('#open').click();
      await wait(page);
      await page.keyboard.press('Escape');
      const closed = await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 400 }).then(() => true, () => false);
      const at = (await page.evaluate(() => window.__escapes[0])) || 'no key seen';
      states[at] = (states[at] || 0) + 1;
      if (!/auto/.test(at)) early++;
      if (!closed) {
        lost++;
        for (let k = 0; k < 5 && await page.locator('[role="dialog"]').count(); k++) { await page.waitForTimeout(100); await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
      }
      await page.waitForTimeout(30);
    }
    console.log(`${mode}: lost ${lost} of ${N}; key arrived before the mark ${early} of ${N}; dialog when the key arrived: ${JSON.stringify(states)}`);
    if (mode === 'mark' && lost) failed = true;
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
