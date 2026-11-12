// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startApp, stopApp, api, makeFamily } from './harness.js';
// Import maintenance after startApp initialises the disposable Postgres URL.
let purgeExpiredFamilies, purgeIsEnabled, registerErasureRegistry;

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const flags = [
  'PERCY_FAMILY_DELETION_ENABLED',
  'PERCY_FAMILY_PURGE_ENABLED',
  'PERCY_RESTORE_DRILL_VERIFIED',
  'PERCY_DELETION_CRON_VERIFIED',
];

describe.skipIf(!hasDb)('Batch C: 7-day family deletion and recovery', () => {
  let ctx, A, B, childA, childB, photo, legacyPhoto, otherLegacyPhoto, deletedToken, restoredToken;
  const old = Object.fromEntries(flags.map(k => [k, process.env[k]]));
  beforeAll(async () => {
    for (const f of flags) process.env[f] = 'true';
    ctx = await startApp();
    ({ purgeExpiredFamilies, purgeIsEnabled } = await import('../purgeDeleted.js'));
    ({ registerErasureRegistry } = await import('../routes.js'));
    // Test-only adapter: production intentionally has no registry until R2
    // receipts and pre-serve disaster restore replay are implemented.
    registerErasureRegistry({
      recordPurgeReceipt: async () => ({ confirmed: true, id: 'isolated-test' }),
      replayBeforeRestore: async () => true,
    });
    A = await makeFamily(ctx.base, 'Deleted family');
    B = await makeFamily(ctx.base, 'Healthy family');
    const a = await api(ctx.base, 'POST', '/api/children', {
      token: A.token, body: { name: 'Child to delete' },
    });
    const b = await api(ctx.base, 'POST', '/api/children', {
      token: B.token, body: { name: 'Another child' },
    });
    expect([a.status, b.status]).toEqual([200, 200]);
    childA = a.json; childB = b.json;
    const body = { points: 3, category: 'Kindness', request_id: crypto.randomUUID() };
    expect((await api(ctx.base, 'POST', `/api/children/${childA.id}/award`, {
      token: A.token, body,
    })).status).toBe(200);
    const pixels = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const upload = await api(ctx.base, 'POST', '/api/upload', { token: A.token, body: { data: pixels } });
    expect(upload.status).toBe(200);
    photo = upload.json.file_url;
    expect((await api(ctx.base, 'PUT', `/api/children/${childA.id}`, {
      token: A.token, body: { avatar_url: photo },
    })).status).toBe(200);
  });
  afterAll(async () => {
    if (registerErasureRegistry) registerErasureRegistry(null);
    if (ctx) await stopApp(ctx);
    for (const flag of flags) {
      if (old[flag] === undefined) delete process.env[flag];
      else process.env[flag] = old[flag];
    }
  });

  const requestDeletion = (token, confirm) => api(ctx.base, 'POST', '/api/family/request-deletion', {
    token, body: { confirmation: confirm },
  });

  it('remains inaccessible when any launch safeguard is missing', async () => {
    expect(purgeIsEnabled({})).toBe(false);
    delete process.env.PERCY_DELETION_CRON_VERIFIED;
    expect((await api(ctx.base, 'GET', '/api/family/deletion-capability')).json.enabled).toBe(false);
    expect((await requestDeletion(A.token, A.code)).status).toBe(404);
    process.env.PERCY_DELETION_CRON_VERIFIED = 'true';
    expect((await api(ctx.base, 'GET', '/api/family/deletion-capability')).json.enabled).toBe(true);
  });

  it('rejects an incorrect family confirmation without changing state', async () => {
    expect((await requestDeletion(A.token, B.code)).status).toBe(400);
    expect((await api(ctx.base, 'GET', '/api/auth/me', { token: A.token })).status).toBe(200);
  });

  it('locks all APIs and WebSockets immediately, but preserves recoverable family data', async () => {
    const socket = new WebSocket(ctx.base.replace('http', 'ws') + '/ws');
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    socket.send(JSON.stringify({ type: 'join', token: A.token }));
    // An authenticated request through the same token is still valid.
    await new Promise(resolve => setTimeout(resolve, 80));
    const closed = new Promise(resolve => socket.once('close', resolve));
    const requested = await requestDeletion(A.token, A.code);
    expect(requested.status).toBe(200);
    expect(requested.json.deletion_pending).toBe(true);
    const deadline = new Date(requested.json.due_at).getTime() - Date.now();
    expect(deadline).toBeGreaterThan(6 * 86400000);
    expect(deadline).toBeLessThan(8 * 86400000);
    expect(await closed).toBe(4403);
    expect((await api(ctx.base, 'GET', '/api/auth/me', { token: A.token })).status).toBe(403);
    expect((await api(ctx.base, 'GET', '/api/children', { token: A.token })).status).toBe(403);
    expect((await api(ctx.base, 'POST', `/api/children/${childA.id}/award`, {
      token: A.token, body: { points: 10, category: 'Other', request_id: crypto.randomUUID() },
    })).status).toBe(403);
    const join = await api(ctx.base, 'POST', '/api/family/join', { body: { family_code: A.code } });
    expect(join.status).toBe(409);
    expect(join.json.deletion_pending).toBe(true);
    const photoRes = await fetch(ctx.base + photo);
    expect(photoRes.status).toBe(404);
    expect((await api(ctx.base, 'GET', '/api/children', { token: B.token })).status).toBe(200);
  });

  it('recovers the same child, balance and photo, but leaves all previous JWTs revoked', async () => {
    const restored = await api(ctx.base, 'POST', '/api/family/restore', {
      body: { family_code: A.code },
    });
    expect(restored.status).toBe(200);
    restoredToken = restored.json.token;
    expect(restoredToken).not.toBe(A.token);
    expect((await api(ctx.base, 'GET', '/api/auth/me', { token: A.token })).status).toBe(401);
    expect((await api(ctx.base, 'GET', '/api/auth/me', { token: restoredToken })).status).toBe(200);
    const kids = await api(ctx.base, 'GET', '/api/children', { token: restoredToken });
    expect(kids.json.find(c => c.id === childA.id).total_points).toBe(3);
    const photoRes = await fetch(ctx.base + photo);
    expect(photoRes.status).toBe(200);
    expect(photoRes.headers.get('cache-control')).toMatch(/no-store/);
    expect((await api(ctx.base, 'POST', '/api/family/join', {
      body: { family_code: A.code },
    })).status).toBe(200);
  });

  it('records a formerly owned legacy photo without deleting another family\'s assets', async () => {
    const pixels = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const up = await api(ctx.base, 'POST', '/api/upload', {
      token: restoredToken, body: { data: pixels },
    });
    expect(up.status).toBe(200);
    const reward = await api(ctx.base, 'POST', '/api/rewards', {
      token: restoredToken, body: { title: 'Old family photo', cost_points: 3, image_url: up.json.file_url },
    });
    expect(reward.status).toBe(200);
    const id = up.json.file_url.split('/').at(-1);
    legacyPhoto = up.json.file_url;
    await ctx.pool.query('UPDATE uploads SET family_code = NULL WHERE id = $1', [id]);
    expect((await ctx.pool.query('SELECT 1 FROM uploads WHERE id = $1', [id])).rowCount).toBe(1);
    expect((await fetch(ctx.base + legacyPhoto)).status).toBe(200);

    // Another family's ownerless legacy photo must still work while the
    // deleted family is inaccessible.
    const other = await api(ctx.base, 'POST', '/api/upload', {
      token: B.token, body: { data: pixels },
    });
    expect(other.status).toBe(200);
    otherLegacyPhoto = other.json.file_url;
    const theirs = await api(ctx.base, 'POST', '/api/rewards', {
      token: B.token, body: {
        title: 'Other family legacy reward', cost_points: 3, image_url: otherLegacyPhoto,
      },
    });
    expect(theirs.status).toBe(200);
    await ctx.pool.query('UPDATE uploads SET family_code = NULL WHERE id = $1', [
      otherLegacyPhoto.split('/').at(-1),
    ]);
  });

  it('prevents recovery after expiry and only purges when explicitly executed', async () => {
    const requested = await requestDeletion(restoredToken, A.code);
    expect(requested.status).toBe(200);
    deletedToken = restoredToken;
    expect((await fetch(ctx.base + legacyPhoto)).status).toBe(404);
    expect((await fetch(ctx.base + otherLegacyPhoto)).status).toBe(200);
    await ctx.pool.query(`
      UPDATE families
      SET deletion_requested_at = NOW() - INTERVAL '8 days',
          deletion_due_at = NOW() - INTERVAL '1 day'
      WHERE family_code = $1
    `, [A.code]);
    expect((await api(ctx.base, 'POST', '/api/family/restore', {
      body: { family_code: A.code },
    })).status).toBe(404);
    expect((await api(ctx.base, 'POST', '/api/family/join', {
      body: { family_code: A.code },
    })).status).toBe(410);
    const before = await purgeExpiredFamilies(ctx.pool, { execute: false });
    expect(before).toMatchObject({ eligible: 1, purged: 0 });
    expect((await ctx.pool.query('SELECT 1 FROM families WHERE family_code = $1', [A.code])).rowCount).toBe(1);
    // Never delete without a durable erasure receipt writer, even when the
    // operator flags have accidentally been turned on.
    await expect(purgeExpiredFamilies(ctx.pool, { execute: true }))
      .rejects.toThrow(/External erasure registry writer required/);
    await expect(purgeExpiredFamilies(ctx.pool, {
      execute: true,
      recordErasure: async () => { throw new Error('R2 unavailable'); },
    })).rejects.toThrow(/R2 unavailable/);
    await expect(purgeExpiredFamilies(ctx.pool, {
      execute: true,
      recordErasure: async () => ({ confirmed: false }),
    })).rejects.toThrow(/receipt not confirmed/);
    expect((await ctx.pool.query('SELECT 1 FROM families WHERE family_code = $1', [A.code])).rowCount).toBe(1);
    const receiptLog = [];
    const after = await purgeExpiredFamilies(ctx.pool, {
      execute: true,
      recordErasure: async (code) => {
        receiptLog.push(code);
        return { confirmed: true, id: 'isolated-test-receipt' };
      },
    });
    expect(receiptLog).toEqual([A.code]);
    expect(after).toMatchObject({ eligible: 1, purged: 1, children: 1, photos: 2 });

    for (const table of ['families', 'children', 'point_events', 'redemptions', 'rewards',
      'users', 'family_goals', 'quick_actions', 'behavior_categories', 'uploads', 'idempotency_keys']) {
      const clause = table === 'point_events' || table === 'redemptions' || table === 'children'
        ? 'family_code = $1' : 'family_code = $1';
      const q = await ctx.pool.query('SELECT 1 FROM ' + table + ' WHERE ' + clause, [A.code]);
      expect(q.rowCount, table).toBe(0);
    }
    expect((await api(ctx.base, 'POST', '/api/family/join', {
      body: { family_code: A.code },
    })).status).toBe(404);
    expect((await api(ctx.base, 'GET', '/api/auth/me', { token: deletedToken })).status).toBe(401);
    expect((await fetch(ctx.base + photo)).status).toBe(404);
    expect((await fetch(ctx.base + legacyPhoto)).status).toBe(404);
    expect((await fetch(ctx.base + otherLegacyPhoto)).status).toBe(200);
    expect((await api(ctx.base, 'GET', '/api/children', { token: B.token })).status).toBe(200);
    const b = await ctx.pool.query('SELECT 1 FROM children WHERE id = $1', [childB.id]);
    expect(b.rowCount).toBe(1);
  });
});
