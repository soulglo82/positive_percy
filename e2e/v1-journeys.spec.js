// V1 integrated journeys (owner, 2026-11-19: "review the complete app together,
// including actual parent and child journeys"). One child is created for the
// run and removed afterwards, so the shared fixture family is unchanged.
//
// Child: asks a parent for a reward in Child View (nothing is spent).
// Parent: sees the request on Home with its exact total, approves it, sees it
// in Activity as a redemption with its time; completes a goal and finds it under Goals;
// renames the family in Settings and finds the new name after a reload.
import { test, expect } from '@playwright/test';
import { checkScreen } from './checks.js';

const family = JSON.parse(process.env.PERCY_E2E_FAMILY || '{}');
const headers = { Authorization: `Bearer ${family.token}` };

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([code, token]) => {
    localStorage.setItem('positive_percy_family_code', code);
    localStorage.setItem('positive_percy_token', token);
    localStorage.setItem('percy_onboarding_done', 'true');
  }, [family.code, family.token]);
});

test('child asks, parent approves, history and settings follow', async ({ page }, testInfo) => {
  test.skip(!['phone-390-touch', 'desktop-1280'].includes(testInfo.project.name), 'A phone and a desktop cover the journeys');
  const tag = testInfo.project.name.startsWith('phone') ? 'P' : 'D';
  const name = `Jo${tag}`;
  const api = async (method, path, data) => {
    const r = await page.request.fetch(path, { method, headers, data });
    expect(r.ok(), `${method} ${path}`).toBe(true);
    return r.status() === 204 ? null : r.json();
  };
  const kid = await api('POST', '/api/children', { name, weekly_target: 20 });
  let reward;
  let familyName;
  try {
    await api('POST', `/api/children/${kid.id}/award`, { points: 30, category: 'Kindness', request_id: crypto.randomUUID() });
    reward = await api('POST', '/api/rewards', { title: `${name} treat`, cost_points: 10, visible_to_child: true, assigned_child_ids: [kid.id], icon_key: 'streamline:plump:duo:images-photography:film-slate' });
    const cats = await api('GET', '/api/behavior-categories');
    const today = (await api('GET', '/api/todays-goals')).date;
    await api('POST', '/api/todays-goals', { title: `${name} tidies up`, child_id: kid.id, category_id: cats[0].id, schedule_kind: 'one_off', scheduled_date: today });

    // Child: ask a parent. Nothing is spent; available points drop by the cost.
    await page.goto(`/childview?child=${kid.id}`);
    await expect(page.getByRole('heading', { name: `You're doing great, ${name}!` })).toBeVisible();
    // The approved reward artwork shows in Child View (V1-D §14).
    await expect(page.locator('li').filter({ hasText: reward.title }).locator('img[src="/reward-art/film-slate.svg"]')).toBeVisible();
    await page.getByRole('button', { name: `Ask a parent for ${reward.title}` }).click();
    await expect(page.getByText('10 points · Ready when a parent agrees')).toBeVisible();
    let me = (await api('GET', '/api/children')).find((c) => c.id === kid.id);
    expect(me.total_points).toBe(30);
    expect(me.available_points).toBe(20);

    // Parent, Home: the request with its exact total; approve it.
    await page.goto('/');
    await page.getByRole('group', { name: 'Choose a child' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: /^Rewards$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: `${name} asked for` })).toBeVisible();
    await expect(dialog.locator('[data-requests-total]')).toHaveText(`This will spend 10 points from ${name}'s balance.`);
    // O-I1: the requested reward is only in "asked for", not in the direct Spend list.
    await expect(dialog.getByText(reward.title, { exact: true })).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Approve 1 reward' }).click();
    await expect(page.getByText(`Approved 1 reward for ${name}.`)).toBeVisible();
    me = (await api('GET', '/api/children')).find((c) => c.id === kid.id);
    expect(me.total_points).toBe(20);
    expect(me.reward_stack_priced).toEqual([]);
    await page.keyboard.press('Escape');

    // Parent, Home: complete today's goal.
    await page.getByRole('button', { name: `Complete ${name} tidies up` }).click();
    await expect(page.getByText(`Well done! +1 point for ${name}.`)).toBeVisible();

    // Parent, Activity: the redemption and the goal, each under its filter.
    await page.goto('/activity');
    const log = page.getByRole('group', { name: 'Show activity' });
    await log.getByRole('button', { name: 'Spent' }).click();
    await expect(page.locator('[data-row-key^="spend-"]').filter({ hasText: `${name} redeemed ${reward.title}` }).first()).toContainText(/\d{1,2}:\d{2}\s[AP]M/); // its time; "redeemed" is said once, in the first line
    await expect(page.locator('[data-row-key^="spend-"]').filter({ hasText: `${name} redeemed ${reward.title}` }).first()).not.toContainText('Reward redeemed');
    await log.getByRole('button', { name: 'Goals' }).click();
    await expect(page.getByText(`“${name} tidies up”`).first()).toBeVisible();
    await log.getByRole('button', { name: 'Earned' }).click();
    await expect(page.getByText(`“${name} tidies up”`)).toHaveCount(0); // Earned and Goals are distinct

    // Parent, Activity: an approval made by mistake is undone here (V1-D §10
    // R3: the approval toast has no Undo; each redemption is undone in Activity).
    await log.getByRole('button', { name: 'Spent' }).click();
    const before = (await api('GET', '/api/children')).find((c) => c.id === kid.id).total_points;
    await expect(page.getByRole('button', { name: `Undo ${name} redeemed ${reward.title}` })).toBeVisible();
    await checkScreen(page, 'activity with undo', testInfo); // the new control: axe, name, 44px
    await page.getByRole('button', { name: `Undo ${name} redeemed ${reward.title}` }).click();
    await expect(page.getByText(`Undone. ${name} has ${before + 10} points.`)).toBeVisible();
    await expect(page.getByRole('button', { name: `Undo ${name} redeemed ${reward.title}` })).toHaveCount(0);
    expect((await api('GET', '/api/children')).find((c) => c.id === kid.id).total_points).toBe(before + 10);

    // Parent, Children: the child's page and goals.
    await page.goto(`/children?child=${kid.id}`);
    // V1.1 Children: the child's profile heading is their name.
    await expect(page.getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: `${name}'s goals` })).toBeVisible();

    // Parent, Settings: rename the family; it survives a reload.
    familyName = (await api('GET', `/api/auth/me?family_code=${family.code}`)).family.family_name;
    await page.goto('/parentprofile');
    await page.getByRole('button', { name: 'Edit Family name' }).click();
    await page.getByRole('dialog').getByLabel('Family name').fill(`The ${name} Family`);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Family name updated.')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Edit Family name' }).click();
    await expect(page.getByRole('dialog').getByLabel('Family name')).toHaveValue(`The ${name} Family`);
  } finally {
    if (familyName) await page.request.fetch('/api/family/name', { method: 'PUT', headers, data: { family_name: familyName } });
    if (reward) await page.request.fetch(`/api/rewards/${reward.id}`, { method: 'DELETE', headers });
    await page.request.fetch(`/api/children/${kid.id}`, { method: 'DELETE', headers });
  }
});
