// @vitest-environment node
// A2 step 3: quick-action cap (C2), reserved names (W5), spends that apply
// once per request id (C5, I0, I1), weekly target limits (E3).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!runDb)('A2 step 3: guards', () => {
  let ctx, F;
  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Guard family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const cats = async () => (await ctx.pool.query('SELECT id, name, is_quick_action FROM behavior_categories WHERE family_code = $1 ORDER BY sort_order', [F.code])).rows;
  const quickCount = async () => (await cats()).filter((c) => c.is_quick_action).length;
  const postCat = (body) => api(ctx.base, 'POST', '/api/behavior-categories', { token: F.token, body });
  const putCat = (id, body) => api(ctx.base, 'PUT', `/api/behavior-categories/${id}`, { token: F.token, body });

  it('C2: a new family starts at 4 quick points; a 5th is refused, also when two arrive together', async () => {
    expect(await quickCount()).toBe(4);
    expect((await postCat({ name: 'Fifth', is_quick_action: true })).status).toBe(422);
    const flagged = (await cats()).find((c) => c.is_quick_action);
    await putCat(flagged.id, { is_quick_action: false });
    const [a, b] = await Promise.all([postCat({ name: 'Race A', is_quick_action: true }), postCat({ name: 'Race B', is_quick_action: true })]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect(await quickCount()).toBe(4);
  });

  it('C2: at 4/4, editing an already-quick category is allowed; turning another one on is not', async () => {
    const all = await cats();
    const on = all.find((c) => c.is_quick_action);
    const off = all.find((c) => !c.is_quick_action);
    expect((await putCat(on.id, { is_quick_action: true, points: 6 })).status).toBe(200);
    const r = await putCat(off.id, { is_quick_action: true });
    expect(r.status).toBe(422);
    expect(r.json.error).toMatch(/up to 4/);
  });

  it('C2: a truthy non-boolean (1, "yes") can\'t turn on a 5th quick point', async () => {
    const off = (await cats()).find((c) => !c.is_quick_action);
    for (const v of [1, 'yes']) {
      expect((await putCat(off.id, { is_quick_action: v })).status, String(v)).toBe(422);
    }
    expect(await quickCount()).toBe(4);
  });

  it('W5: reserved names are refused for categories, any case or spacing', async () => {
    for (const name of ['Starting points', ' UNDO ', 'balance correction']) {
      expect((await postCat({ name })).status, name).toBe(422);
    }
    const c = (await cats())[0];
    expect((await putCat(c.id, { name: 'Undo' })).status).toBe(422);
  });

  const setup = async (balance = 50) => {
    const c = (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Spender' } })).json;
    await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body: { points: balance, category: 'Kindness', request_id: rid() } });
    const r1 = (await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Toy', cost_points: 10 } })).json;
    const r2 = (await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Book', cost_points: 7 } })).json;
    return { c, r1, r2 };
  };
  const balance = async (id) => (await ctx.pool.query('SELECT total_points FROM children WHERE id = $1', [id])).rows[0].total_points;
  const redeem = (cid, body) => api(ctx.base, 'POST', `/api/children/${cid}/redeem`, { token: F.token, body });

  it('I0: a retried spend applies once, even when both arrive together', async () => {
    const { c, r1 } = await setup();
    const id = rid();
    const [a, b] = await Promise.all([redeem(c.id, { reward_id: r1.id, request_id: id }), redeem(c.id, { reward_id: r1.id, request_id: id })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.json.duplicate, b.json.duplicate].sort()).toEqual([false, true]);
    expect(a.json.redemption.id).toBe(b.json.redemption.id);
    expect(await balance(c.id)).toBe(40);
    expect((await redeem(c.id, { reward_id: r1.id, request_id: id })).json.duplicate).toBe(true);
    expect(await balance(c.id)).toBe(40);
  });

  it('I0: the same id for a different reward, or one already used by an award, is refused', async () => {
    const { c, r1, r2 } = await setup();
    const id = rid();
    expect((await redeem(c.id, { reward_id: r1.id, request_id: id })).status).toBe(200);
    expect((await redeem(c.id, { reward_id: r2.id, request_id: id })).status).toBe(409);
    const awardId = rid();
    await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body: { points: 1, category: 'Kindness', request_id: awardId } });
    expect((await redeem(c.id, { reward_id: r1.id, request_id: awardId })).status).toBe(409);
    // And a spend id can't then be reused as an award.
    expect((await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body: { points: 1, category: 'Kindness', request_id: id } })).status).toBe(409);
    expect((await redeem(c.id, { reward_id: r1.id, request_id: 'not-a-uuid' })).status).toBe(400);
  });

  it('I0: the same id sent for two different children at once: one spend, one 409, never 500', async () => {
    const one = await setup();
    const two = await setup();
    const id = rid();
    const [a, b] = await Promise.all([
      redeem(one.c.id, { reward_id: one.r1.id, request_id: id }),
      redeem(two.c.id, { reward_id: two.r1.id, request_id: id }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await balance(one.c.id)) + (await balance(two.c.id))).toBe(90);
  });

  it('I1: a spend with no request id still works this release', async () => {
    const { c, r1 } = await setup();
    expect((await redeem(c.id, { reward_id: r1.id })).status).toBe(200);
    expect(await balance(c.id)).toBe(40);
  });

  it('I0: confirming a 2-item stack with a request id applies once on replay', async () => {
    const { c, r1, r2 } = await setup();
    for (const r of [r1, r2]) {
      expect((await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: r.id } })).status).toBe(200);
    }
    const id = rid();
    const first = await api(ctx.base, 'POST', `/api/children/${c.id}/stack/confirm`, { token: F.token, body: { request_id: id } });
    expect(first.status).toBe(200);
    expect(first.json.points_deducted).toBe(17);
    const again = await api(ctx.base, 'POST', `/api/children/${c.id}/stack/confirm`, { token: F.token, body: { request_id: id } });
    expect(again.status).toBe(200);
    expect(again.json.duplicate).toBe(true);
    expect(await balance(c.id)).toBe(33);
    const n = (await ctx.pool.query("SELECT count(*)::int n FROM redemptions WHERE child_id = $1", [c.id])).rows[0].n;
    expect(n).toBe(2);
  });

  it('E3: weekly target must be a whole number from 1 to 10,000', async () => {
    const c = (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Target' } })).json;
    for (const bad of [0, -5, 10001, 2.5, 'abc']) {
      expect((await api(ctx.base, 'PUT', `/api/children/${c.id}`, { token: F.token, body: { weekly_target: bad } })).status, String(bad)).toBe(400);
    }
    for (const ok of [1, '40', 10000]) {
      expect((await api(ctx.base, 'PUT', `/api/children/${c.id}`, { token: F.token, body: { weekly_target: ok } })).status, String(ok)).toBe(200);
    }
    expect((await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Big', weekly_target: 99999 } })).status).toBe(400);
    // 008: a target stored out of range before this release is brought inside it.
    await ctx.pool.query('UPDATE children SET weekly_target = 50000 WHERE id = $1', [c.id]);
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '008_weekly_target_range.sql'");
    const { runMigrations } = await import('../migrate.js');
    await runMigrations(ctx.pool, { log: () => {} });
    expect((await ctx.pool.query('SELECT weekly_target FROM children WHERE id = $1', [c.id])).rows[0].weekly_target).toBe(10000);
    expect((await api(ctx.base, 'PUT', `/api/children/${c.id}`, { token: F.token, body: { name: 'Renamed', weekly_target: 10000 } })).status).toBe(200);
  });
});
