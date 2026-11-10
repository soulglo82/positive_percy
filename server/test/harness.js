// Test harness for server security tests. Needs a throwaway Postgres reachable
// at TEST_DATABASE_URL. The schema is dropped and rebuilt, so never point this
// at a real database.
export const TEST_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

export function testEnv() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  if (/railway|rlwy/i.test(url)) throw new Error('Refusing to run tests against a Railway database');
  return url;
}

export async function startApp() {
  // Same session clock settings as production (checked 2026-11-10), so a
  // date bug that only shows in UTC can't hide behind the test machine's zone.
  const url = testEnv();
  const opts = 'options=' + encodeURIComponent('-c TimeZone=Etc/UTC -c DateStyle=ISO,MDY');
  process.env.DATABASE_URL = url + (url.includes('?') ? '&' : '?') + opts;
  process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_SECRET;
  const { default: pool, initDb } = await import('../db.js');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await initDb();
  const { createApp } = await import('../app.js');
  const ctx = createApp();
  await new Promise((r) => ctx.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${ctx.server.address().port}`;
  return { ...ctx, pool, base };
}

export async function stopApp(ctx) {
  ctx.wss.close();
  await new Promise((r) => ctx.server.close(r));
}

export async function api(base, method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

export async function makeFamily(base, name) {
  const r = await api(base, 'POST', '/api/family/create', { body: { family_name: name } });
  if (r.status !== 200) throw new Error(`create family failed: ${r.status} ${r.text}`);
  return { code: r.json.family_code, token: r.json.token };
}
