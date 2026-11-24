// Batch D: every screen, dialog, select and the Undo toast, at four sizes.
// Asserts: axe finds nothing serious or critical; no horizontal scroll; no
// text under 12px; no control without a name; on touch screens every
// control is at least 44px (a control inside a 44px label counts as the label).
import { test, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    // A test that checks first-run onboarding opts out for this tab.
    if (!sessionStorage.getItem('percy_e2e_show_onboarding')) localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});


async function go(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

// Quick Points is now the first card, so what it shows while the family's
// behaviours are still loading is the first thing a parent sees. It must not
// say "No quick points yet" and then swap to the tiles a moment later.
test('home does not show the empty Quick Points message while behaviours load', async ({ page }) => {
  await page.route('**/api/behavior-categories', async (route) => {
    await new Promise((done) => setTimeout(done, 1200));
    await route.continue();
  });
  let sawEmpty = false;
  await page.goto('/');
  const tiles = page.locator('[data-tile-grid]').first();
  const empty = page.getByText('No quick points yet.');
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !(await tiles.isVisible())) {
    if (await empty.isVisible()) sawEmpty = true;
    await page.waitForTimeout(50);
  }
  await expect(tiles).toBeVisible();
  expect(sawEmpty, 'the empty message was shown while the behaviours were loading').toBe(false);
  await expect(empty).toHaveCount(0);
});

test('home, its dialogs and the Undo toast', async ({ page }, testInfo) => {
  await go(page, '/');
  await checkScreen(page, 'home', testInfo);
  // V1.1 Home (design/v11; owner review 23 Nov 2026): the daily action centre.
  // Child picker and balance in the hero, then Quick Points, Today's Goals and
  // what the child is working towards. Progress rings belong to Children.
  await expect(page.locator('#home-title')).toHaveText(/^What went well for .+ today\?$/);
  const sam = page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: 'Sam', exact: true });
  await sam.click();
  await expect(sam).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText("Sam's checklist")).toBeVisible();
  // Owner, 24 November (V1-F section 10): the card says a box acts at once,
  // and the form is behind "Custom points" beside "Rewards".
  await expect(page.getByText('Tap a box to give its points straight away.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Award points/ })).toHaveCount(0);
  // V1.1 boxes (design/v11 P3 handback): one row (icon, name, +N) from 834px;
  // on phones two rows, so the name keeps the V1.1 15px action size instead
  // of the 12px a one-row phone box needs. Measured, not assumed.
  const boxes = await page.locator('[data-tile-grid="even"] [data-tile]').evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const name = el.querySelector('[data-tile-part="name"]');
    return { height: el.getBoundingClientRect().height, oneRow: cs.alignContent === 'center', text: parseFloat(getComputedStyle(name).fontSize) };
  }));
  expect(boxes.length, 'there are boxes to measure').toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.text, 'a box name is at least 14px').toBeGreaterThanOrEqual(14);
    expect(b.height, 'a box is at least 44px').toBeGreaterThanOrEqual(44);
    if (page.viewportSize().width >= 834) expect(b.oneRow, 'from 834px a box is one row').toBe(true);
    else { expect(b.oneRow, 'on phones a box is two rows').toBe(false); expect(b.height, 'a phone box stays compact').toBeLessThanOrEqual(80); }
  }
  const order = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const titles = ['Quick Points', "Today's Goals", "What you're working towards"];
    const hs = titles.map((t) => [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === t));
    if (hs.some((h) => !h)) return { missing: titles.filter((_, i) => !hs[i]) };
    const domOrdered = hs.every((h, i) => i === 0 || !!(hs[i - 1].compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING));
    const hero = document.querySelector('.pv-scene--morning');
    const boxes = hs.map((h) => h.getBoundingClientRect());
    const quick = hs[0].closest('section');
    return { domOrdered, tops: boxes.map((b) => Math.round(b.top)), lefts: boxes.map((b) => Math.round(b.left)),
      heroBottom: Math.round(hero.getBoundingClientRect().bottom), screen: window.innerHeight, oneColumn: window.innerWidth < 834,
      balanceInHero: !!hero.querySelector('[data-available]'), pickerInHero: !!hero.querySelector('[role="group"][aria-label="Choose a child"]'),
      rings: document.querySelectorAll('.pv-ring').length,
      quickHasAward: [...quick.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Custom points') };
  });
  expect(order.missing, 'every Home section is present').toBeUndefined();
  expect(order.domOrdered, 'DOM order: Quick Points, Goals, Working towards').toBe(true);
  expect(order.pickerInHero && order.balanceInHero, 'the child picker and the balance are in the hero').toBe(true);
  expect(order.rings, 'Home has no progress rings (the balance is a number)').toBe(0);
  expect(order.quickHasAward, 'Custom points sits in the Quick Points section').toBe(true);
  const [quickTop, goalsTop, towardsTop] = order.tops;
  const [quickLeft, goalsLeft, towardsLeft] = order.lefts;
  expect(quickTop, 'Quick Points comes after the hero').toBeGreaterThan(order.heroBottom);
  expect(quickTop - order.heroBottom, 'nothing between the hero and Quick Points but the gap').toBeLessThanOrEqual(48);
  if (order.screen >= 800) expect(quickTop, 'Quick Points starts on the first screen').toBeLessThan(order.screen);
  expect(goalsTop, "Today's Goals is above Working towards").toBeLessThan(towardsTop);
  if (order.oneColumn) {
    expect(quickTop, "one column: Quick Points is above Today's Goals").toBeLessThan(goalsTop);
    expect(new Set(order.lefts).size, 'one column: every section starts at the same left edge').toBe(1);
  } else {
    expect(goalsLeft, "two columns: Today's Goals is in the right column").toBeGreaterThan(quickLeft);
    expect(towardsLeft, 'two columns: Working towards is under Today\'s Goals').toBe(goalsLeft);
    expect(Math.abs(goalsTop - quickTop), 'two columns: the columns start level').toBeLessThanOrEqual(1);
  }

  // V1-D (D5): a child's request shows in the parent's Rewards dialog; "Not this time" removes it.
  const headers = { Authorization: `Bearer ${family.token}` };
  const kids = await (await page.request.get('/api/children', { headers })).json();
  const samId = kids.find((k) => k.name === 'Sam').id;
  // A 1-point reward made for this check (Sam has only a few points), removed after.
  const cheap = await (await page.request.post('/api/rewards', { headers, data: { title: 'Sticker ' + testInfo.project.name, cost_points: 1, emoji: '⭐', visible_to_child: true } })).json();
  expect((await page.request.post(`/api/children/${samId}/stack/add`, { headers, data: { reward_id: cheap.id } })).status()).toBe(200);
  await go(page, '/');
  await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: 'Sam', exact: true }).click();
  await page.getByRole('button', { name: /^Rewards$/ }).last().click();
  const spend = page.getByRole('dialog');
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toBeVisible();
  await checkScreen(page, 'spend', testInfo);
  await expect(spend.locator('[data-requests-total]')).toHaveText(new RegExp(`^This will spend \\d+ points? from Sam's balance\\.$`));
  await spend.getByRole('button', { name: `Not this time: ${cheap.title}` }).click();
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toHaveCount(0);
  await closeDialog(page);
  await page.request.delete(`/api/rewards/${cheap.id}`, { headers });

  // V1-F: "Give Percy Points", the compact form (design section 11).
  await page.getByRole('button', { name: 'Custom points' }).click();
  const award = page.getByRole('dialog');
  await expect(award.getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
  await expect(award.getByText('What did Sam do?')).toBeVisible();
  await checkScreen(page, 'add points', testInfo);
  // Section 11 (owner, 24 November, version B): the category boxes carry no
  // "+N" and are one row at every width; the amount comes only from the
  // Points row, which is fixed above Cancel and Award.
  const grid = award.getByRole('group', { name: /What did Sam do/ });
  await expect(grid).toHaveAttribute('data-tile-badge', 'none');
  await expect(award.locator('[data-tile-part="badge"]')).toHaveCount(0);
  await expect(award).not.toContainText('+1');
  for (const gone of ["Who's earned points?", 'How many points?', 'Choose a positive behaviour.']) await expect(award.getByText(gone)).toHaveCount(0);
  const formBoxes = await grid.locator('[data-tile]').evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const icon = el.querySelector('[data-tile-part="icon"]').firstElementChild;
    return { height: Math.round(el.getBoundingClientRect().height * 2) / 2, text: cs.fontSize, padding: `${cs.paddingTop} ${cs.paddingLeft}`, icon: `${Math.round(icon.getBoundingClientRect().width)}px` };
  }));
  expect(formBoxes.length, 'the form lists the categories').toBeGreaterThan(4);
  for (const f of formBoxes) {
    if (page.viewportSize().width >= 640) expect(f, 'from 640px a form box').toMatchObject({ text: '14px', padding: '10px 10px', icon: '20px' });
    else expect(f, 'a slim form box').toMatchObject({ height: 44, text: '12px', padding: '4px 6px', icon: '14px' });
  }
  const amountField = award.getByRole('spinbutton', { name: 'Points', exact: true });
  // The Points row and the buttons are on screen as the pop-up opens, at every size.
  for (const fixed of [amountField, award.getByRole('button', { name: 'One point fewer' }), award.getByRole('button', { name: 'One point more' }), award.getByRole('button', { name: 'Award 1 point' }), award.getByRole('button', { name: 'Cancel' })]) {
    await expect(fixed).toBeInViewport({ ratio: 1 });
  }
  // On a 390 x 844 phone the whole form fits: nothing to scroll, with the fixture's children and categories.
  if (testInfo.project.name === 'phone-390-touch') {
    const list = await award.locator('.overflow-y-auto').evaluate((el) => ({ content: el.scrollHeight, room: el.clientHeight }));
    expect(list.content, 'the form does not scroll at 390 x 844').toBeLessThanOrEqual(list.room);
  }
  // An amount that cannot be awarded shows the rule; a typed amount shows on
  // the button; plus and minus change it in the field; a category never
  // changes it. 4 is an amount no seeded behaviour has.
  // Real keys, one at a time, over the amount the dialog opened with (PR #73
  // review): the field must stay the same field and keep the keyboard, so the
  // second character lands. fill() sets the whole text at once and cannot
  // see that. The mark is lost if the page ever replaces the field.
  await amountField.evaluate((el) => { el.dataset.sameField = 'yes'; });
  await amountField.click();
  await amountField.press('ControlOrMeta+a');
  await page.keyboard.type('25');
  await expect(amountField).toHaveValue('25');
  await expect(amountField).toBeFocused();
  await expect(amountField).toHaveAttribute('data-same-field', 'yes');
  await expect(award.getByRole('button', { name: 'Award 25 points' })).toBeEnabled();
  // Emptied, then a part-typed amount the browser does not yet count as a
  // number ("-"), then finished: still the same field, still typing.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(amountField).toHaveValue('');
  await expect(amountField).toBeFocused();
  await page.keyboard.type('-');
  await expect(award.getByRole('button', { name: 'Award points', exact: true })).toBeDisabled();
  await page.keyboard.type('5');
  await expect(amountField).toHaveValue('-5');
  await expect(award.getByRole('alert')).toHaveText('Points must be a whole number from 1 to 1000.');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('12');
  await expect(amountField).toHaveValue('12');
  await expect(amountField).toHaveAttribute('data-same-field', 'yes');
  await expect(award.getByRole('button', { name: 'Award 12 points' })).toBeEnabled();
  // The field's own stepping still works from the typed amount.
  await page.keyboard.press('ArrowUp');
  await expect(amountField).toHaveValue('13');
  await expect(award.getByRole('button', { name: 'Award 13 points' })).toBeEnabled();
  await amountField.fill('0');
  await expect(award.getByRole('alert')).toHaveText('Points must be a whole number from 1 to 1000.');
  await expect(award.getByRole('button', { name: 'Award points', exact: true })).toBeDisabled();
  await checkScreen(page, 'add points, amount refused', testInfo);
  await amountField.fill('25');
  await expect(award.getByRole('button', { name: 'Award 25 points' })).toBeEnabled();
  await award.getByRole('button', { name: 'One point fewer' }).click();
  await expect(amountField).toHaveValue('24');
  // Choosing a category does not change the amount.
  await grid.getByRole('button').nth(1).click();
  await expect(grid.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(amountField).toHaveValue('24');
  await amountField.fill('2');
  const more = award.getByRole('button', { name: 'One point more' });
  await more.click();
  await more.click();
  await expect(amountField).toHaveValue('4');
  await expect(amountField).toHaveAttribute('data-same-field', 'yes');
  await checkScreen(page, 'add points, points row', testInfo);
  // The note is behind a link; it opens with the cursor in it.
  await award.getByRole('button', { name: 'Add a note' }).click();
  await expect(award.getByLabel('Add a note (optional)')).toBeFocused();
  await award.getByLabel('Add a note (optional)').fill('Shared the crayons');
  await checkScreen(page, 'add points, note open', testInfo);
  const samBefore = (await (await page.request.get('/api/children', { headers })).json()).find((k) => k.id === samId).total_points;
  const sent = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/children\/[^/]+\/award$/.test(new URL(r.url()).pathname));
  await award.getByRole('button', { name: 'Award 4 points' }).click();
  expect((await sent).postDataJSON()).toMatchObject({ points: 4, note: 'Shared the crayons' });
  await expect(award).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/children', { headers })).json()).find((k) => k.id === samId).total_points).toBe(samBefore + 4);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  // Toasts pause while the pointer rests on them (Sonner); a real parent moves
  // on, so the pointer leaves the toasts before waiting for them to clear.
  await page.mouse.move(0, 0);
  // The Undo really ran (its toast appears), then clears before the next taps.
  await expect(page.getByText(/^Undone\./)).toBeVisible();
  await expect(page.getByText(/^Undone\./)).toHaveCount(0, { timeout: 15000 });

  // V1-F: Manage goals list and the goal form.
  await page.getByRole('button', { name: 'Manage goals for Sam' }).click();
  const manage = page.getByRole('dialog');
  await expect(manage.getByRole('heading', { name: "Manage Sam's goals" })).toBeVisible();
  await checkScreen(page, 'manage goals', testInfo);
  await manage.getByRole('button', { name: 'Add goal' }).click();
  await expect(manage.getByRole('heading', { name: 'New goal' })).toBeVisible();
  await checkScreen(page, 'goal form', testInfo);
  await closeDialog(page);

  await page.getByRole('button', { name: /\+\d+ for Sam$/ }).first().click();
  await page.getByRole('button', { name: 'Undo' }).first().waitFor();
  await checkScreen(page, 'undo toast', testInfo);
  await page.getByRole('button', { name: 'Undo' }).first().click();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await checkScreen(page, 'sign out', testInfo);
  await page.getByRole('button', { name: 'Cancel' }).click();

  // V1-F: first-run onboarding, "Let's get started".
  await page.evaluate(() => { sessionStorage.setItem('percy_e2e_show_onboarding', '1'); localStorage.removeItem('percy_onboarding_done'); });
  await go(page, '/');
  const start = page.getByRole('dialog');
  await expect(start.getByRole('heading', { name: "Let's get started" })).toBeVisible();
  await checkScreen(page, 'onboarding', testInfo);
  await start.getByRole('button', { name: 'Explore Percy' }).click();
  await expect(start).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('percy_onboarding_done'))).toBe('true');
});

// V1-F design sections 10 and 11 (design reviews): the four projects run at
// 320, 390, 834 and 1280px, so the widths where one row is tightest were
// never run. Home's boxes (with "+N") are one row from 375px and keep two
// rows below. The form's boxes (no "+N") are one row at every width. Where a
// box is one row, each default name sits on one line in a 44px box with room
// to spare, selected or not, and a two-line name gives the same 44px.
test('slim behaviour boxes hold their names at 320, 360, 375, 390 and 414px', async ({ page, playwright }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'sets its own widths; one project is enough');
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, extraHTTPHeaders: { Authorization: `Bearer ${family.token}` } });
  const call = async (method, path, data) => {
    const r = await api.fetch(path, { method, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const TWO_LINES = 'Brushing teeth without any fuss';
  const clean = async () => {
    for (const c of (await call('GET', '/api/behavior-categories')).filter((x) => x.name === TWO_LINES)) await call('DELETE', `/api/behavior-categories/${c.id}`);
  };
  await clean();
  const DEFAULTS = ['Kindness', 'Helpfulness', 'Bravery', 'Resilience', 'Caring', 'Chores', 'Homework', 'Adventurous'];
  const measure = (scope) => scope.locator('[data-tile]').evaluateAll((els) => els.map((el) => {
    const name = el.querySelector('[data-tile-part="name"]');
    // Room left beside the name's text: text is drawn a few pixels wider on
    // some machines (CI broke "Adventurous" at 375px when 3px were spare).
    const range = document.createRange(); range.selectNodeContents(name);
    const widest = Math.max(...[...range.getClientRects()].map((r) => r.width));
    return { name: name.textContent, height: Math.round(el.getBoundingClientRect().height * 2) / 2,
      lines: Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight)),
      spare: Math.round((name.getBoundingClientRect().width - widest) * 10) / 10 };
  }));
  const SPARE = 7; // px a one-line default name must have left over
  try {
    await call('POST', '/api/behavior-categories', { name: TWO_LINES, icon: '🪥', points: 10 });
    for (const width of [320, 360, 375, 390, 414]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/');
      const home = await measure(page.locator('[data-tile-grid="even"]'));
      expect(home.length, `${width}px: Quick Points boxes`).toBe(4);
      // V1.1 Home (design/v11): on phones a compact two-row box with the name
      // at 15px; every default name on one line with room to spare.
      for (const t of home) {
        expect(t.lines, `${width}px Home: ${t.name} on one line`).toBe(1);
        expect(t.spare, `${width}px Home: ${t.name} has room to spare`).toBeGreaterThanOrEqual(SPARE);
        expect(t.height, `${width}px Home: a compact box`).toBeLessThanOrEqual(80);
      }
      await checkScreen(page, `home at ${width}`, testInfo);
      await page.getByRole('button', { name: 'Custom points' }).click();
      const form = page.getByRole('dialog');
      await expect(form.getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
      // The dialog opens with a short zoom; a box measured during it is a
      // fraction short (this test failed that way when run after others).
      await form.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
      const check = async (state) => {
        const tiles = await measure(form);
        for (const name of DEFAULTS) {
          const t = tiles.find((x) => x.name === name);
          expect(t, `${width}px form: ${name} is listed`).toBeTruthy();
          expect(t, `${width}px form, ${state}: ${name}`).toMatchObject({ height: 44, lines: 1 });
          expect(t.spare, `${width}px form, ${state}: ${name} has room to spare`).toBeGreaterThanOrEqual(SPARE);
        }
        const two = tiles.find((x) => x.name === TWO_LINES);
        // From 375px this name takes two lines and its box is still 44px. On a
        // narrower phone it takes three and the box grows: never cut off.
        if (width >= 375) expect(two, `${width}px form, ${state}: a two-line name is the same height`).toMatchObject({ height: 44, lines: 2 });
        else { expect(two.lines, `${width}px form: the long name wraps`).toBeGreaterThanOrEqual(2); expect(two.height, `${width}px form: its box holds every line`).toBe(two.lines <= 2 ? 44 : two.lines * 16 + 10); }
      };
      await check('as opened');
      // Selecting a box must not change the room its name has.
      for (const name of ['Adventurous', 'Helpfulness', TWO_LINES]) {
        await form.locator('[data-tile]').filter({ hasText: name }).click();
        await check(`${name} selected`);
      }
      await form.locator('[data-tile]').filter({ hasText: TWO_LINES }).scrollIntoViewIfNeeded();
      await checkScreen(page, `add points at ${width}`, testInfo);
      await closeDialog(page);
    }
  } finally {
    try { await clean(); } finally { await api.dispose(); }
  }
});

// V1-F design section 11 (design review): the Points row and the buttons are
// fixed at the bottom of the pop-up. In a short window (a phone on its side,
// or with the keyboard open on Android) they must stay reachable: from 420px
// of height they stay fixed and inside the screen; below that the pop-up
// scrolls as one piece and each can be brought into view and used.
test('the Give Percy Points pop-up in short windows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'sets its own sizes; one project is enough');
  for (const [width, height] of [[390, 450], [320, 300], [568, 320]]) {
    await page.setViewportSize({ width, height });
    await go(page, '/');
    await page.getByRole('button', { name: 'Custom points' }).click();
    const form = page.getByRole('dialog');
    await expect(form.getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
    await form.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
    const where = `${width} x ${height}`;
    const amount = form.getByRole('spinbutton', { name: 'Points', exact: true });
    // Which part scrolls (code review: without this the test passed with the
    // short-window rule removed, because Playwright can scroll either way).
    const scroll = await form.evaluate((el) => {
      const list = el.querySelector('#award-behaviour').closest('section').parentElement;
      return { popUp: getComputedStyle(el).overflowY, popUpScrolls: el.scrollHeight > el.clientHeight + 1, list: getComputedStyle(list).overflowY };
    });
    if (height >= 420) expect(scroll, `${where}: the list scrolls, the footer is fixed`).toMatchObject({ popUp: 'hidden', popUpScrolls: false, list: 'auto' });
    else expect(scroll, `${where}: the pop-up scrolls as one piece`).toMatchObject({ popUp: 'auto', popUpScrolls: true, list: 'visible' });
    if (height >= 420) {
      for (const fixed of [amount, form.getByRole('button', { name: 'Award 1 point' })]) await expect(fixed, `${where}: fixed and on screen`).toBeInViewport({ ratio: 1 });
      await checkScreen(page, `add points at ${width} by ${height}`, testInfo);
    }
    // Every control can be reached and used.
    await amount.scrollIntoViewIfNeeded();
    await expect(amount, `${where}: the amount field can be brought on screen`).toBeInViewport({ ratio: 1 });
    await amount.fill('7');
    const award = form.getByRole('button', { name: 'Award 7 points' });
    await award.scrollIntoViewIfNeeded();
    await expect(award, `${where}: Award can be brought on screen`).toBeInViewport({ ratio: 1 });
    await expect(award).toBeEnabled();
    const last = form.locator('[data-tile]').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last, `${where}: the last category can be brought on screen`).toBeInViewport({ ratio: 1 });
    await last.click();
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await closeDialog(page);
  }
});

// Owner review 2026-11-22 ("standardised alignment"): behaviour tiles keep one
// layout when a name wraps or a badge is wide. The fixture's names all fit on
// one line, so this swaps a long behaviour into Quick Points for the check
// (one worker, so no other test sees it) and puts everything back.
test('behaviour tiles stay aligned with a long name and a wide badge', async ({ page, playwright }, testInfo) => {
  // Its own connection, not the page's: after a timeout the page is closed,
  // and the clean-up must still run (code review). Every reply is checked.
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, extraHTTPHeaders: { Authorization: `Bearer ${family.token}` } });
  const call = async (method, path, data) => {
    const r = await api.fetch(path, { method, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const LONG = 'Tidying up without being asked Supercalifragilisticexpialidocious';
  // Put the family back as the fixture made it, whatever an earlier run left:
  // the long behaviour gone, then Resilience quick again (in that order: four is the cap).
  // Resilience is the fourth default Quick Point (E03 design §11).
  const restore = async () => {
    const all = await call('GET', '/api/behavior-categories');
    for (const c of all.filter((x) => x.name === LONG)) await call('DELETE', `/api/behavior-categories/${c.id}`);
    const fourth = all.find((c) => c.name === 'Resilience');
    if (!fourth.is_quick_action) await call('PUT', `/api/behavior-categories/${fourth.id}`, { is_quick_action: true });
    return fourth;
  };
  const fourth = await restore();
  try {
    await call('PUT', `/api/behavior-categories/${fourth.id}`, { is_quick_action: false });
    await call('POST', '/api/behavior-categories', { name: LONG, icon: '🧹', points: 1000, is_quick_action: true });
    await go(page, '/');
    const tiles = page.locator('[data-tile-grid] [data-tile]');
    await expect(tiles).toHaveCount(4);
    await expect(tiles.filter({ hasText: 'Tidying up without being asked' })).toContainText('+1000');
    await tiles.first().scrollIntoViewIfNeeded();
    await checkScreen(page, 'home long tile', testInfo);
    await page.getByRole('button', { name: 'Custom points' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
    await page.getByRole('dialog').locator('[data-tile]').filter({ hasText: 'Tidying up' }).scrollIntoViewIfNeeded();
    await checkScreen(page, 'add points long tile', testInfo);
    await closeDialog(page);
  } finally {
    await restore();
    const after = await call('GET', '/api/behavior-categories');
    expect(after.filter((c) => c.is_quick_action)).toHaveLength(4);
    expect(after.some((c) => c.name === LONG)).toBe(false);
    await api.dispose();
  }
});

// V1-B: the Children page (nav "Children") and the request-only Child View.
test('children page', async ({ page }, testInfo) => {
  await go(page, '/');
  await page.getByRole('link', { name: 'Children' }).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Children', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly treats to choose from' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Children' }).first()).toHaveAttribute('aria-current', 'page');
  await checkScreen(page, 'children', testInfo);
  await page.getByRole('link', { name: 'View as child' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'My Percy adventure' })).toBeVisible();
  // Child View keeps the Children item marked as the current section.
  await expect(page.getByRole('link', { name: 'Children' }).first()).toHaveAttribute('aria-current', 'page');
});

test('child view: choosing a reward is a request, never a spend', async ({ page }, testInfo) => {
  const headers = { Authorization: `Bearer ${family.token}` };
  await go(page, '/childview');
  await expect(page.getByText('Choosing a reward is a request. Only a parent-authorised confirmation can spend points.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Spend|^Edit/ })).toHaveCount(0);
  await checkScreen(page, 'child view', testInfo);
  const before = (await (await page.request.get('/api/children', { headers })).json()).find((c) => /^Alexandra/.test(c.name));
  try {
    await page.getByRole('button', { name: 'Ask a parent for Screen time, 30 minutes' }).click();
    await expect(page.getByText('20 points · Ready when a parent agrees')).toBeVisible();
    const after = (await (await page.request.get('/api/children', { headers })).json()).find((c) => c.id === before.id);
    expect(after.total_points).toBe(before.total_points); // nothing was spent
    expect(after.available_points).toBe(before.available_points - 20);
    await checkScreen(page, 'child view requested', testInfo);
  } finally {
    // Leave the family as it was for the other screens, even after a failure.
    const now = (await (await page.request.get('/api/children', { headers })).json()).find((c) => c.id === before.id);
    for (const item of [...(now.reward_stack_priced || [])].reverse()) {
      if (item.name === 'Screen time, 30 minutes') {
        await page.request.delete(`/api/children/${now.id}/stack/${item.stackIndex}?reward_id=${item.rewardId}`, { headers });
      }
    }
  }
});

test('activity, with the log open and the child filter open', async ({ page }, testInfo) => {
  await go(page, '/activity');
  await checkScreen(page, 'activity', testInfo);
  // The two "This week" boxes: number and label centred in each (Nael, 16:04).
  // Measured on the text itself, not its paragraph: a paragraph is as wide as
  // its box whatever the alignment, so its centre proved nothing (code review).
  const offsets = await page.evaluate(() => [...document.querySelectorAll('[data-week-boxes] > div > p')]
    .map((d) => {
      const range = document.createRange(); range.selectNodeContents(d);
      const r = range.getBoundingClientRect(), p = d.parentElement.getBoundingClientRect();
      return Math.abs((r.left + r.width / 2) - (p.left + p.width / 2));
    }));
  expect(offsets.length).toBe(4);
  for (const o of offsets) expect(o).toBeLessThan(1.5);
  // V1-C: the log is open; the four approved filters ask the server.
  await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible();
  await expect(page.getByText('Points earned')).toBeVisible();
  await expect(page.getByText('Goals completed')).toBeVisible();
  for (const name of ['Earned', 'Goals', 'Spent', 'All']) {
    await page.getByRole('group', { name: 'Show activity' }).getByRole('button', { name }).click();
    await expect(page.getByRole('group', { name: 'Show activity' }).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
  }
  await checkScreen(page, 'activity log', testInfo);
  await page.getByRole('combobox', { name: 'Child' }).click();
  await checkScreen(page, 'activity child select', testInfo);
  // The child filter is applied on the server (code review of #62).
  const narrowed = page.waitForRequest((r) => r.url().includes('/api/activity-feed') && r.url().includes('child_id='));
  await page.getByRole('option', { name: 'Sam' }).click();
  await narrowed;
});

test('rewards and its dialogs', async ({ page }, testInfo) => {
  await go(page, '/rewards');
  await checkScreen(page, 'rewards', testInfo);
  // V1-D catalogue: filters.
  await page.getByRole('button', { name: 'Hidden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hidden', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'All rewards' }).click();

  // V1-D reward form: a new reward opens the icon picker.
  await page.getByRole('button', { name: /New reward/ }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('heading', { name: 'Add reward' })).toBeVisible();
  await checkScreen(page, 'create reward with picker', testInfo);
  // The title and the buttons stay on screen with the picker open (#34).
  await expect(form.getByRole('heading', { name: 'Add reward' })).toBeInViewport();
  await expect(form.getByRole('button', { name: 'Save reward' })).toBeInViewport();
  // Owner-approved grid: 3 columns under 520px of picker width, 5 to 759px, 6 from 760px.
  const grid = form.getByRole('group', { name: 'Reward icons' });
  const { width, cols } = await grid.evaluate((el) => ({
    width: el.parentElement.getBoundingClientRect().width,
    cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
  }));
  expect(cols).toBe(width >= 760 ? 6 : width >= 520 ? 5 : 3);
  // V1-D §14: a new reward opens on the approved reward artwork.
  await expect(form.getByText('12 icons in Reward artwork')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Movie night' }).locator('img')).toHaveAttribute('src', '/reward-art/film-slate.svg');
  await expect.poll(() => form.getByRole('button', { name: 'Movie night' }).locator('img').evaluate((i) => i.naturalWidth)).toBeGreaterThan(0); // the file is served
  await form.getByLabel('Find an icon').fill('bike');
  await expect(form.getByText('2 icons match your search')).toBeVisible();
  await form.getByRole('button', { name: 'Bike ride' }).click();
  await expect(form.getByRole('button', { name: 'Bike ride' })).toHaveAttribute('aria-pressed', 'true');
  // Saved, the reward shows its approved artwork in the catalogue (V1-D §14).
  const artTitle = `Art ride ${testInfo.project.name}`;
  await form.getByLabel('Reward name').fill(artTitle);
  await form.getByRole('button', { name: 'Save reward' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const tile = page.locator('div').filter({ has: page.getByText(artTitle, { exact: true }) }).filter({ has: page.locator('img[src="/reward-art/bicycle-bike.svg"]') });
  await expect(tile.first()).toBeVisible();
  const auth = { Authorization: `Bearer ${family.token}` };
  const saved = (await (await page.request.get('/api/rewards', { headers: auth })).json()).find((r) => r.title === artTitle);
  expect(saved.icon_key).toBe('streamline:plump:duo:map-travel:bicycle-bike');
  await page.request.delete(`/api/rewards/${saved.id}`, { headers: auth });
  await page.reload();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /^Edit Screen time/ }).click();
  await checkScreen(page, 'edit reward', testInfo);
  await page.getByRole('button', { name: 'Delete Reward' }).click();
  await checkScreen(page, 'delete reward', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('settings, its selects and dialogs', async ({ page }, testInfo) => {
  // Records each Escape the page receives (when, whether a handler took it,
  // each dialog's state) for the message closeRow prints if one is lost.
  await page.addInitScript(() => {
    const log = window.__escapes = [];
    const note = (phase) => (event) => {
      if (event.key !== 'Escape') return;
      log.push({ phase, at: Math.round(performance.now()), taken: event.defaultPrevented,
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((d) => `${d.getAttribute('data-state')}|${d.style.pointerEvents || 'unset'}`),
        focus: (document.activeElement?.tagName || '') + (document.activeElement?.closest('[role="dialog"], [role="alertdialog"]') ? ' in dialog' : ' outside') });
    };
    window.addEventListener('keydown', note('before'), true);
    window.addEventListener('keydown', note('after'));
  });
  await go(page, '/parentprofile');
  await expect(page.getByRole('heading', { name: 'Family settings' })).toBeVisible();
  await checkScreen(page, 'settings', testInfo);
  const rowDialog = () => page.getByRole('dialog').first();
  // Escape closes the top dialog; after a nested dialog closes, one more
  // Escape closes the row's dialog.
  // One Escape closes exactly the top dialog (code review of #63). While a
  // nested dialog is open the row's dialog underneath is hidden from the
  // accessibility tree, so the check is: the nested one is gone and the row's
  // dialog, with its heading, is back.
  // An Escape that arrives before a dialog has registered itself as the top
  // layer is ignored by the dialog library. A person cannot press a key that
  // fast, but a test can: CI lost the Escape of the step that closes "Manage
  // goals" straight after opening it, at 2074d55 and again at a9bc57b. The
  // first fix waited for focus to enter the dialog. That is too early: focus
  // arrives a few milliseconds before the registration, and with that wait
  // real key presses were lost 67 times in 400 on a stand-alone page with the
  // same library and browser. The library marks the registered top dialog
  // with an inline `pointer-events: auto`; waiting for that mark lost 0 in
  // 400. It also holds after a nested dialog closes, when the row's dialog is
  // the top layer again. That the handler is live in the very task that
  // writes the mark follows from how this version of the library attaches
  // its ref, not from a promise it makes, so two frames are allowed after
  // the mark. If a library update drops the mark, this fails with its own
  // message rather than racing.
  // Evidence: docs/engineering/evidence/v1-integrated/tools/escape-real-key/
  // and escape-timing-probe.playwright.js beside it.
  const topLayerReady = async (dialog, what) => {
    await expect(dialog, `${what} has registered as the top layer (inline pointer-events: auto)`).toHaveAttribute('style', /pointer-events:\s*auto/);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  // What the page saw, so a lost Escape can be explained from the CI log:
  // each Escape as it arrived, and every dialog as it stands now.
  const reportLostEscape = async (what) => {
    const read = page.evaluate(() => ({
      escapes: (window.__escapes || []).slice(-4),
      now: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((d) => `${d.getAttribute('data-state')}|${d.style.pointerEvents || 'unset'}`),
      focus: (document.activeElement?.outerHTML || '').slice(0, 80),
    })).catch(() => 'the page did not answer');
    const seen = await Promise.race([read, new Promise((done) => setTimeout(() => done('the page did not answer in 2 s'), 2000))]);
    console.log(`Escape did not close ${what} [${testInfo.project.name}]: ${JSON.stringify(seen)}`);
  };
  const closeRow = async () => {
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await topLayerReady(page.getByRole('dialog'), 'the dialog');
    await page.keyboard.press('Escape');
    try {
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } catch (error) {
      await reportLostEscape('the dialog');
      throw error;
    }
  };
  const closeNested = async (rowTitle, nested) => {
    await expect(nested).toBeVisible();
    // The same mark, on the nested dialog itself: while it is the top layer
    // the row's dialog underneath carries `pointer-events: none`.
    await topLayerReady(nested, 'the nested dialog');
    await page.keyboard.press('Escape');
    try {
      await expect(nested).toHaveCount(0);
    } catch (error) {
      await reportLostEscape('the nested dialog');
      throw error;
    }
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog').getByRole('heading', { name: rowTitle, exact: true })).toBeVisible();
  };

  // V1-E: each control is reached through its row's dialog.
  await page.getByRole('button', { name: 'Edit Family timezone' }).click();
  await rowDialog().getByRole('combobox', { name: 'Timezone' }).click();
  await checkScreen(page, 'timezone select', testInfo);
  await page.keyboard.press('Escape'); // closes the list, the dialog stays
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await closeRow();

  await page.getByRole('button', { name: 'Edit Positive behaviour categories' }).click();
  await rowDialog().getByRole('button', { name: /^Kindness/ }).first().click();
  await rowDialog().getByRole('combobox').filter({ hasText: /children|only/ }).first().click();
  await checkScreen(page, 'behaviour assign select', testInfo);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await rowDialog().getByRole('button', { name: /^Tidy room/ }).first().click();
  await rowDialog().getByRole('button', { name: /^Delete$/ }).first().click();
  await checkScreen(page, 'delete behaviour', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await rowDialog().getByRole('button', { name: /Add behaviour/ }).click();
  await checkScreen(page, 'new behaviour', testInfo);
  await closeNested('Positive behaviour categories', page.getByRole('dialog').filter({ hasNotText: 'Names, point values' }));
  await closeRow();

  // Quick Points opens straight to the quick-button controls (owner review).
  await page.getByRole('button', { name: 'Edit Quick Points' }).click();
  await expect(rowDialog().getByRole('checkbox', { name: 'Kindness quick action' })).toBeVisible();
  await expect(rowDialog().getByRole('button', { name: /Add behaviour/ })).toHaveCount(0);
  await checkScreen(page, 'quick points', testInfo);
  await closeRow();

  await page.getByRole('button', { name: 'Edit Children' }).click();
  await rowDialog().getByRole('button', { name: /^Add child/ }).click();
  await checkScreen(page, 'add child', testInfo);
  await closeNested('Children', page.getByRole('dialog').filter({ hasNotText: 'Profiles, avatars' }));
  await page.getByRole('button', { name: /^Edit Alexandra/ }).first().click();
  await checkScreen(page, 'edit child', testInfo);
  await page.getByRole('button', { name: 'Delete Child' }).click();
  await checkScreen(page, 'delete child', testInfo);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('dialog').filter({ hasText: 'Edit Child' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Edit Child' })).toHaveCount(0);
  await closeRow();

  await page.getByRole('button', { name: 'Edit Family name' }).click();
  await expect(rowDialog().getByLabel('Family name')).toHaveValue('The Fixture Family');
  await checkScreen(page, 'family name', testInfo);
  await closeRow();

  await page.getByRole('button', { name: 'View Invite parent' }).click();
  await expect(rowDialog().getByText(family.code)).toBeVisible();
  await checkScreen(page, 'invite parent', testInfo);
  await closeRow();

  await page.getByRole('button', { name: 'Edit Today’s Goals' }).click();
  // Closed straight after opening: the case that raced on CI, kept so that
  // every run exercises the wait in closeRow. Then opened again for the
  // screen checks.
  await expect(page.getByRole('dialog').getByRole('heading', { name: /^Manage .+'s goals$/ })).toBeVisible();
  await closeRow();
  await page.getByRole('button', { name: 'Edit Today’s Goals' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /^Manage .+'s goals$/ })).toBeVisible();
  await checkScreen(page, 'manage goals from settings', testInfo);
  await closeRow();

  await page.getByRole('button', { name: /parenting tips/i }).click();
  await checkScreen(page, 'tips', testInfo);
  await closeDialog(page);
});

test('timezone: a refused save goes back to what is stored', async ({ page }) => {
  await page.route('**/api/family/timezone', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { timezone: null } });
    return route.fulfill({ status: 400, json: { error: 'Unknown timezone' } });
  });
  await go(page, '/parentprofile');
  await page.getByRole('button', { name: 'Edit Family timezone' }).click(); // V1-E: in its row's dialog
  const trigger = page.getByRole('dialog').getByRole('combobox', { name: 'Timezone' });
  await expect(trigger).toHaveText(/Choose your timezone/);
  await trigger.click();
  await page.getByRole('option', { name: 'Europe/London' }).click();
  await expect(page.getByText('Unknown timezone')).toBeVisible();
  await expect(trigger).toHaveText(/Choose your timezone/);
});
