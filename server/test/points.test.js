// @vitest-environment node
// Batch A: points correctness. The balance only moves through one
// transaction that also writes the history row for the amount applied.
// Design: claude/batch-a-points-correctness-design.md.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!runDb)('batch A: points correctness', () => {
  let ctx, F, G;
  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Points family');
    G = await makeFamily(ctx.base, 'Other family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const child = async (name, body = {}) => {
    const r = await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name, ...body } });
    expect(r.status).toBe(200);
    return r.json;
  };
  const award = (id, points, extra = {}) =>
    api(ctx.base, 'POST', `/api/children/${id}/award`, { token: F.token, body: { points, category: 'Kindness', request_id: rid(), ...extra } });
  const balance = async (id) => (await ctx.pool.query('SELECT total_points, weekly_points FROM children WHERE id = $1', [id])).rows[0];
  // History adds up: earned and deducted events minus completed spends.
  const historyTotal = async (id) => {
    const e = await ctx.pool.query('SELECT COALESCE(SUM(points),0)::int AS s FROM point_events WHERE child_id = $1', [id]);
    const r = await ctx.pool.query("SELECT COALESCE(SUM(reward_cost),0)::int AS s FROM redemptions WHERE child_id = $1 AND status = 'Completed'", [id]);
    return e.rows[0].s - r.rows[0].s;
  };

  it('A1: one award writes one history row and moves the balance by the same amount', async () => {
    const c = await child('Ann');
    const r = await award(c.id, 5);
    expect(r.status).toBe(200);
    expect(r.json.child.total_points).toBe(5);
    const { rows } = await ctx.pool.query('SELECT points FROM point_events WHERE child_id = $1', [c.id]);
    expect(rows.map((x) => x.points)).toEqual([5]);
    expect(await historyTotal(c.id)).toBe((await balance(c.id)).total_points);
  });

  it('A2: the same request applied twice counts once, even when both arrive together', async () => {
    const c = await child('Ben');
    const id = rid();
    const body = { points: 5, category: 'Kindness', request_id: id };
    const [r1, r2] = await Promise.all([
      api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body }),
      api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect([r1.json.duplicate, r2.json.duplicate].sort()).toEqual([false, true]);
    expect((await balance(c.id)).total_points).toBe(5);
    const again = await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body });
    expect(again.json.duplicate).toBe(true);
    expect((await balance(c.id)).total_points).toBe(5);
  });

  it('A3: a deduction past the balance stops at 0 and history records what was taken', async () => {
    const c = await child('Cal');
    await award(c.id, 7);
    const r = await award(c.id, -20, { category: 'Adjustment' });
    expect(r.status).toBe(200);
    expect(r.json.capped).toBe(true);
    expect(r.json.event.points).toBe(-7);
    expect((await balance(c.id)).total_points).toBe(0);
    expect(await historyTotal(c.id)).toBe(0);
    const none = await award(c.id, -1, { category: 'Adjustment' });
    expect(none.status).toBe(400);
    const { rowCount } = await ctx.pool.query('SELECT 1 FROM point_events WHERE child_id = $1', [c.id]);
    expect(rowCount).toBe(2);
  });

  it('A4: amounts must be whole numbers up to 1000 either way', async () => {
    const c = await child('Dee');
    for (const bad of [0, 1001, -1001, 1.5, '5', null]) {
      const r = await award(c.id, bad);
      expect(r.status, String(bad)).toBe(400);
    }
    expect((await award(c.id, 1000)).status).toBe(200);
    expect((await award(c.id, -1000, { category: 'Adjustment' })).status).toBe(200);
    expect((await award(c.id, 5, { request_id: 'not-a-uuid' })).status).toBe(400);
  });

  it('A5: another family cannot award to this child', async () => {
    const c = await child('Eve');
    const r = await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: G.token, body: { points: 5, category: 'x', request_id: rid() } });
    expect(r.status).toBe(404);
    expect((await balance(c.id)).total_points).toBe(0);
  });

  it('A6: editing a child cannot change its balance', async () => {
    const c = await child('Fay');
    await award(c.id, 10);
    const r = await api(ctx.base, 'PUT', `/api/children/${c.id}`, { token: F.token, body: { name: 'Fay', total_points: 500, weekly_points: 500, points_spent: 3, reward_stack: [] } });
    expect(r.status).toBe(200);
    expect((await balance(c.id)).total_points).toBe(10);
    // This week comes from history, whatever the request said.
    expect(r.json.week_points).toBe(10);
    const { rows } = await ctx.pool.query('SELECT reward_stack, points_spent FROM children WHERE id = $1', [c.id]);
    expect(rows[0]).toEqual({ reward_stack: [], points_spent: 0 });
  });

  it('A7: starting points appear in history; out-of-range starting points are refused', async () => {
    const c = await child('Gus', { total_points: 20, weekly_points: 20, points_spent: 99 });
    expect(c.total_points).toBe(20);
    expect(c.points_spent ?? 0).toBe(0);
    const { rows } = await ctx.pool.query('SELECT points, category FROM point_events WHERE child_id = $1', [c.id]);
    expect(rows).toEqual([{ points: 20, category: 'Starting points' }]);
    expect(await historyTotal(c.id)).toBe(20);
    const bad = await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Huge', total_points: 99999 } });
    expect(bad.status).toBe(400);
  });

  it('A8: spending uses the reward price from the database, not the request', async () => {
    const c = await child('Hal');
    await award(c.id, 60);
    const reward = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Big treat', cost_points: 50 } });
    const r = await api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: F.token, body: { reward_id: reward.json.id, reward_title: 'x', reward_cost: 1 } });
    expect(r.status).toBe(200);
    expect(r.json.redemption.reward_cost).toBe(50);
    expect((await balance(c.id)).total_points).toBe(10);
    expect(await historyTotal(c.id)).toBe(10);
  });

  it('A9: a reward for another child cannot be spent, and stacked points are not spendable twice', async () => {
    const c = await child('Ivy');
    const other = await child('Jon');
    await award(c.id, 40);
    const only = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Jon only', cost_points: 5, assigned_child_ids: [other.id] } });
    const r1 = await api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: F.token, body: { reward_id: only.json.id } });
    expect(r1.status).toBe(404);
    const r2 = await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: only.json.id } });
    expect(r2.status).toBe(404);

    const treat = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Treat', cost_points: 30 } });
    const s = await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: treat.json.id, reward_cost: 1 } });
    expect(s.status).toBe(200);
    const stack = (await ctx.pool.query('SELECT reward_stack FROM children WHERE id = $1', [c.id])).rows[0].reward_stack;
    expect(stack.map((x) => x.cost)).toEqual([30]);
    const small = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Small', cost_points: 20 } });
    const r3 = await api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: F.token, body: { reward_id: small.json.id } });
    expect(r3.status).toBe(400);
    expect((await balance(c.id)).total_points).toBe(40);
  });

  it('A10: the old routes that changed balances without history are gone', async () => {
    const c = await child('Kit');
    for (const path of ['adjust-points', 'track-spending']) {
      const r = await api(ctx.base, 'POST', `/api/children/${c.id}/${path}`, { token: F.token, body: { points: 50 } });
      expect(r.status, path).toBe(404);
    }
    for (const [m, path] of [['PUT', '/api/point_events/' + rid()], ['DELETE', '/api/point_events/' + rid()], ['PUT', '/api/redemptions/' + rid()], ['DELETE', '/api/redemptions/' + rid()]]) {
      const r = await api(ctx.base, m, path, { token: F.token, body: m === 'PUT' ? { points: 1 } : undefined });
      expect(r.status, `${m} ${path}`).toBe(405);
    }
    expect((await balance(c.id)).total_points).toBe(0);
  });

  it('A11: category points are whole numbers from 1 to 1000', async () => {
    const r = await api(ctx.base, 'POST', '/api/behavior-categories', { token: F.token, body: { name: 'Huge category', icon: '⭐', points: 5000 } });
    expect(r.status).toBe(200);
    expect(r.json.points).toBe(1000);
    const up = await api(ctx.base, 'PUT', `/api/behavior-categories/${r.json.id}`, { token: F.token, body: { points: 0 } });
    expect(up.json.points).toBe(1);
    const up2 = await api(ctx.base, 'PUT', `/api/behavior-categories/${r.json.id}`, { token: F.token, body: { points: 99999 } });
    expect(up2.json.points).toBe(1000);
  });

  it('A12: a replayed request returns what happened; a changed one under the same id is refused', async () => {
    const c = await child('Lou');
    await award(c.id, 4);
    const id = rid();
    const first = await award(c.id, -10, { category: 'Adjustment', request_id: id });
    expect(first.json.capped).toBe(true);
    const again = await award(c.id, -10, { category: 'Adjustment', request_id: id });
    expect(again.json).toMatchObject({ duplicate: true, capped: true });
    expect((await award(c.id, 999, { category: 'Adjustment', request_id: id })).status).toBe(409);
    expect((await award(c.id, -10, { category: 'Other', request_id: id })).status).toBe(409);
    expect((await balance(c.id)).total_points).toBe(0);
  });

  it('A13: one request id raced across two children awards once and never errors', async () => {
    for (let i = 0; i < 5; i++) {
      const a = await child(`Race a${i}`);
      const b = await child(`Race b${i}`);
      const id = rid();
      const [r1, r2] = await Promise.all([award(a.id, 5, { request_id: id }), award(b.id, 5, { request_id: id })]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const total = (await balance(a.id)).total_points + (await balance(b.id)).total_points;
      expect(total).toBe(5);
    }
  });

  it('A14: this week is shown floored at 0 when deductions outweigh this week\'s awards', async () => {
    const c = await child('Max');
    const first = await award(c.id, 10);
    // That award was last week; a deduction this week leaves the week at -8.
    await ctx.pool.query("UPDATE point_events SET created_date = now() - interval '8 days' WHERE id = $1", [first.json.event.id]);
    const r = await award(c.id, -8, { category: 'Adjustment' });
    expect(r.json.child.total_points).toBe(2);
    expect(r.json.week_points_after).toBe(0);
    const list = await api(ctx.base, 'GET', '/api/children', { token: F.token });
    expect(list.json.find((x) => x.id === c.id).week_points).toBe(0);
  });

  it('A15: confirming a stack charges today\'s prices, even for items saved before', async () => {
    const c = await child('Ned');
    await award(c.id, 100);
    const big = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Big', cost_points: 80 } });
    await ctx.pool.query('UPDATE children SET reward_stack = $1 WHERE id = $2',
      [JSON.stringify([{ rewardId: big.json.id, name: 'Big', cost: 1 }, { rewardId: rid(), name: 'Gone', cost: 1 }]), c.id]);
    const r = await api(ctx.base, 'POST', `/api/children/${c.id}/stack/confirm`, { token: F.token });
    expect(r.status).toBe(200);
    expect((await balance(c.id)).total_points).toBe(20);
    expect(await historyTotal(c.id)).toBe(20);
  });

  it('A16: stack remove validates its input and cannot undo a confirm', async () => {
    const c = await child('Oli');
    await award(c.id, 100);
    const t = await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'T', cost_points: 10 } });
    expect((await api(ctx.base, 'DELETE', `/api/children/${c.id}/stack/abc`, { token: F.token })).status).toBe(400);
    expect((await api(ctx.base, 'DELETE', '/api/children/not-a-uuid/stack/0', { token: F.token })).status).toBe(404);
    for (let i = 0; i < 8; i++) {
      await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: t.json.id } });
      await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: t.json.id } });
      await Promise.all([
        api(ctx.base, 'POST', `/api/children/${c.id}/stack/confirm`, { token: F.token }),
        api(ctx.base, 'DELETE', `/api/children/${c.id}/stack/0`, { token: F.token }),
      ]);
      const { rows } = await ctx.pool.query('SELECT reward_stack FROM children WHERE id = $1', [c.id]);
      // Either the confirm took both, or the remove ran first and confirm took the one left.
      expect(rows[0].reward_stack).toEqual([]);
    }
    expect(await historyTotal(c.id)).toBe((await balance(c.id)).total_points);
  });

  it('A17: weekly-reset is a harmless stub; nothing is ever reset', async () => {
    const c = await child('Pip', { total_points: 15 });
    await award(c.id, 4);
    const r = await api(ctx.base, 'POST', '/api/children/weekly-reset', { token: F.token });
    expect(r.json).toEqual({ reset: false });
    const list = await api(ctx.base, 'GET', '/api/children', { token: F.token });
    const row = list.json.find((x) => x.id === c.id);
    // Starting points are history but not this week's effort.
    expect([row.total_points, row.week_points]).toEqual([19, 4]);
  });
});
