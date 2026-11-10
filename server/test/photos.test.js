// @vitest-environment node
// P-1: a photo is deleted when nothing in its family uses it any more, and a
// family can never delete or borrow another family's photo.
// Design: claude/p1-photo-cleanup-design.md.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';
import { uploadIdOf, UPLOAD_URL_PATTERN, UPLOAD_REF_COLUMNS, backfillUploadOwners } from '../uploads.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const U = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('uploadIdOf (parser)', () => {
  it('T8: relative, absolute and uppercase forms parse the same; anything else does not', () => {
    expect(uploadIdOf(`/api/uploads/${U}`)).toBe(U);
    expect(uploadIdOf(`https://positivepercy.up.railway.app/api/uploads/${U}`)).toBe(U);
    expect(uploadIdOf(`/api/uploads/${U.toUpperCase()}`)).toBe(U);
    for (const v of [`/api/uploads/${U}/x`, `/api/uploads/${U}?q=1`, `evil/api/uploads/${U}`, '/api/uploads/------------------------------------',
      'data:image/png;base64,AAAA', '', null, undefined, 42, `/api/uploads/${U.slice(0, -1)}`]) {
      expect(uploadIdOf(v), String(v)).toBeNull();
    }
  });
});

describe.skipIf(!runDb)('P-1: photo clean-up', () => {
  let ctx, X, Y;
  beforeAll(async () => {
    ctx = await startApp();
    X = await makeFamily(ctx.base, 'Photo X');
    Y = await makeFamily(ctx.base, 'Photo Y');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const upload = async (F) => {
    const r = await api(ctx.base, 'POST', '/api/upload', { token: F.token, body: { data: PNG } });
    expect(r.status).toBe(200);
    return r.json.file_url;
  };
  const exists = async (url) => (await api(ctx.base, 'GET', url)).status === 200;
  const child = (F, body) => api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Kid', ...body } });
  const reward = (F, body) => api(ctx.base, 'POST', '/api/rewards', { token: F.token, body: { title: 'Prize', cost_points: 5, ...body } });
  const put = (F, entity, id, body) => api(ctx.base, 'PUT', `/api/${entity}/${id}`, { token: F.token, body });
  const del = (F, entity, id) => api(ctx.base, 'DELETE', `/api/${entity}/${id}`, { token: F.token });

  it('JS and SQL agree on what is an upload URL', async () => {
    const inputs = [`/api/uploads/${U}`, `https://h.example/api/uploads/${U.toUpperCase()}`, `/api/uploads/${U}/x`, `evil/api/uploads/${U}`, 'data:image/png;base64,AA', ''];
    for (const v of inputs) {
      const { rows } = await ctx.pool.query("SELECT lower((regexp_match($1, $2, 'i'))[1]) AS id", [v, UPLOAD_URL_PATTERN]);
      expect(rows[0].id, v).toBe(uploadIdOf(v));
    }
  });

  it('T1: an upload is stamped with the uploader\'s family', async () => {
    const url = await upload(X);
    const { rows } = await ctx.pool.query('SELECT family_code FROM uploads WHERE id = $1', [uploadIdOf(url)]);
    expect(rows[0].family_code).toBe(X.code);
  });

  it('T2: deleting a child deletes its photo', async () => {
    const url = await upload(X);
    const c = await child(X, { avatar_url: url });
    expect(c.status).toBe(200);
    expect(await exists(url)).toBe(true);
    expect((await del(X, 'children', c.json.id)).status).toBe(200);
    expect(await exists(url)).toBe(false);
  });

  it('T3: deleting a reward deletes its photo', async () => {
    const url = await upload(X);
    const r = await reward(X, { image_url: url });
    expect(r.status).toBe(200);
    expect((await del(X, 'rewards', r.json.id)).status).toBe(200);
    expect(await exists(url)).toBe(false);
  });

  it('T4: a photo shared by a child and a reward stays until the last one goes', async () => {
    // Iterates the reference columns so a new one can't be forgotten.
    expect(Object.keys(UPLOAD_REF_COLUMNS).sort()).toEqual(['children', 'rewards']);
    const url = await upload(X);
    const c = await child(X, { avatar_url: url });
    const r = await reward(X, { image_url: url });
    await del(X, 'children', c.json.id);
    expect(await exists(url)).toBe(true);
    await del(X, 'rewards', r.json.id);
    expect(await exists(url)).toBe(false);
  });

  it('T5: replacing a photo deletes the old one; re-sending keeps it; clearing deletes it', async () => {
    const a = await upload(X);
    const b = await upload(X);
    const c = (await child(X, { avatar_url: a })).json;
    expect((await put(X, 'children', c.id, { name: 'Renamed', avatar_url: a })).status).toBe(200);
    expect(await exists(a)).toBe(true);
    expect((await put(X, 'children', c.id, { avatar_url: b })).status).toBe(200);
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(true);
    expect((await put(X, 'children', c.id, { avatar_url: '' })).status).toBe(200);
    expect(await exists(b)).toBe(false);
  });

  it('T5b: an edit that does not mention the photo releases nothing', async () => {
    const url = await upload(X);
    const r = (await reward(X, { image_url: url })).json;
    expect((await put(X, 'rewards', r.id, { visible_to_child: false })).status).toBe(200);
    expect(await exists(url)).toBe(true);
  });

  it('T6: another family\'s photo is refused on create and update, for children and rewards, and stays', async () => {
    const theirs = await upload(Y);
    expect((await child(X, { avatar_url: theirs })).status).toBe(404);
    expect((await reward(X, { image_url: theirs })).status).toBe(404);
    const c = (await child(X, {})).json;
    const r = (await reward(X, {})).json;
    expect((await put(X, 'children', c.id, { avatar_url: theirs })).status).toBe(404);
    expect((await put(X, 'rewards', r.id, { image_url: theirs })).status).toBe(404);
    expect(await exists(theirs)).toBe(true);
  });

  it('T6b: even if a row already points at another family\'s photo, deleting the row keeps the photo', async () => {
    const theirs = await upload(Y);
    const c = (await child(X, {})).json;
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [theirs, c.id]);
    expect((await del(X, 'children', c.id)).status).toBe(200);
    expect(await exists(theirs)).toBe(true);
  });

  it('B2: a child on an unowned legacy photo can still be renamed with the photo re-sent', async () => {
    const url = await upload(X);
    await ctx.pool.query('UPDATE uploads SET family_code = NULL WHERE id = $1', [uploadIdOf(url)]);
    const c = (await child(X, {})).json;
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [url, c.id]);
    const r = await put(X, 'children', c.id, { name: 'Still editable', avatar_url: url, weekly_target: 40 });
    expect(r.status).toBe(200);
    // And an unowned photo is never deleted, even by its only user.
    expect((await del(X, 'children', c.id)).status).toBe(200);
    expect(await exists(url)).toBe(true);
  });

  it('a failed update keeps the old photo (release is inside the transaction)', async () => {
    const a = await upload(X);
    const b = await upload(X);
    const c = (await child(X, { avatar_url: a })).json;
    // weekly_target is an INTEGER column; a non-number makes the UPDATE fail after the lock.
    const r = await put(X, 'children', c.id, { avatar_url: b, weekly_target: 'not a number' });
    expect(r.status).not.toBe(200);
    expect(await exists(a)).toBe(true);
    const { rows } = await ctx.pool.query('SELECT avatar_url FROM children WHERE id = $1', [c.id]);
    expect(rows[0].avatar_url).toBe(a);
  });

  it('T7: backfill stamps uploads used by exactly one family and leaves shared or family-less ones; twice is the same', async () => {
    const mk = async () => (await ctx.pool.query(
      "INSERT INTO uploads (data, content_type) VALUES ($1, 'image/png') RETURNING id::text AS id", [PNG])).rows[0].id;
    const solo = await mk(); const shared = await mk(); const orphan = await mk(); const legacyRow = await mk(); const absolute = await mk();
    const cx = (await child(X, {})).json; const cy = (await child(Y, {})).json; const cx2 = (await child(X, {})).json;
    const rx = (await reward(X, {})).json;
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [`/api/uploads/${solo}`, cx.id]);
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [`/api/uploads/${shared}`, cy.id]);
    await ctx.pool.query('UPDATE rewards SET image_url = $1 WHERE id = $2', [`/api/uploads/${shared}`, rx.id]);
    await ctx.pool.query('UPDATE children SET avatar_url = $1 WHERE id = $2', [`https://h.example/api/uploads/${absolute.toUpperCase()}`, cx2.id]);
    const legacy = (await child(X, {})).json;
    await ctx.pool.query('UPDATE children SET avatar_url = $1, family_code = NULL WHERE id = $2', [`/api/uploads/${legacyRow}`, legacy.id]);
    const owners = async () => Object.fromEntries((await ctx.pool.query(
      'SELECT id::text AS id, family_code FROM uploads WHERE id = ANY($1::uuid[])', [[solo, shared, orphan, legacyRow, absolute]])).rows.map((r) => [r.id, r.family_code]));
    for (let i = 0; i < 2; i++) {
      const client = await ctx.pool.connect();
      try { await backfillUploadOwners(client); } finally { client.release(); }
      const o = await owners();
      expect(o[solo]).toBe(X.code);
      expect(o[absolute]).toBe(X.code);
      expect(o[shared]).toBeNull();
      expect(o[orphan]).toBeNull();
      expect(o[legacyRow]).toBeNull();
    }
  });
});
