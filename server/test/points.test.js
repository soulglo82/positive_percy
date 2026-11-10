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
    expect(await balance(c.id)).toEqual({ total_points: 10, weekly_points: 10 });
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
  });
});
