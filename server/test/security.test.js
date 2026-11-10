// @vitest-environment node
// Security tranche 1 red tests. Each one fails on the code at a9f0477 and must
// pass after the fix. Design: claude/security-remediation-tranche1-design.md.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { startApp, stopApp, api, makeFamily, testEnv } from './harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runDb)('security tranche 1', () => {
  let ctx, A, B;

  beforeAll(async () => {
    ctx = await startApp();
    A = await makeFamily(ctx.base, 'Family A');
    B = await makeFamily(ctx.base, 'Family B');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  async function childOf(fam, name) {
    const r = await api(ctx.base, 'POST', '/api/children', { token: fam.token, body: { name } });
    expect(r.status).toBe(200);
    return r.json;
  }

  // 1. F1
  it('1: family A cannot edit family B child, and family_code cannot be reassigned', async () => {
    const bChild = await childOf(B, 'B kid');
    const r = await api(ctx.base, 'PUT', `/api/children/${bChild.id}`, { token: A.token, body: { name: 'hacked' } });
    expect(r.status).toBe(404);
    const { rows } = await ctx.pool.query('SELECT name FROM children WHERE id = $1', [bChild.id]);
    expect(rows[0].name).toBe('B kid');

    const aChild = await childOf(A, 'A kid');
    await api(ctx.base, 'PUT', `/api/children/${aChild.id}`, { token: A.token, body: { name: 'A kid', family_code: B.code } });
    const { rows: r2 } = await ctx.pool.query('SELECT family_code FROM children WHERE id = $1', [aChild.id]);
    expect(r2[0].family_code).toBe(A.code);
  });

  // 2. F2
  it('2: family A cannot delete family B child or its history', async () => {
    const bChild = await childOf(B, 'B kid 2');
    await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code) VALUES ($1, 5, 'Kindness', $2)",
      [bChild.id, B.code]);
    await ctx.pool.query(
      "INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, family_code) VALUES ($1, 'B kid 2', gen_random_uuid(), 'Treat', 5, $2)",
      [bChild.id, B.code]);

    const r = await api(ctx.base, 'DELETE', `/api/children/${bChild.id}`, { token: A.token });
    expect(r.status).toBe(404);
    const c = await ctx.pool.query('SELECT 1 FROM children WHERE id = $1', [bChild.id]);
    const e = await ctx.pool.query('SELECT 1 FROM point_events WHERE child_id = $1', [bChild.id]);
    const d = await ctx.pool.query('SELECT 1 FROM redemptions WHERE child_id = $1', [bChild.id]);
    expect(c.rowCount).toBe(1);
    expect(e.rowCount).toBe(1);
    expect(d.rowCount).toBe(1);
  });

  it('2b: family A can still delete its own child and its history', async () => {
    const aChild = await childOf(A, 'A kid 2');
    await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code) VALUES ($1, 5, 'Kindness', $2)",
      [aChild.id, A.code]);
    const r = await api(ctx.base, 'DELETE', `/api/children/${aChild.id}`, { token: A.token });
    expect(r.status).toBe(200);
    const c = await ctx.pool.query('SELECT 1 FROM children WHERE id = $1', [aChild.id]);
    const e = await ctx.pool.query('SELECT 1 FROM point_events WHERE child_id = $1', [aChild.id]);
    expect(c.rowCount).toBe(0);
    expect(e.rowCount).toBe(0);
  });

  it('2c: family A cannot delete family B reward or deny its pending redemptions', async () => {
    const reward = await api(ctx.base, 'POST', '/api/rewards', { token: B.token, body: { title: 'B treat', cost_points: 5 } });
    const bChild = await childOf(B, 'B kid 3');
    await ctx.pool.query(
      "INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, family_code) VALUES ($1, 'B kid 3', $2, 'B treat', 5, $3)",
      [bChild.id, reward.json.id, B.code]);
    const r = await api(ctx.base, 'DELETE', `/api/rewards/${reward.json.id}`, { token: A.token });
    expect(r.status).toBe(404);
    const { rows } = await ctx.pool.query('SELECT status FROM redemptions WHERE reward_id = $1', [reward.json.id]);
    expect(rows[0].status).toBe('Pending');
    const rw = await ctx.pool.query('SELECT 1 FROM rewards WHERE id = $1', [reward.json.id]);
    expect(rw.rowCount).toBe(1);
  });

  // 3. F3
  it('3: family lookup requires a session and only returns your own family', async () => {
    const anon = await api(ctx.base, 'GET', `/api/family/${B.code}`);
    expect(anon.status).toBe(401);
    const other = await api(ctx.base, 'GET', `/api/family/${B.code}`, { token: A.token });
    expect(other.status).toBe(404);
    const own = await api(ctx.base, 'GET', `/api/family/${A.code}`, { token: A.token });
    expect(own.status).toBe(200);
  });

  // 5. F5
  it('5: family codes do not use Math.random', async () => {
    const spy = vi.spyOn(Math, 'random');
    const r = await api(ctx.base, 'POST', '/api/family/create', { body: { family_name: 'Spy family' } });
    expect(r.status).toBe(200);
    expect(r.json.family_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('5b: a code containing a blocked word is regenerated', async () => {
    const routes = await import('../routes.js');
    expect(typeof routes.generateFamilyCode).toBe('function');
    // Alphabet index for S=16, E=4, X=21: first draw spells SEX..., second is clean.
    const draws = [Buffer.from([16, 4, 21, 0, 0, 0]), Buffer.from([0, 1, 2, 3, 4, 5])];
    const code = routes.generateFamilyCode(() => draws.shift());
    expect(code).toBe('ABCDEF');
    expect(draws.length).toBe(0);
  });

  // 6. F6
  it('6: uploads need a session, must be images, and are never served as HTML', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const anon = await api(ctx.base, 'POST', '/api/upload', { body: { data: png, content_type: 'image/png' } });
    expect(anon.status).toBe(401);

    const html = 'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    const bad = await api(ctx.base, 'POST', '/api/upload', { token: A.token, body: { data: html, content_type: 'text/html' } });
    expect(bad.status).toBe(400);

    const good = await api(ctx.base, 'POST', '/api/upload', { token: A.token, body: { data: png, content_type: 'image/png' } });
    expect(good.status).toBe(200);

    // Rows stored before the fix can still hold HTML. Neither serve path may emit it as HTML.
    const legacy1 = await ctx.pool.query("INSERT INTO uploads (data, content_type) VALUES ($1, 'image/png') RETURNING id", [html]);
    const legacy2 = await ctx.pool.query("INSERT INTO uploads (data, content_type) VALUES ('<script>alert(1)</script>', 'text/html') RETURNING id");
    for (const id of [legacy1.rows[0].id, legacy2.rows[0].id]) {
      const g = await api(ctx.base, 'GET', `/api/uploads/${id}`);
      expect(g.headers.get('content-type') || '').not.toMatch(/html/i);
      expect(g.headers.get('x-content-type-options')).toBe('nosniff');
    }
  });

  // 7. F7
  it('7: profile update drops unknown keys without echoing them', async () => {
    const only = await api(ctx.base, 'PUT', '/api/auth/me', { token: A.token, body: { secret_col: 1 } });
    expect(only.status).toBe(400);
    expect(only.text).not.toContain('secret_col');
    await api(ctx.base, 'GET', '/api/auth/me', { token: A.token });
    const mixed = await api(ctx.base, 'PUT', '/api/auth/me', { token: A.token, body: { mum_name: 'Mum', secret_col: 1 } });
    expect(mixed.status).toBe(200);
    expect(mixed.text).not.toContain('secret_col');
  });

  // 8. F8
  it('8: live updates need a token and ignore a client-chosen family', async () => {
    const wsUrl = ctx.base.replace('http', 'ws') + '/ws';
    const open = (u) => new Promise((res, rej) => { const w = new WebSocket(u); w.on('open', () => res(w)); w.on('error', rej); });
    const received = (w, ms = 400) => new Promise((res) => {
      const got = [];
      w.on('message', (m) => got.push(JSON.parse(m)));
      setTimeout(() => res(got), ms);
    });

    // No token: joining B's room must not deliver B's events.
    const anon = await open(wsUrl);
    anon.send(JSON.stringify({ type: 'join', family_code: B.code }));
    // A's token but asks for B's room: must land in A's room only.
    const spoof = await open(wsUrl);
    spoof.send(JSON.stringify({ type: 'join', token: A.token, family_code: B.code }));
    await new Promise((r) => setTimeout(r, 100));

    const anonMsgs = received(anon);
    const spoofMsgs = received(spoof);
    ctx.broadcast(B.code, { type: 'children_updated', id: 'b' });
    ctx.broadcast(A.code, { type: 'children_updated', id: 'a' });
    const [a1, s1] = await Promise.all([anonMsgs, spoofMsgs]);
    expect(a1).toEqual([]);
    expect(s1.map((m) => m.id)).toEqual(['a']);
    anon.close(); spoof.close();
  });

  // 9. F9
  it('9: date_of_birth is not accepted and the column is gone', async () => {
    const r = await api(ctx.base, 'POST', '/api/children', { token: A.token, body: { name: 'Dob kid', date_of_birth: '2019-01-01' } });
    expect(r.status).toBe(200);
    expect(r.json.date_of_birth ?? null).toBeNull();
    const { rowCount } = await ctx.pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'date_of_birth'");
    expect(rowCount).toBe(0);
  });

  // 10. F10
  it('10a: security headers present and no wildcard CORS', async () => {
    const r = await api(ctx.base, 'GET', '/api/auth/me', { token: A.token, headers: { Origin: 'https://evil.example' } });
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options') || r.headers.get('content-security-policy')).toBeTruthy();
    const acao = r.headers.get('access-control-allow-origin');
    expect(acao === null || (acao !== '*' && acao !== 'https://evil.example')).toBe(true);
  });

  // G1
  it('G1: database errors are not echoed to the client', async () => {
    const r = await api(ctx.base, 'PUT', '/api/children/not-a-uuid', { token: A.token, body: { name: 'x' } });
    expect(r.text).not.toMatch(/uuid|syntax|relation|column|violates/i);
  });
});

describe.skipIf(!runDb)('security tranche 1: rate limits', () => {
  let ctx;
  beforeAll(async () => { ctx = await startApp(); });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  // 10b. G3
  it('10b: join attempts are rate limited', async () => {
    const statuses = [];
    for (let i = 0; i < 25; i++) {
      const r = await api(ctx.base, 'POST', '/api/family/join', { body: { family_code: `ZZZZ${String(i).padStart(2, '0')}` } });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });
});

// 4. F4
describe.skipIf(!runDb)('security tranche 1: startup secret check', () => {
  function boot(env) {
    return new Promise((resolve) => {
      const p = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
        env: { PATH: process.env.PATH, DATABASE_URL: testEnv(), PORT: '0', ...env },
        stdio: 'ignore',
      });
      const t = setTimeout(() => { p.kill('SIGKILL'); resolve('still-running'); }, 4000);
      p.on('exit', (code) => { clearTimeout(t); resolve(code); });
    });
  }

  it('4a: refuses to start with no JWT_SECRET, whatever NODE_ENV says', async () => {
    for (const env of [{}, { NODE_ENV: 'production' }]) {
      const code = await boot(env);
      expect(code).not.toBe('still-running');
      expect(code).not.toBe(0);
    }
  });

  it('4b: refuses to start with a short JWT_SECRET', async () => {
    const code = await boot({ JWT_SECRET: 'tooshort' });
    expect(code).not.toBe('still-running');
    expect(code).not.toBe(0);
  });
});
