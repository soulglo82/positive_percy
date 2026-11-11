// @vitest-environment node
// Batch D PR2: behaviour icon keys.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runDb)('Batch D PR2: icon_key', () => {
  let ctx, F;
  beforeAll(async () => { ctx = await startApp(); F = await makeFamily(ctx.base, 'Icon family'); });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const cats = async () => (await api(ctx.base, 'GET', '/api/behavior-categories', { token: F.token })).json;

  it('a new family gets mapped keys for every default', async () => {
    const byName = Object.fromEntries((await cats()).map((c) => [c.name, c.icon_key]));
    expect(byName).toMatchObject({ Kindness: 'heart', Helpfulness: 'handshake', Bravery: 'shield', Resilience: 'mountain',
      Caring: 'hand-heart', Chores: 'brush', Homework: 'book-open', Adventurous: 'sparkles' });
  });

  it('create without a key gets circle; a bad key is refused; update sets a valid key', async () => {
    const a = await api(ctx.base, 'POST', '/api/behavior-categories', { token: F.token, body: { name: 'Tidy room' } });
    expect(a.status).toBe(200);
    expect(a.json.icon_key).toBe('circle');
    for (const bad of ['Heart', '⭐', '', 'constructor', 7]) {
      expect((await api(ctx.base, 'POST', '/api/behavior-categories', { token: F.token, body: { name: `X${bad}`, icon_key: bad } })).status).toBe(422);
      expect((await api(ctx.base, 'PUT', `/api/behavior-categories/${a.json.id}`, { token: F.token, body: { icon_key: bad } })).status).toBe(422);
    }
    const u = await api(ctx.base, 'PUT', `/api/behavior-categories/${a.json.id}`, { token: F.token, body: { icon_key: 'brush' } });
    expect(u.status).toBe(200);
    expect((await cats()).find((c) => c.id === a.json.id).icon_key).toBe('brush');
  });

  it('migration 011 maps emoji with and without U+FE0F; unknown stays circle; boot does not change keys', async () => {
    const ins = (name, icon) => ctx.pool.query(
      "INSERT INTO behavior_categories (family_code, name, icon, sort_order, icon_key) VALUES ($1, $2, $3, 99, 'circle') RETURNING id", [F.code, name, icon]);
    const star = (await ins('Old star', '⭐️')).rows[0].id;
    const plain = (await ins('Old book', '📚')).rows[0].id;
    const odd = (await ins('Old odd', '🚀')).rows[0].id;
    const fs = await import('fs');
    const sql = fs.readFileSync(new URL('../migrations/011_category_icon_key.sql', import.meta.url), 'utf8');
    await ctx.pool.query(sql);
    const key = async (id) => (await ctx.pool.query('SELECT icon_key FROM behavior_categories WHERE id = $1', [id])).rows[0].icon_key;
    expect(await key(star)).toBe('star');
    expect(await key(plain)).toBe('book-open');
    expect(await key(odd)).toBe('circle');
    // A parent's later choice is not overwritten by running it again.
    await ctx.pool.query("UPDATE behavior_categories SET icon_key = 'music' WHERE id = $1", [star]);
    await ctx.pool.query(sql);
    expect(await key(star)).toBe('music');
    const { initDb } = await import('../db.js');
    await initDb();
    expect(await key(star)).toBe('music');
  });
});
