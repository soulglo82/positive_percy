// @vitest-environment node
// Batch C PR2: family-scoped portability, photo ownership and secret exclusion.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe.skipIf(!runDb)('Batch C PR2: download family data', () => {
  let ctx, A, B, childA, photoA, photoB;
  beforeAll(async () => {
    ctx = await startApp();
    A = await makeFamily(ctx.base, 'Portability A');
    B = await makeFamily(ctx.base, 'Portability B');

    const upload = async (fam) => {
      const r = await api(ctx.base, 'POST', '/api/upload', { token: fam.token, body: { data: PNG } });
      expect(r.status).toBe(200);
      return r.json.file_url;
    };
    [photoA, photoB] = await Promise.all([upload(A), upload(B)]);
    const a = await api(ctx.base, 'POST', '/api/children', { token: A.token, body: {
      name: 'A child', age: 9, avatar_url: photoA,
    } });
    const b = await api(ctx.base, 'POST', '/api/children', { token: B.token, body: {
      name: 'B child', age: 7, avatar_url: photoB,
    } });
    expect([a.status, b.status]).toEqual([200, 200]);
    childA = a.json;
    const award = await api(ctx.base, 'POST', `/api/children/${childA.id}/award`, {
      token: A.token, body: { points: 3, category: 'Kindness', request_id: crypto.randomUUID() },
    });
    expect(award.status).toBe(200);
    const bAward = await api(ctx.base, 'POST', `/api/children/${b.json.id}/award`, {
      token: B.token, body: { points: 100, category: 'Bravery', request_id: crypto.randomUUID() },
    });
    expect(bAward.status).toBe(200);
    expect((await api(ctx.base, 'POST', '/api/rewards', { token: A.token,
      body: { title: 'A treat', cost_points: 7 } })).status).toBe(200);
    expect((await api(ctx.base, 'POST', '/api/rewards', { token: B.token,
      body: { title: 'B secret treat', cost_points: 99 } })).status).toBe(200);
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const download = (fam, suffix = '') => api(ctx.base, 'GET', `/api/family/export${suffix}`, {
    token: fam?.token,
  });

  it('requires authentication and provides an attachment not cached by the browser', async () => {
    expect((await download()).status).toBe(401);
    const r = await download(A);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(r.headers.get('content-disposition')).toMatch(/attachment; filename/);
    expect(r.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('exports the full owned family dataset, including its own photo bytes', async () => {
    const r = await download(A);
    const d = r.json;
    expect(r.status).toBe(200);
    expect(d).toMatchObject({ format: 'positive-percy-family-export', version: 1 });
    expect(d.family.family_name).toBe('Portability A');
    expect(d.children.map(x => x.name)).toEqual(['A child']);
    expect(d.children[0].age).toBe(9);
    expect(d.behaviours).toHaveLength(8);
    expect(d.pointEvents.some(x => x.child_id === childA.id && x.points === 3)).toBe(true);
    expect(d.rewards.map(x => x.title)).toEqual(['A treat']);
    expect(d.photos).toHaveLength(1);
    expect(d.photos[0].data).toBe(PNG);
    expect(d.photoInformation).toMatchObject({ included: true, referencedCount: 1, includedCount: 1, unavailableCount: 0 });
    // Even though this is a backup of family data, the family code is the
    // login credential and never belongs inside the file.
    expect(r.text).not.toContain(A.token);
    expect(r.text).not.toContain(A.code);
    expect(r.text).not.toContain(B.code);
    expect(r.text).not.toContain('B secret treat');
    expect(r.text).not.toContain('B child');
    expect(r.text).not.toContain('"family_code"');
    expect(r.text).not.toContain('"request_id"');
  });

  it('only returns the requesting family, not another valid login session', async () => {
    const r = await download(B);
    expect(r.status).toBe(200);
    expect(r.json.family.family_name).toBe('Portability B');
    expect(r.json.children.map(x => x.name)).toEqual(['B child']);
    expect(r.json.photos).toHaveLength(1);
    expect(r.json.rewards.map(x => x.title)).toEqual(['B secret treat']);
    expect(r.text).not.toContain('A child');
    expect(r.text).not.toContain('A treat');
  });

  it('supports a smaller download without photos', async () => {
    const r = await download(A, '?photos=exclude');
    expect(r.status).toBe(200);
    expect(r.json.photos).toEqual([]);
    expect(r.json.photoInformation).toMatchObject({ included: false, unavailableCount: 1 });
  });

  it('includes legacy family-less history for owned children, never for someone else', async () => {
    const { rows: [other] } = await ctx.pool.query(
      "SELECT id FROM children WHERE family_code = $1 LIMIT 1", [B.code]
    );
    await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code, kind) VALUES ($1, 2, 'Old family history', NULL, 'award')",
      [childA.id]
    );
    await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code, kind) VALUES ($1, 2, 'Other family history', NULL, 'award')",
      [other.id]
    );
    const r = await download(A);
    expect(r.status).toBe(200);
    expect(r.json.pointEvents.some(x => x.category === 'Old family history')).toBe(true);
    expect(r.json.pointEvents.some(x => x.category === 'Other family history')).toBe(false);
  });

  it('does not include another family\'s photo even if a legacy row references its URL', async () => {
    // The current write guard refuses this; simulate a corrupted legacy row
    // to prove the export never follows cross-family image pointers.
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [photoB, childA.id]);
    const r = await download(A);
    expect(r.status).toBe(200);
    expect(r.json.photos).toHaveLength(0);
    expect(r.json.photoInformation).toMatchObject({ referencedCount: 1, unavailableCount: 1 });
    expect(r.text).not.toContain(PNG);
  });
});
