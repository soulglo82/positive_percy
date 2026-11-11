// @vitest-environment node
// Batch D v0.5: each child keeps one stored colour.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runDb)('child colours', () => {
  let ctx;
  beforeAll(async () => { ctx = await startApp(); });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const add = async (F, name, extra = {}) => (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name, ...extra } })).json;

  it('new children get 0, 1, 2 in turn', async () => {
    const F = await makeFamily(ctx.base, 'Colours A');
    const a = await add(F, 'A'); const b = await add(F, 'B'); const c = await add(F, 'C');
    expect([a.colour_index, b.colour_index, c.colour_index]).toEqual([0, 1, 2]);
  });

  it('deleting a child keeps the others; the next child takes the freed colour', async () => {
    const F = await makeFamily(ctx.base, 'Colours B');
    const a = await add(F, 'A'); const b = await add(F, 'B'); const c = await add(F, 'C');
    expect((await api(ctx.base, 'DELETE', `/api/children/${a.id}`, { token: F.token })).status).toBe(200);
    const list = (await api(ctx.base, 'GET', '/api/children', { token: F.token })).json;
    expect(list.find((x) => x.id === b.id).colour_index).toBe(1);
    expect(list.find((x) => x.id === c.id).colour_index).toBe(2);
    expect((await add(F, 'D')).colour_index).toBe(0);
  });

  it('a seventh child wraps; colours stay in 0-5', async () => {
    const F = await makeFamily(ctx.base, 'Colours C');
    const got = [];
    for (let i = 0; i < 7; i++) got.push((await add(F, `K${i}`)).colour_index);
    expect(got.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(got[6]).toBeGreaterThanOrEqual(0);
    expect(got[6]).toBeLessThanOrEqual(5);
  });

  it('a child left with no colour (older server during a deploy) gets one before the next child', async () => {
    const F = await makeFamily(ctx.base, 'Colours F');
    const a = await add(F, 'A'); const b = await add(F, 'B');
    await ctx.pool.query('UPDATE children SET colour_index = NULL WHERE id = $1', [b.id]);
    const c = await add(F, 'C');
    const { rows } = await ctx.pool.query('SELECT id, colour_index FROM children WHERE family_code = $1', [F.code]);
    const got = Object.fromEntries(rows.map((r) => [r.id, r.colour_index]));
    expect(got[a.id]).toBe(0);
    expect(got[b.id]).toBe(1);
    expect(c.colour_index).toBe(2);
  });

  it('the app cannot set or change a colour', async () => {
    const F = await makeFamily(ctx.base, 'Colours D');
    const a = await add(F, 'A', { colour_index: 4 });
    expect(a.colour_index).toBe(0);
    await api(ctx.base, 'PUT', `/api/children/${a.id}`, { token: F.token, body: { colour_index: 5 } });
    const list = (await api(ctx.base, 'GET', '/api/children', { token: F.token })).json;
    expect(list[0].colour_index).toBe(0);
  });

  it('010 on existing rows: colours follow the order children were added, per family', async () => {
    const F = await makeFamily(ctx.base, 'Colours E');
    const a = await add(F, 'A'); const b = await add(F, 'B');
    await ctx.pool.query("UPDATE children SET colour_index = NULL, created_date = CASE WHEN id = $1 THEN NOW() ELSE NOW() - INTERVAL '1 day' END WHERE family_code = $2", [a.id, F.code]);
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '010_child_colour.sql'");
    const { runMigrations } = await import('../migrate.js');
    await runMigrations(ctx.pool, { log: () => {} });
    const { rows } = await ctx.pool.query('SELECT id, colour_index FROM children WHERE family_code = $1', [F.code]);
    expect(rows.find((r) => r.id === b.id).colour_index).toBe(0);
    expect(rows.find((r) => r.id === a.id).colour_index).toBe(1);
  });
});
