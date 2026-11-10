// @vitest-environment node
// Batch B: streak is earned by awarding, not by opening the app; age is capped.
// Design: claude/batch-b-polish-design.md.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().split('T')[0];

describe.skipIf(!runDb)('batch B: streak and age', () => {
  let ctx, shared;
  beforeAll(async () => {
    ctx = await startApp();
    // One family, reset before each case: family creation is rate limited.
    shared = await makeFamily(ctx.base, 'Streak family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const setup = async () => {
    const F = shared;
    await ctx.pool.query('UPDATE families SET current_streak = 0, last_active_date = NULL, longest_streak = 0 WHERE family_code = $1', [F.code]);
    const c = await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Kid' } });
    expect(c.status).toBe(200);
    return { F, childId: c.json.id };
  };
  const award = (F, id, points) =>
    api(ctx.base, 'POST', `/api/children/${id}/award`, { token: F.token, body: { points, category: 'Kindness', request_id: rid() } });
  const family = async (code) =>
    (await ctx.pool.query('SELECT current_streak, last_active_date, longest_streak FROM families WHERE family_code = $1', [code])).rows[0];

  it('B1: a new family reads a streak of 0, and reading it many times changes nothing', async () => {
    const { F } = await setup('Fresh');
    for (let i = 0; i < 3; i++) {
      const g = await api(ctx.base, 'GET', '/api/family/streak', { token: F.token });
      expect(g.status).toBe(200);
      expect(g.json.streak).toBe(0);
      const p = await api(ctx.base, 'POST', '/api/family/check-streak', { token: F.token });
      expect(p.status).toBe(200);
      expect(p.json.streak).toBe(0);
      expect(p.json.updated).toBe(false);
    }
    const f = await family(F.code);
    expect(f.current_streak).toBe(0);
    expect(f.last_active_date).toBeNull();
  });

  it('B2: the first award of the day starts the streak; more awards that day leave it at 1', async () => {
    const { F, childId } = await setup('Daily');
    const r1 = await award(F, childId, 5);
    expect(r1.status).toBe(200);
    expect(r1.json.streak).toEqual({ streak: 1, milestone: false });
    const r2 = await award(F, childId, 3);
    expect(r2.json.streak.streak).toBe(1);
    const f = await family(F.code);
    expect(f.current_streak).toBe(1);
    expect(f.last_active_date).toBe(day(0));
  });

  it('B3: an award the day after continues the streak; a gap restarts it at 1', async () => {
    const { F, childId } = await setup('Continuing');
    await ctx.pool.query('UPDATE families SET current_streak = 4, last_active_date = $1, longest_streak = 4 WHERE family_code = $2', [day(1), F.code]);
    expect((await award(F, childId, 1)).json.streak.streak).toBe(5);

    const G = await setup('Gap');
    await ctx.pool.query('UPDATE families SET current_streak = 9, last_active_date = $1, longest_streak = 9 WHERE family_code = $2', [day(2), G.F.code]);
    // Before the award, a lapsed streak reads 0 rather than the stale 9.
    expect((await api(ctx.base, 'GET', '/api/family/streak', { token: G.F.token })).json.streak).toBe(0);
    expect((await award(G.F, G.childId, 1)).json.streak.streak).toBe(1);
    const g = await family(G.F.code);
    expect(g.longest_streak).toBe(9); // longest is kept
  });

  it('B4: reaching 7 days is a milestone, once', async () => {
    const { F, childId } = await setup('Milestone');
    await ctx.pool.query('UPDATE families SET current_streak = 6, last_active_date = $1 WHERE family_code = $2', [day(1), F.code]);
    expect((await award(F, childId, 2)).json.streak).toEqual({ streak: 7, milestone: true });
    expect((await award(F, childId, 2)).json.streak.milestone).toBe(false);
  });

  it('B5: a deduction does not count towards the streak', async () => {
    const { F, childId } = await setup('Deduct');
    await award(F, childId, 5);
    await ctx.pool.query('UPDATE families SET current_streak = 2, last_active_date = $1 WHERE family_code = $2', [day(1), F.code]);
    const r = await award(F, childId, -2);
    expect(r.status).toBe(200);
    expect(r.json.streak).toBeNull();
    expect((await family(F.code)).last_active_date).toBe(day(1));
  });

  it('B7: the longest streak grows with the streak', async () => {
    const { F, childId } = await setup('Longest');
    await ctx.pool.query('UPDATE families SET current_streak = 3, last_active_date = $1, longest_streak = 3 WHERE family_code = $2', [day(1), F.code]);
    await award(F, childId, 1);
    expect((await family(F.code)).longest_streak).toBe(4);
  });

  it('B8: a streak last earned yesterday still reads as live before today\'s first award', async () => {
    const { F } = await setup('Yesterday');
    await ctx.pool.query('UPDATE families SET current_streak = 6, last_active_date = $1 WHERE family_code = $2', [day(1), F.code]);
    expect((await api(ctx.base, 'GET', '/api/family/streak', { token: F.token })).json.streak).toBe(6);
  });

  it('B9: a replayed award records nothing and returns no streak', async () => {
    const { F, childId } = await setup('Replay');
    const body = { points: 5, category: 'Kindness', request_id: rid() };
    await api(ctx.base, 'POST', `/api/children/${childId}/award`, { token: F.token, body });
    await ctx.pool.query('UPDATE families SET current_streak = 1, last_active_date = $1 WHERE family_code = $2', [day(1), F.code]);
    const again = await api(ctx.base, 'POST', `/api/children/${childId}/award`, { token: F.token, body });
    expect(again.json.duplicate).toBe(true);
    expect(again.json.streak).toBeUndefined();
    expect((await family(F.code)).last_active_date).toBe(day(1));
  });

  it('B10: a stored date later than today is never moved back', async () => {
    const { F, childId } = await setup('Ahead');
    await ctx.pool.query('UPDATE families SET current_streak = 12, last_active_date = $1, longest_streak = 12 WHERE family_code = $2', [day(-1), F.code]);
    expect((await award(F, childId, 1)).json.streak.streak).toBe(12);
    const f = await family(F.code);
    expect([f.current_streak, f.last_active_date]).toEqual([12, day(-1)]);
  });

  it('B6: age is stored only for 1 to 17; anything else is stored as empty', async () => {
    const { F, childId } = await setup('Ages');
    const put = (age) => api(ctx.base, 'PUT', `/api/children/${childId}`, { token: F.token, body: { age } });
    const stored = async () => (await ctx.pool.query('SELECT age FROM children WHERE id = $1', [childId])).rows[0].age;
    for (const [input, want] of [[7, 7], ['12', 12], [1, 1], [17, 17], [0, null], [18, null], [-3, null], ['abc', null], [null, null], [9.7, 9]]) {
      const r = await put(input);
      expect(r.status, `age ${input}`).toBe(200);
      expect(await stored(), `age ${input}`).toBe(want);
    }
    const created = await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Old', age: 40 } });
    expect(created.status).toBe(200);
    expect(created.json.age).toBeNull();
  });
});
