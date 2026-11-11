// @vitest-environment node
// Batch C PR1: one-point defaults, user customization, and legacy preservation.
// These are integration tests against the same PostgreSQL init/migration path as production.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runDb)('Batch C PR1: one-point defaults', () => {
  let ctx, family;
  beforeAll(async () => {
    ctx = await startApp();
    family = await makeFamily(ctx.base, 'New default family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const cats = async () => {
    const r = await api(ctx.base, 'GET', '/api/behavior-categories', { token: family.token });
    expect(r.status).toBe(200);
    return r.json;
  };

  it('seeds eight behaviours with one point each; the four quick actions also use one', async () => {
    const list = await cats();
    expect(list).toHaveLength(8);
    expect(list.map(c => c.points)).toEqual(Array(8).fill(1));
    const quick = list.filter(c => c.is_quick_action);
    expect(quick).toHaveLength(4);
    expect(quick.every(c => c.points === 1)).toBe(true);
  });

  it('new custom behaviours default to one and can be customized independently', async () => {
    const created = await api(ctx.base, 'POST', '/api/behavior-categories', {
      token: family.token,
      body: { name: 'Reading' },
    });
    expect(created.status).toBe(200);
    expect(created.json.points).toBe(1);
    const updated = await api(ctx.base, 'PUT', `/api/behavior-categories/${created.json.id}`, {
      token: family.token, body: { points: 7 },
    });
    expect(updated.status).toBe(200);
    expect(updated.json.points).toBe(7);
    expect((await cats()).find(c => c.id === created.json.id).points).toBe(7);
  });

  it('database default is one but existing customized category values survive startup', async () => {
    const before = await cats();
    const kindness = before.find(c => c.name === 'Kindness');
    const changed = await api(ctx.base, 'PUT', `/api/behavior-categories/${kindness.id}`, {
      token: family.token, body: { points: 9 },
    });
    expect(changed.status).toBe(200);
    const { rows } = await ctx.pool.query(
      "INSERT INTO behavior_categories (family_code, name, sort_order) VALUES ($1, $2, $3) RETURNING points",
      [family.code, 'Default at SQL layer', 99]
    );
    expect(rows[0].points).toBe(1);
    const { initDb } = await import('../db.js');
    await initDb();
    expect((await cats()).find(c => c.id === kindness.id).points).toBe(9);
  });
});
