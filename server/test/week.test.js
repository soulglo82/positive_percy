// @vitest-environment node
// A2 step 2: "this week" comes from earned history since Monday 00:00 in the
// family's timezone; the timezone is set safely; the streak uses local days.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!runDb)('A2 step 2: week, timezone, streak', () => {
  let ctx, F, G;
  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Week family');
    G = await makeFamily(ctx.base, 'Other family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const child = async (Fam, body = {}) => (await api(ctx.base, 'POST', '/api/children', { token: Fam.token, body: { name: 'Kid', ...body } })).json;
  const award = (Fam, id, points, extra = {}) =>
    api(ctx.base, 'POST', `/api/children/${id}/award`, { token: Fam.token, body: { points, category: 'Kindness', request_id: rid(), ...extra } });
  const setTz = (Fam, timezone, auto = false) => api(ctx.base, 'PUT', '/api/family/timezone', { token: Fam.token, body: { timezone, auto } });
  const weekOf = async (Fam, id) => (await api(ctx.base, 'GET', '/api/children', { token: Fam.token })).json.find((c) => c.id === id).week_points;
  const familyRow = async (Fam) => (await ctx.pool.query('SELECT timezone, last_active_date, current_streak FROM families WHERE family_code = $1', [Fam.code])).rows[0];

  for (const tz of ['Asia/Singapore', 'America/New_York']) {
    it(`C1: in ${tz}, an award at Monday 00:00:00 counts and one a second earlier does not`, async () => {
      await setTz(F, tz);
      const c = await child(F);
      const a = await award(F, c.id, 7);
      const b = await award(F, c.id, 5);
      await ctx.pool.query(
        `UPDATE point_events SET created_date = (date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2) WHERE id = $1`,
        [a.json.event.id, tz]);
      await ctx.pool.query(
        `UPDATE point_events SET created_date = (date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2) - interval '1 second' WHERE id = $1`,
        [b.json.event.id, tz]);
      expect(await weekOf(F, c.id)).toBe(7);
    });
  }

  it('starting points, corrections and spends do not change this week', async () => {
    const c = await child(F, { total_points: 20 });
    expect(await weekOf(F, c.id)).toBe(0);
    await award(F, c.id, 30);
    await ctx.pool.query("INSERT INTO point_events (child_id, points, category, family_code, kind) VALUES ($1, 9, 'Balance correction', $2, 'correction')", [c.id, F.code]);
    const reward = (await api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Toy', cost_points: 10 } })).json;
    const r = await api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: F.token, body: { reward_id: reward.id } });
    expect(r.status).toBe(200);
    expect(await weekOf(F, c.id)).toBe(30);
  });

  it('summary works out its own week and matches the children list', async () => {
    const c = await child(F);
    await award(F, c.id, 11);
    const s = await api(ctx.base, 'GET', '/api/summary?week_start=1999-01-01', { token: F.token });
    expect(s.status).toBe(200);
    const row = s.json.childStats.find((x) => x.id === c.id);
    expect(row.week_points).toBe(await weekOf(F, c.id));
    expect(row.positive_points).toBe(11);
    expect(new Date(s.json.weekStart).getTime()).toBeGreaterThan(new Date('2000-01-01').getTime());
  });

  it('W1: the app fills the timezone only when unset, never from UTC; Settings sets it; bad names are refused', async () => {
    await ctx.pool.query('UPDATE families SET timezone = NULL WHERE family_code = $1', [G.code]);
    expect((await setTz(G, 'UTC', true)).json.changed).toBe(false);
    expect((await familyRow(G)).timezone).toBeNull();
    expect((await setTz(G, 'Europe/London', true)).json).toEqual({ timezone: 'Europe/London', changed: true });
    expect((await setTz(G, 'Asia/Tokyo', true)).json.changed).toBe(false);
    expect((await familyRow(G)).timezone).toBe('Europe/London');
    expect((await setTz(G, 'Not/AZone')).status).toBe(400);
    expect((await setTz(G, 'posixrules')).status).toBe(400);
    expect((await setTz(G, 'Asia/Tokyo')).json).toEqual({ timezone: 'Asia/Tokyo', changed: true });
    // Another family is untouched.
    expect((await familyRow(F)).timezone).not.toBe('Asia/Tokyo');
    const get = await api(ctx.base, 'GET', '/api/family/timezone', { token: G.token });
    expect(get.json).toEqual({ timezone: 'Asia/Tokyo' });
  });

  it('W1: a new family takes the browser\'s timezone; a generic or unknown one is left unset', async () => {
    const mk = async (timezone) => {
      const r = await api(ctx.base, 'POST', '/api/family/create', { body: { family_name: 'T', timezone } });
      return (await ctx.pool.query('SELECT timezone FROM families WHERE family_code = $1', [r.json.family_code])).rows[0].timezone;
    };
    expect(await mk('Asia/Singapore')).toBe('Asia/Singapore');
    expect(await mk('UTC')).toBeNull();
    expect(await mk('Mars/Base')).toBeNull();
  });

  it('R1: changing the timezone recomputes the streak date from history', async () => {
    await setTz(F, 'Asia/Singapore');
    const c = await child(F);
    const a = await award(F, c.id, 3);
    // 07:30 Singapore today is 23:30 UTC yesterday.
    await ctx.pool.query(
      `UPDATE point_events SET created_date = ((now() AT TIME ZONE 'Asia/Singapore')::date + time '07:30') AT TIME ZONE 'Asia/Singapore' WHERE id = $1`,
      [a.json.event.id]);
    await setTz(F, 'America/New_York');
    await setTz(F, 'Asia/Singapore');
    const { rows } = await ctx.pool.query(
      `SELECT to_char((now() AT TIME ZONE 'Asia/Singapore')::date, 'YYYY-MM-DD') AS local_today`);
    expect((await familyRow(F)).last_active_date).toBe(rows[0].local_today);
  });

  it('streak days are the family\'s local days', async () => {
    await setTz(F, 'Asia/Singapore');
    const { rows } = await ctx.pool.query(
      `SELECT to_char((now() AT TIME ZONE 'Asia/Singapore')::date - 1, 'YYYY-MM-DD') AS y`);
    await ctx.pool.query('UPDATE families SET current_streak = 4, last_active_date = $1 WHERE family_code = $2', [rows[0].y, F.code]);
    const c = await child(F);
    const r = await award(F, c.id, 2);
    expect(r.json.streak.streak).toBe(5);
    const s = await api(ctx.base, 'GET', '/api/family/streak', { token: F.token });
    expect(s.json.streak).toBe(5);
  });

  it('a reserved category name is refused on award', async () => {
    const c = await child(F);
    for (const category of ['Starting points', ' balance CORRECTION ', 'Undo']) {
      expect((await award(F, c.id, 5, { category })).status, category).toBe(400);
    }
  });
});
