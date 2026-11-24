// Daily Wins & Big Goals (owner's option C and "Points 1", 24 November 2026;
// docs/engineering/V1-F-DESIGN.md §12 and §13), at all four sizes, with the
// Batch D checks on every new view. A parent opens the one pop-up from Home,
// adds a Daily Win, adds a Big Goal, saves points towards it straight from
// the pop-up, undoes that from the toast, saves again, and sees both on
// Home; then the Children page's routes into the same pop-up. One child, one
// Daily Win and one Big Goal are made for the run and removed afterwards.
import { test, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');
const headers = { Authorization: `Bearer ${family.token}` };
// Words this change retired: none may be left on a rendered screen (§12 W1).
// The children list request, with or without a query string.
const CHILDREN = /\/api\/children(\?[^/]*)?$/;
const RETIRED = /Today.s Goals|Manage goals|bigger goal|something bigger|Bigger rewards|Bigger achievement|Little wins|weekly goal/i;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

test('a parent adds a Daily Win and a Big Goal from one pop-up, saves towards the goal and undoes', async ({ page }, testInfo) => {
  const tag = { 'phone-320': 'A', 'phone-390-touch': 'B', 'ipad-834-touch': 'C', 'desktop-1280': 'D' }[testInfo.project.name] || 'X';
  const name = `Win${tag}`;
  const api = async (method, path, data) => {
    const r = await page.request.fetch(path, { method, headers, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const kid = await api('POST', '/api/children', { name, weekly_target: 20 });
  const me = async () => (await api('GET', '/api/children')).find((c) => c.id === kid.id);
  const scooter = `${name} scooter`;
  const win = `${name} reads for ten minutes`;
  const home = async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
  };
  const door = page.getByRole('button', { name: 'Manage Daily Wins & Big Goals' });
  const dialog = page.getByRole('dialog');
  const side = (label) => dialog.getByRole('group', { name: 'Show' }).getByRole('button', { name: label, exact: true });
  try {
    await api('POST', `/api/children/${kid.id}/award`, { points: 60, category: 'Kindness', request_id: crypto.randomUUID() });

    // Home: the points line for the chosen child (§13), and the one door (§12 W2).
    await home();
    const line = page.locator('[data-points-line]');
    await expect(line.locator('p')).toHaveText(`Available now for ${name} 60 points`);
    await expect(line.locator('[data-available]')).toHaveText('60');
    await expect(page.getByText(`No Daily Wins for ${name} today.`)).toBeVisible();
    // The empty state has no button of its own; the door is the one way in.
    await expect(page.locator('#todays-goals-title').locator('xpath=ancestor::section').locator('.border-dashed button')).toHaveCount(0);
    // The door's label is never cut off: at 320px it wraps (X30).
    await door.scrollIntoViewIfNeeded();
    const fits = await door.evaluate((b) => { const label = b.querySelector('span'); return label.scrollWidth <= label.clientWidth + 1 && b.scrollWidth <= b.clientWidth + 1; });
    expect(fits, 'the Home button shows its whole label').toBe(true);
    await checkScreen(page, 'home with the points line and one door', testInfo);

    // The pop-up opens on Daily Wins for the child Home shows.
    await door.click();
    await expect(dialog.getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeVisible();
    await expect(side('Daily Wins')).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByText(`No Daily Wins yet for ${name}.`)).toBeVisible();
    // The picker shows the child Home shows (the test family always has more than one child).
    await expect(dialog.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Add a Daily Win.
    await dialog.getByRole('button', { name: 'Add Daily Win' }).click();
    await expect(dialog.getByRole('heading', { name: 'New Daily Win' })).toBeFocused();
    await expect(dialog.getByText(`For ${name}`)).toBeVisible();
    await dialog.getByLabel('What is it?').fill(win);
    await expect(dialog.getByLabel('Points for').locator('option').first()).toHaveText(/ · \d+ points?$/);
    for (const day of ['Sat', 'Sun']) await dialog.getByRole('button', { name: day, exact: true }).click(); // every day, so it shows today
    await checkScreen(page, 'new Daily Win, filled in', testInfo);
    await dialog.getByRole('button', { name: 'Save Daily Win' }).click();
    await expect(page.getByText('Daily Win added.')).toBeVisible();
    const winRow = dialog.getByRole('button', { name: new RegExp(`^Edit ${win} `) });
    await expect(winRow).toBeVisible();
    // The behaviour's icon stays on the row (owner, 24 Nov): its own icon, not just the row's chevron.
    await expect(winRow.locator('span[aria-hidden="true"] svg[data-icon]')).toBeVisible();
    await checkScreen(page, 'Daily Wins side with one Daily Win', testInfo);

    // The Big Goals side: empty, then a new Big Goal for this child.
    await side('Big Goals').click();
    await expect(dialog.getByText(`No Big Goals yet for ${name}.`)).toBeVisible();
    await dialog.getByRole('button', { name: 'Add Big Goal' }).click();
    await expect(dialog.getByRole('heading', { name: 'New Big Goal' })).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(1); // a view of the same dialog, never one on another
    await expect(dialog.getByText(`For ${name}`)).toBeVisible();
    await dialog.getByLabel('What is it?').fill(scooter);
    await dialog.getByLabel('Points needed').fill('50');
    await checkScreen(page, 'new Big Goal, filled in', testInfo);
    await dialog.getByRole('button', { name: 'Save Big Goal' }).click();
    await expect(page.getByText('Big Goal added.')).toBeVisible();
    // Back on the Big Goals side, with the new goal at nothing saved.
    await expect(side('Big Goals')).toHaveAttribute('aria-pressed', 'true');
    const goalRow = dialog.getByRole('button', { name: `Edit ${scooter} 0 of 50 points saved` });
    await expect(goalRow).toBeVisible();
    const made = (await api('GET', '/api/rewards')).find((r) => r.title === scooter);
    expect([made.is_bigger_goal, made.assigned_child_ids, made.visible_to_child, made.cost_points]).toEqual([true, [kid.id.toLowerCase()], true, 50]);
    // Two sibling controls for the goal; no control inside another (§12 W5).
    expect(await dialog.locator('button button, a button, button a').count()).toBe(0);
    await checkScreen(page, 'Big Goals side with one goal', testInfo);

    // Editing it sends only the name and cost: who it is for is untouched.
    await goalRow.click();
    await expect(dialog.getByRole('heading', { name: 'Edit Big Goal' })).toBeFocused();
    await expect(dialog.getByLabel('What is it?')).toHaveValue(scooter);
    await checkScreen(page, 'edit Big Goal', testInfo);
    await dialog.getByLabel('Points needed').fill('40');
    await dialog.getByRole('button', { name: 'Save Big Goal' }).click();
    await expect(page.getByText('Big Goal updated.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: `Edit ${scooter} 0 of 40 points saved` })).toBeVisible();
    const edited = (await api('GET', '/api/rewards')).find((r) => r.id === made.id);
    expect([edited.is_bigger_goal, edited.assigned_child_ids, edited.visible_to_child, edited.cost_points]).toEqual([true, [kid.id.toLowerCase()], true, 40]);

    // Save points straight from the pop-up: the savings view, in the same dialog.
    await dialog.getByRole('button', { name: `Save points for ${scooter}` }).click();
    await expect(dialog.getByRole('heading', { name: 'Save points for a Big Goal' })).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByRole('radio', { name: new RegExp(scooter) })).toBeChecked();
    await checkScreen(page, 'savings view inside the pop-up', testInfo);
    // Close returns to the Big Goals side; nothing saved.
    await dialog.getByRole('button', { name: 'Close' }).first().click(); // the footer's Close, not the X
    await expect(side('Big Goals')).toHaveAttribute('aria-pressed', 'true');
    expect((await me()).saved_total ?? 0).toBe(0);
    await dialog.getByRole('button', { name: `Save points for ${scooter}` }).click();
    await dialog.getByLabel('Points', { exact: true }).fill('15');
    await dialog.getByRole('button', { name: 'Save points', exact: true }).click();
    // The whole pop-up closes, so the toast's Undo can be used (X14).
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: `Saved 15 points towards ${scooter}` });
    await expect(toast).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect((await me()).saved_total).toBe(15);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(/^Undone\./)).toBeVisible();
    expect((await me()).saved_total ?? 0).toBe(0);
    await page.mouse.move(0, 0);

    // Save again; Home then shows the Big Goal, the lower points line and the Daily Win.
    await door.click();
    await side('Big Goals').click();
    await dialog.getByRole('button', { name: `Save points for ${scooter}` }).click();
    await dialog.getByLabel('Points', { exact: true }).fill('15');
    await dialog.getByRole('button', { name: 'Save points', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(line.locator('p')).toHaveText(`Available now for ${name} 45 points`);
    const towards = page.locator('[data-goal]').filter({ hasText: scooter });
    await expect(towards).toContainText('Big Goal');
    await expect(towards).toContainText('15 of 40 points saved');
    await expect(page.getByRole('button', { name: 'Complete ' + win })).toBeVisible();
    await towards.scrollIntoViewIfNeeded();
    await checkScreen(page, 'home with a Daily Win and a Big Goal', testInfo);

    // Escape closes the whole pop-up from any view, and focus returns to the door (X13, X32).
    await door.click();
    await side('Big Goals').click();
    await dialog.getByRole('button', { name: 'Add Big Goal' }).click();
    await expect(dialog.getByRole('heading', { name: 'New Big Goal' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(door).toBeFocused();
    // Opened again, it starts on the list, on Daily Wins: nothing of the last opening is left.
    await door.click();
    await expect(dialog.getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeVisible();
    await expect(side('Daily Wins')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The Children page: its routes into the same pop-up (W9, X16).
    await page.goto(`/children?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Big Goals', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${name}'s Daily Wins` })).toBeVisible();
    await page.getByRole('button', { name: 'New Daily Win' }).click();
    await expect(dialog.getByRole('heading', { name: 'New Daily Win' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(side('Daily Wins')).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: new RegExp(`^Edit ${win} `) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // No retired word on any screen a parent or child sees.
    for (const path of ['/', `/children?child=${kid.id}`, `/childview?child=${kid.id}`, '/rewards', '/activity', '/parentprofile']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      expect(text.match(RETIRED), `${path} shows a retired word`).toBeNull();
    }

    // Delete the Big Goal through the pop-up, with its savings: the warning,
    // the confirmation, then the Big Goals side without it (X11).
    await home();
    await door.click();
    await side('Big Goals').click();
    await dialog.getByRole('button', { name: new RegExp(`^Edit ${scooter} `) }).click();
    await dialog.getByRole('button', { name: 'Delete Big Goal' }).click();
    const confirmDelete = page.getByRole('alertdialog');
    await expect(confirmDelete.getByText('This will permanently delete this Big Goal for everyone it is for.', { exact: false })).toBeVisible();
    await expect(confirmDelete.getByRole('status')).toContainText(`${name}: 15 saved points will become available again.`);
    await checkScreen(page, 'delete Big Goal confirmation', testInfo);
    await confirmDelete.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Big Goal deleted.')).toBeVisible();
    await expect(confirmDelete).toHaveCount(0);
    await expect(dialog.getByText(`No Big Goals yet for ${name}.`)).toBeVisible();
    await expect(side('Big Goals')).toHaveAttribute('aria-pressed', 'true');
    expect((await api('GET', '/api/rewards')).some((r) => r.id === made.id)).toBe(false);
    expect((await me()).available_points).toBe(60); // the saved points are back
    // The pop-up still works after the confirmation closed over it.
    await side('Daily Wins').click();
    await expect(dialog.getByRole('button', { name: new RegExp(`^Edit ${win} `) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // With no Big Goal left, the Children page's "Add a Big Goal" opens the pop-up on that side.
    await page.goto(`/children?child=${kid.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('No Big Goals yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Add a Big Goal' }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeVisible();
    await expect(side('Big Goals')).toHaveAttribute('aria-pressed', 'true');
    await checkScreen(page, 'pop-up opened on Big Goals from Children', testInfo);
  } finally {
    // The child first: its savings and Daily Wins go with it, so the goal
    // then deletes without a savings confirmation (§21.2).
    await page.request.fetch(`/api/children/${kid.id}`, { method: 'DELETE', headers });
    const rewards = await (await page.request.fetch('/api/rewards', { headers })).json().catch(() => []);
    for (const r of (Array.isArray(rewards) ? rewards : []).filter((x) => x.title === scooter)) {
      await page.request.fetch(`/api/rewards/${r.id}`, { method: 'DELETE', headers });
    }
  }
});

test('long names, large figures, many Daily Wins, and a failed refresh', async ({ page }, testInfo) => {
  const tag = { 'phone-320': 'A', 'phone-390-touch': 'B', 'ipad-834-touch': 'C', 'desktop-1280': 'D' }[testInfo.project.name] || 'X';
  // A 30-character name with no spaces and a large balance (§13 A3, A4).
  const name = `Long${tag}Wolfeschlegelsteinhausenb`;
  const api = async (method, path, data) => {
    const r = await page.request.fetch(path, { method, headers, data });
    expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  expect(name).toHaveLength(30);
  const kid = await api('POST', '/api/children', { name, weekly_target: 20, total_points: 1000 });
  const longWin = `${name}ReadsForTenMinutesEveryEveningBeforeBedtimeAndTidiesUp`; // 60+ characters, no spaces (X17)
  const goal = `${name}TelescopeForTheGardenShed`;
  let reward;
  try {
    const cats = await api('GET', '/api/behavior-categories');
    const today = (await api('GET', '/api/todays-goals')).date;
    await api('POST', '/api/todays-goals', { title: longWin, child_id: kid.id, category_id: cats[0].id, schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7] });
    for (let i = 1; i <= 11; i += 1) await api('POST', '/api/todays-goals', { title: `${tag} Daily Win number ${i}`, child_id: kid.id, category_id: cats[0].id, schedule_kind: 'one_off', scheduled_date: today });
    reward = await api('POST', '/api/rewards', { title: goal, cost_points: 300, is_bigger_goal: true, assigned_child_ids: [kid.id], visible_to_child: false });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    // The points line: nothing clipped, the whole figure shown, inside the line (A3, A4).
    const line = page.locator('[data-points-line]');
    await expect(line.locator('p')).toHaveText(`Available now for ${name} 1000 points`);
    // The server caps a starting balance at 1000 and an award at 1000, so a
    // seven-figure balance is drawn into the built line to measure its layout.
    const fit = await line.evaluate((el) => {
      el.querySelector('[data-available]').textContent = '1000000';
      const box = el.getBoundingClientRect();
      const inside = (node) => { const r = node.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.width > 0; };
      const figure = el.querySelector('[data-available]').parentElement;
      return { name: inside(el.querySelector('bdi')), figure: inside(figure), oneLine: figure.getClientRects().length === 1, height: Math.round(box.height) };
    });
    expect(fit, 'the long name and the large figure both fit inside the line').toMatchObject({ name: true, figure: true, oneLine: true });
    await checkScreen(page, 'home with a long name and a large figure', testInfo);

    // The pop-up with 12 Daily Wins: the title and the Add button stay on
    // screen and the list scrolls inside the pop-up (X18).
    await page.getByRole('button', { name: 'Manage Daily Wins & Big Goals' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: new RegExp(`^Edit ${longWin} `) })).toBeVisible();
    const add = dialog.getByRole('button', { name: 'Add Daily Win' });
    const layout = await dialog.evaluate((d) => {
      const r = d.getBoundingClientRect();
      const body = [...d.children].find((c) => getComputedStyle(c).overflowY === 'auto');
      const rows = d.querySelectorAll('[data-side="wins"] li').length;
      return { top: r.top, bottom: r.bottom, screen: window.innerHeight, rows, bodyRoom: body ? body.clientHeight : 0, bodyScrolls: !!body && body.scrollHeight > body.clientHeight, pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 && getComputedStyle(document.body).overflow !== 'hidden' };
    });
    expect(layout.rows, 'all twelve Daily Wins are listed').toBe(12);
    expect(layout.top, 'the pop-up starts on the screen').toBeGreaterThanOrEqual(0);
    expect(layout.bottom, 'the pop-up ends on the screen').toBeLessThanOrEqual(layout.screen);
    expect(layout.bodyRoom, 'the list has room: at least two rows show').toBeGreaterThanOrEqual(100);
    if (layout.screen < 900) expect(layout.bodyScrolls, 'twelve rows scroll inside the pop-up').toBe(true);
    await expect(add).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('heading', { name: 'Daily Wins & Big Goals' })).toBeInViewport({ ratio: 1 });
    await checkScreen(page, 'pop-up with twelve Daily Wins and a long name', testInfo);
    // The Big Goals side with a long name, hidden from children (X24).
    await dialog.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Big Goals', exact: true }).click();
    await expect(dialog.getByRole('button', { name: new RegExp(`^Edit ${goal} 0 of 300 points saved Hidden from children$`) })).toBeVisible();
    await checkScreen(page, 'Big Goals side with a long name', testInfo);

    // A refresh that fails while the pop-up is open must not replace the page
    // (and the pop-up) with the error card (X27).
    let failed = 0;
    await page.route(CHILDREN, (route) => { if (route.request().method() === 'GET') { failed += 1; return route.abort(); } return route.continue(); });
    await dialog.getByRole('button', { name: new RegExp(`^Edit ${goal} `) }).click();
    await dialog.getByLabel('Points needed').fill('290');
    await dialog.getByRole('button', { name: 'Save Big Goal' }).click();
    await expect(page.getByText('Big Goal updated.')).toBeVisible({ timeout: 15000 });
    await expect.poll(() => failed, { timeout: 15000 }).toBeGreaterThanOrEqual(2); // the refresh and its one retry both failed
    await page.waitForTimeout(500);
    await expect(page.getByText("Couldn't load children")).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: new RegExp(`^Edit ${goal} 0 of 290 points saved`) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(line).toBeVisible();
    // A first load that fails still shows the card, with nothing else to show.
    await page.goto('/');
    await expect(page.getByText("Couldn't load children")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-points-line]')).toHaveCount(0); // no line without a child (A6)
    await page.unroute(CHILDREN);
  } finally {
    await page.unroute(CHILDREN).catch(() => {});
    await page.request.fetch(`/api/children/${kid.id}`, { method: 'DELETE', headers });
    if (reward) await page.request.fetch(`/api/rewards/${reward.id}`, { method: 'DELETE', headers });
  }
});

