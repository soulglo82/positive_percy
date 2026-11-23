// @vitest-environment node
// V1-E (docs/engineering/V1-E-DESIGN.md §3): PUT /api/family/name writes the
// family's own name (the one the Family Report and auth/me show), only for
// the caller's family.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!hasDb)('V1-E: family name', () => {
  let ctx, F, G;
  const put = (fam, body) => api(ctx.base, 'PUT', '/api/family/name', { token: fam.token, body });
  const nameOf = async (fam) => (await ctx.pool.query('SELECT family_name FROM families WHERE family_code = $1', [fam.code])).rows[0].family_name;

  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'The Before Family');
    G = await makeFamily(ctx.base, 'The Other Family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('renames the caller\'s family, trimmed; auth/me and the export show it', async () => {
    const r = await put(F, { family_name: '  The Smiths  ' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ family_name: 'The Smiths' });
    expect(await nameOf(F)).toBe('The Smiths');
    const me = (await api(ctx.base, 'GET', `/api/auth/me?family_code=${F.code}`, { token: F.token })).json;
    expect(me.family.family_name).toBe('The Smiths');
    const exp = await api(ctx.base, 'GET', '/api/family/export?photos=exclude', { token: F.token });
    expect(exp.status).toBe(200);
    expect(exp.json.family.family_name).toBe('The Smiths');
  });

  it('only the caller\'s family changes (E3)', async () => {
    await put(G, { family_name: 'Gs' });
    expect(await nameOf(G)).toBe('Gs');
    expect(await nameOf(F)).toBe('The Smiths');
  });

  it('cuts to 100 characters (E2)', async () => {
    const r = await put(F, { family_name: 'x'.repeat(150) });
    expect(r.status).toBe(200);
    expect((await nameOf(F)).length).toBe(100);
  });

  it('cuts by characters, never splitting an emoji', async () => {
    const name = 'a'.repeat(99) + '🦊🦊';
    const r = await put(F, { family_name: name });
    expect(r.status).toBe(200);
    expect(await nameOf(F)).toBe('a'.repeat(99) + '🦊');
  });

  it('refuses empty, blank and non-string names, changing nothing (E1)', async () => {
    await put(F, { family_name: 'Kept' });
    for (const body of [{ family_name: '' }, { family_name: '   ' }, { family_name: 42 }, { family_name: ['a'] }, {}]) {
      const r = await put(F, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.error).toBe('Family name is required');
    }
    expect(await nameOf(F)).toBe('Kept');
  });

  it('needs a login; PUT /api/auth/me cannot set the family name', async () => {
    expect((await api(ctx.base, 'PUT', '/api/family/name', { body: { family_name: 'Nope' } })).status).toBe(401);
    await api(ctx.base, 'PUT', `/api/auth/me?family_code=${F.code}`, { token: F.token, body: { family_name: 'Sneaky' } });
    expect(await nameOf(F)).toBe('Kept');
  });
});
