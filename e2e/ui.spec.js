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
  // V1 Home: family strip selects the child; Goals before the summary.
  await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  const sam = page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: /^Sam / });
  await sam.click();
  await expect(sam).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText("Sam's checklist")).toBeVisible();
  // Section 10 (owner, 24 November): the card says a box acts at once, the
  // boxes are one row from 375px, and the form is behind "Custom points".
  await expect(page.getByText('Tap a box to give its points straight away.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Award points/ })).toHaveCount(0);
  // What a box is made of at this width (code review: at 640px and above the
  // phone sizes had leaked in, and a 44px height could not show it).
  const boxFacts = (scope) => scope.locator('[data-tile]').evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const icon = el.querySelector('[data-tile-part="icon"] svg, [data-tile-part="icon"] img') || el.querySelector('[data-tile-part="icon"]').firstElementChild;
    return { height: Math.round(el.getBoundingClientRect().height * 2) / 2, text: cs.fontSize, padding: `${cs.paddingTop} ${cs.paddingLeft}`,
      gap: cs.columnGap, icon: `${Math.round(icon.getBoundingClientRect().width)}px`, oneRow: cs.alignContent === 'center' };
  }));
  const expectBoxes = (facts, where) => {
    const width = page.viewportSize().width;
    expect(facts.length, `${where}: there are boxes to measure`).toBeGreaterThan(0);
    for (const f of facts) {
      if (width >= 640) expect(f, `${where}: from 640px a box is as it was`).toMatchObject({ height: 46, text: '14px', padding: '10px 10px', gap: '8px', icon: '20px', oneRow: true });
      else if (width >= 375) expect(f, `${where}: a slim one-row box`).toMatchObject({ height: 44, text: '12px', padding: '4px 6px', gap: '4px', icon: '14px', oneRow: true });
      else expect(f, `${where}: below 375px a box keeps two rows`).toMatchObject({ oneRow: false, icon: '20px', padding: '10px 10px' });
    }
  };
  expectBoxes(await boxFacts(page.locator('[data-tile-grid="even"]')), 'Home');
  // Owner, 22 November: awarding points is the point of this page. The order
  // is the child picker, then Quick Points, Today's Goals, the available
  // points ("Little wins") and what the child is working towards. The DOM
  // (Tab and screen-reader) order is that reading order (review of PR #57).
  // One column (under 1024px): the cards stack in that order. Two columns:
  // Quick Points then Today's Goals on the left, Little wins then Working
  // towards on the right, the two columns equally wide.
  // Nothing sits between the child picker and Quick Points. On a screen at
  // least 800px tall the card starts on the first screen. (This fixture's
  // long child name makes the picker tall: at 320x568 the heading starts at
  // about 570px here, and at about 430px for a family with short names.)
  const order = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const titles = ['Quick Points', "Today's Goals", 'Little wins, big adventures!', "What you're working towards"];
    const hs = titles.map((t) => [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === t));
    if (hs.some((h) => !h)) return { missing: titles.filter((_, i) => !hs[i]) };
    const domOrdered = hs.every((h, i) => i === 0 || !!(hs[i - 1].compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING));
    // The column that holds two cards: the nearest element containing both headings.
    const columnOf = (a, b) => { let el = a.parentElement; while (el && !el.contains(b)) el = el.parentElement; return el; };
    const left = columnOf(hs[0], hs[1]);
    const right = columnOf(hs[2], hs[3]);
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; };
    const picker = document.querySelector('[role="group"][aria-label="Choose a child"]').getBoundingClientRect();
    const boxes = hs.map((h) => h.getBoundingClientRect());
    return { domOrdered, tops: boxes.map((b) => Math.round(b.top)), lefts: boxes.map((b) => Math.round(b.left)),
      pickerBottom: Math.round(picker.bottom), screen: window.innerHeight, oneColumn: window.innerWidth < 1024,
      separateColumns: left !== right && !left.contains(right) && !right.contains(left),
      left: box(left), right: box(right),
      leftCards: [...left.children].map(box), rightCards: [...right.children].map(box),
      quickCardHasAward: !!left.children[0] && left.children[0].contains(hs[0]) && [...left.children[0].querySelectorAll('button')].some((b) => b.textContent.trim() === 'Custom points') };
  });
  expect(order.missing, 'every Home section is present').toBeUndefined();
  expect(order.domOrdered, 'DOM order: Quick Points, Goals, Little wins, Working towards').toBe(true);
  const [quickTop, goalsTop, winsTop, towardsTop] = order.tops;
  const [quickLeft, goalsLeft, winsLeft, towardsLeft] = order.lefts;
  expect(quickTop, 'Quick Points comes after the child picker').toBeGreaterThan(order.pickerBottom);
  // The gap between cards (20px) plus the card's own padding, and nothing else.
  expect(quickTop - order.pickerBottom, 'Quick Points is the first thing under the child picker').toBeLessThanOrEqual(48);
  if (order.screen >= 800) expect(quickTop, 'Quick Points starts on the first screen').toBeLessThan(order.screen);
  expect(quickTop, "Quick Points is above Today's Goals").toBeLessThan(goalsTop);
  expect(winsTop, 'Little wins is above Working towards').toBeLessThan(towardsTop);
  // Two cards a column, nothing between them but the gap, and the Quick
  // Points card is the whole card (its Custom points button is in it).
  expect(order.separateColumns, 'the two pairs of cards are in separate columns').toBe(true);
  expect(order.leftCards.length, 'left column: Quick Points and Goals only').toBe(2);
  expect(order.rightCards.length, 'right column: Little wins and Working towards only').toBe(2);
  expect(order.quickCardHasAward, 'the first card is Quick Points, with its Custom points button').toBe(true);
  expect(order.leftCards[1].top - order.leftCards[0].bottom, 'the gap between Quick Points and Goals').toBe(20);
  expect(order.rightCards[1].top - order.rightCards[0].bottom, 'the gap between Little wins and Working towards').toBe(20);
  if (order.oneColumn) {
    expect(goalsTop, "one column: Today's Goals is above Little wins").toBeLessThan(winsTop);
    expect(new Set(order.lefts).size, 'one column: every card starts at the same left edge').toBe(1);
    expect(order.right.top - order.left.bottom, 'one column: the gap between Goals and Little wins').toBe(20);
  } else {
    expect(goalsLeft, "two columns: Today's Goals is under Quick Points, in the left column").toBe(quickLeft);
    expect(towardsLeft, 'two columns: Working towards is under Little wins, in the right column').toBe(winsLeft);
    expect(order.right.left, 'two columns: the right column starts after the left one ends').toBeGreaterThan(order.left.right);
    expect(Math.abs(order.left.width - order.right.width), 'two columns: equally wide').toBeLessThanOrEqual(1);
    expect(Math.abs(order.right.top - order.left.top), 'two columns: the columns start level').toBeLessThanOrEqual(1);
  }

  // V1-D (D5): a child's request shows in the parent's Rewards dialog; "Not this time" removes it.
  const headers = { Authorization: `Bearer ${family.token}` };
  const kids = await (await page.request.get('/api/children', { headers })).json();
  const samId = kids.find((k) => k.name === 'Sam').id;
  // A 1-point reward made for this check (Sam has only a few points), removed after.
  const cheap = await (await page.request.post('/api/rewards', { headers, data: { title: 'Sticker ' + testInfo.project.name, cost_points: 1, emoji: '⭐', visible_to_child: true } })).json();
  expect((await page.request.post(`/api/children/${samId}/stack/add`, { headers, data: { reward_id: cheap.id } })).status()).toBe(200);
  await go(page, '/');
  await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: /^Sam / }).click();
  await page.getByRole('button', { name: /^Rewards$/ }).last().click();
  const spend = page.getByRole('dialog');
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toBeVisible();
  await checkScreen(page, 'spend', testInfo);
  await expect(spend.locator('[data-requests-total]')).toHaveText(new RegExp(`^This will spend \\d+ points? from Sam's balance\\.$`));
  await spend.getByRole('button', { name: `Not this time: ${cheap.title}` }).click();
  await expect(spend.getByRole('heading', { name: 'Sam asked for' })).toHaveCount(0);
  await closeDialog(page);
  await page.request.delete(`/api/rewards/${cheap.id}`, { headers });

  // V1-F: "Give Percy Points" - child, amount, behaviour, note.
  await page.getByRole('button', { name: 'Custom points' }).click();
  const award = page.getByRole('dialog');
  await expect(award.getByRole('heading', { name: 'Give Percy Points' })).toBeVisible();
  await expect(award.getByText('What did Sam do?')).toBeVisible();
  await checkScreen(page, 'add points', testInfo);
  // Section 10 (owner, 24 November): slim boxes, and one Points row under
  // them: minus, the number, plus. From 375px a box is one row, 44px tall for
  // the seeded names; below 375px it keeps the two-row layout of 22 November.
  expectBoxes(await boxFacts(award), 'the form');
  await expect(award.getByText('How many points?')).toHaveCount(0);
  // An amount that cannot be awarded shows the rule; a typed amount shows on
  // the button; plus and minus change it in the field; tapping a box sets it
  // back to the box's points. 4 is an amount no seeded behaviour has, so it
  // can only come from the choice.
  const amountField = award.getByRole('spinbutton', { name: 'Points', exact: true });
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
  // Tapping a box sets Points to that box's points (here the first, worth 1).
  await award.getByRole('group', { name: /What did Sam do/ }).getByRole('button').first().click();
  await expect(amountField).toHaveValue('1');
  await amountField.fill('2');
  const more = award.getByRole('button', { name: 'One point more' });
  await more.click();
  await more.click();
  await expect(amountField).toHaveValue('4');
  await expect(amountField).toHaveAttribute('data-same-field', 'yes');
  await checkScreen(page, 'add points, points row', testInfo);
  await award.getByLabel('Add a note (optional)').fill('Shared the crayons');
  const samBefore = (await (await page.request.get('/api/children', { headers })).json()).find((k) => k.id === samId).total_points;
  const sent = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/children\/[^/]+\/award$/.test(new URL(r.url()).pathname));
  await award.getByRole('button', { name: 'Award 4 points' }).click();
  expect((await sent).postDataJSON().points).toBe(4);
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

// V1-F design section 10 (design review): the four projects run at 320, 390,
// 834 and 1280px, so the widths where one row is tightest were never run.
// One row starts at 375px; at 360px the boxes keep two rows. At every width
// from 375px each default name sits on one line in a 44px box, selected or
// not (the selected box's border is the same width), and a two-line name
// gives the same 44px.
test('slim behaviour boxes hold their names at 360, 375, 390 and 414px', async ({ page, playwright }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390-touch', 'sets its own widths; one project is enough');
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, extraHTTPHeaders: { Authorization: `Bearer ${family.token}` } });
  const call = async (method, path, data) => {
    const r = await api.fetch(path, { method, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const TWO_LINES = 'Brushing teeth nicely';
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
    for (const width of [360, 375, 390, 414]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/');
      const home = await measure(page.locator('[data-tile-grid="even"]'));
      expect(home.length, `${width}px: Quick Points boxes`).toBe(4);
      for (const t of home) {
        if (width >= 375) {
          expect(t, `${width}px Home: ${t.name}`).toMatchObject({ height: 44, lines: 1 });
          expect(t.spare, `${width}px Home: ${t.name} has room to spare`).toBeGreaterThanOrEqual(SPARE);
        }
        else expect(t.height, `${width}px Home: two rows`).toBeGreaterThan(56);
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
          if (width >= 375) {
            expect(t, `${width}px form, ${state}: ${name}`).toMatchObject({ height: 44, lines: 1 });
            expect(t.spare, `${width}px form, ${state}: ${name} has room to spare`).toBeGreaterThanOrEqual(SPARE);
          }
          else expect(t.height, `${width}px form: two rows`).toBeGreaterThan(56);
        }
        const two = tiles.find((x) => x.name === TWO_LINES);
        if (width >= 375) expect(two, `${width}px form, ${state}: a two-line name is the same height`).toMatchObject({ height: 44, lines: 2 });
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
