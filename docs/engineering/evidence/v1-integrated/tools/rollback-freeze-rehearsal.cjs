// Rollback rehearsal WITH the write freeze, on SYNTHETIC data only
// (docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md §7, steps 1-10).
//
//   node rollback-freeze-rehearsal.cjs <v1 dir> <prod dir> <postgres base url>
//   e.g. node rollback-freeze-rehearsal.cjs /tmp/wt-i /tmp/wt-prod postgres://postgres:postgres@localhost:5432
//
// It creates its own databases (percy_freeze_<timestamp>_<n>) on a LOCAL
// Postgres and leaves them in place; it never touches any other database.
// It starts one app at a time on port 3320 and always stops it.
// It runs scripts/ops/*.sql exactly as the owner would: the file's text, as is.
// One "ok  ..." or "FAIL ..." line per check; exit code 1 on any FAIL.
//
// "Refused" means: HTTP 500, with the freeze's own message in the server log
// for that request, for a request that returns 200 when the database is not
// frozen (the old app's writes are repeated on an unfrozen database with the
// same data; V1's are repeated after the freeze is lifted).
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [v1Arg, prodArg, pgBaseArg] = process.argv.slice(2);
if (!v1Arg || !prodArg || !pgBaseArg) {
  console.error('Usage: node rollback-freeze-rehearsal.cjs <v1 dir> <prod dir> <postgres base url, e.g. postgres://postgres:postgres@localhost:5432>');
  process.exit(2);
}
const v1 = path.resolve(v1Arg);
const prod = path.resolve(prodArg);
const pgBase = pgBaseArg.replace(/\/+$/, '');
// Disposable local databases only: never a remote or production server.
const pgHost = new URL(pgBase).hostname.replace(/^\[|\]$/g, '');
if (!['localhost', '127.0.0.1', '::1'].includes(pgHost) || new URL(pgBase).pathname.replace(/\//g, '') !== '') {
  console.error('Refusing: the Postgres base URL must be a local server with no database name (postgres://user:password@localhost:5432).');
  process.exit(2);
}
const { Client } = require(require.resolve('pg', { paths: [v1] }));

const PORT = '3320';
const base = `http://localhost:${PORT}`;
const SECRET = 'freeze-rehearsal-secret-0123456789abcdef0123456789';
const FREEZE_MESSAGE = 'Positive Percy is paused for maintenance: no changes are being saved';
const FREEZE_CODE = '25006';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SQL = Object.fromEntries(['write-freeze-on', 'write-freeze-off', 'write-freeze-status', 'savings-check']
  .map((n) => [n, fs.readFileSync(path.join(v1, 'scripts/ops', `${n}.sql`), 'utf8')]));
const rid = () => crypto.randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Reporting ───────────────────────────────────────────────────────────────
let checks = 0;
let failed = 0;
const check = (label, pass, detail = '') => {
  checks++;
  if (!pass) { failed++; process.exitCode = 1; }
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${!pass && detail ? ' :: ' + detail : ''}`);
  return pass;
};
const section = (text) => console.log(`\n# ${text}`);
const note = (text) => console.log(`     ${text}`);

// ─── Databases ───────────────────────────────────────────────────────────────
const stamp = Math.floor(Date.now() / 1000);
let dbCount = 0;
const created = [];
async function newDatabase() {
  const name = `percy_freeze_${stamp}_${++dbCount}`;
  const admin = new Client({ connectionString: `${pgBase}/postgres` });
  await admin.connect();
  try { await admin.query(`CREATE DATABASE "${name}"`); } finally { await admin.end(); }
  created.push(name);
  return `${pgBase}/${name}`;
}
const dbName = (url) => url.slice(url.lastIndexOf('/') + 1);

// Runs SQL text as one simple query (several statements allowed, as pasted
// into a console) and returns every statement's result.
async function runSql(dbUrl, text) {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    return [].concat(await c.query(text));
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}
const lastRows = (results) => results[results.length - 1].rows;

const freezeOn = async (dbUrl) => lastRows(await runSql(dbUrl, SQL['write-freeze-on']))[0];
const freezeOff = async (dbUrl) => lastRows(await runSql(dbUrl, SQL['write-freeze-off']))[0];
async function freezeStatus(dbUrl) {
  const results = await runSql(dbUrl, SQL['write-freeze-status']);
  return { tables: results[0].rows, ...lastRows(results)[0] };
}
async function savingsCheck(dbUrl) {
  const rows = lastRows(await runSql(dbUrl, SQL['savings-check']));
  const conditions = rows.filter((r) => r.condition_no !== null);
  return {
    verdict: rows[rows.length - 1].check_name,
    conditions,
    tripped: conditions.filter((r) => r.offending_rows > 0).map((r) => r.condition_no),
    text: conditions.map((r) => `${r.condition_no}:${r.offending_rows}`).join(' '),
  };
}

// Per table: row count and md5 of the ordered row_to_json text of all rows.
async function checksums(dbUrl) {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    const { rows: tables } = await c.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
      WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations' ORDER BY 1`);
    const out = {};
    for (const { relname } of tables) {
      const { rows: [r] } = await c.query(`
        SELECT count(*)::int AS n, COALESCE(md5(string_agg(j, E'\\n' ORDER BY j)), '') AS h
        FROM (SELECT row_to_json(t)::text AS j FROM public."${relname.replace(/"/g, '""')}" t) x`);
      out[relname] = `${r.n}:${r.h}`;
    }
    return out;
  } finally {
    await c.end();
  }
}
function changedTables(before, after) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return names.filter((t) => before[t] !== after[t]);
}
const rowTotal = (sums) => Object.values(sums).reduce((n, v) => n + Number(v.split(':')[0]), 0);

// A write by hand, always rolled back (so it can never persist, frozen or not).
async function byHand(dbUrl, text) {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query('BEGIN');
    try {
      const r = await c.query(text);
      return { ok: true, rowCount: r.rowCount };
    } catch (err) {
      return { ok: false, code: err.code, message: err.message };
    }
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
}
const refusedByHand = (r) => !r.ok && r.code === FREEZE_CODE && r.message === FREEZE_MESSAGE;

// ─── App server (one at a time, port 3320) ───────────────────────────────────
let running = null;
async function start(dir, dbUrl) {
  if (running) throw new Error('a server is already running');
  try { await fetch(base + '/api/health'); throw new Error('in-use'); } catch (e) {
    if (e.message === 'in-use') throw new Error(`port ${PORT} is already in use: not starting`);
  }
  const p = spawn('node', ['server/index.js'], { cwd: dir, env: { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: SECRET, PORT } });
  const s = { p, log: '' };
  p.stdout.on('data', (d) => { s.log += d; });
  p.stderr.on('data', (d) => { s.log += d; });
  running = s;
  const t0 = Date.now();
  for (;;) {
    if (p.exitCode !== null) { running = null; throw new Error('server exited: ' + s.log.slice(-800)); }
    try { const r = await fetch(base + '/api/health'); if (r.ok) return s; } catch {}
    if (Date.now() - t0 > 40000) { await stop(); throw new Error('no health after 40s: ' + s.log.slice(-800)); }
    await sleep(300);
  }
}
async function stop() {
  const s = running;
  if (!s) return;
  running = null;
  if (s.p.exitCode !== null) return;
  await new Promise((r) => { s.p.on('exit', r); s.p.kill(); });
}
// Starting is itself a check (design §6: each app starts while frozen).
async function started(label, dir, dbUrl) {
  try {
    const s = await start(dir, dbUrl);
    check(label, true);
    return s;
  } catch (err) {
    check(label, false, err.message);
    throw new Error(`${label}: could not continue`);
  }
}

async function api(method, p, body, token) {
  const r = await fetch(base + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000), // a hung request stops the rehearsal instead of hanging it
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}
const call = (q, token) => api(q.method, q.path, q.body, q.open ? null : token);
const show = (q) => `${q.method} ${q.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ':id')
  .replace(/(family_code=|\/api\/family\/)[A-Z2-9]{6}\b/, '$1:code')}${q.tag ? ` [${q.tag}]` : ''}`;

// A request that must succeed. `quiet`: only a failure is printed.
function must(label, r, { want = 200, quiet = false } = {}) {
  const pass = r.status === want;
  if (!pass || !quiet) check(`${label} (${r.status})`, pass, r.text.slice(0, 200));
  if (!pass) throw new Error(`${label}: got ${r.status}, wanted ${want}`);
  return r.json;
}

// A request that must be refused BY THE FREEZE: 500, and the freeze's message
// in this server's log after the request was sent.
async function refused(label, s, q, token) {
  const from = s.log.length;
  const r = await call(q, token);
  let seen = false;
  for (let i = 0; i < 20 && r.status === 500 && !seen; i++) {
    seen = s.log.slice(from).includes(FREEZE_MESSAGE);
    if (!seen) await sleep(100);
  }
  return check(`${label}: ${show(q)} refused (${r.status}${seen ? ', freeze message in the server log' : ''})`,
    r.status === 500 && seen, r.status === 500 ? 'a 500 without the freeze message in the log' : r.text.slice(0, 200));
}

// ─── Synthetic data (design §7 step 1), built on V1 ──────────────────────────
// A family with a user row, two children, a bigger goal with savings, an
// ordinary reward, a requested reward; and what the write attempts need: a
// redemption to undo, a Today's Goal due today, a legacy family goal, a photo.
async function fixture({ quiet = false } = {}) {
  const o = { quiet };
  const fam = must('V1 create family', await api('POST', '/api/family/create', { family_name: 'Freeze Rehearsal', timezone: 'Europe/London' }), o);
  const t = fam.token;
  must('V1 first sign-in creates the user row', await api('GET', `/api/auth/me?family_code=${fam.family_code}`, null, t), o);
  const a = must('V1 create child A (200 points)', await api('POST', '/api/children', { name: 'Child A', total_points: 200 }, t), o);
  const b = must('V1 create child B (50 points)', await api('POST', '/api/children', { name: 'Child B', total_points: 50 }, t), o);
  const bike = must('V1 create bigger goal (150)', await api('POST', '/api/rewards', { title: 'Bike', cost_points: 150, is_bigger_goal: true }, t), o);
  const treat = must('V1 create ordinary reward (10)', await api('POST', '/api/rewards', { title: 'Treat', cost_points: 10 }, t), o);
  const sticker = must('V1 create reward to be requested (20)', await api('POST', '/api/rewards', { title: 'Sticker', cost_points: 20 }, t), o);
  const outing = must('V1 create ordinary reward (100)', await api('POST', '/api/rewards', { title: 'Outing', cost_points: 100 }, t), o);
  const award = must('V1 award 5', await api('POST', `/api/children/${a.id}/award`, { points: 5, category: 'Kindness', request_id: rid() }, t), o);
  must('V1 save 120 towards the goal', await api('POST', `/api/children/${a.id}/savings/save`, { reward_id: bike.id, points: 120, request_id: rid() }, t), o);
  must('V1 request a reward (stack)', await api('POST', `/api/children/${a.id}/stack/add`, { reward_id: sticker.id }, t), o);
  const spent = must('V1 redeem the ordinary reward', await api('POST', `/api/children/${a.id}/redeem`, { reward_id: treat.id, request_id: rid() }, t), o);
  const cats = must('V1 behaviours', await api('GET', '/api/behavior-categories', null, t), o);
  const today = must('V1 Today\'s Goals date', await api('GET', '/api/todays-goals', null, t), o).date;
  const goal = must('V1 create a Today\'s Goal due today', await api('POST', '/api/todays-goals',
    { child_id: a.id, title: 'Tidy room', category_id: cats[0].id, schedule_kind: 'one_off', scheduled_date: today }, t), { ...o, want: 201 });
  const familyGoal = must('V1 create a legacy family goal', await api('POST', '/api/family_goals', { title: 'Family outing', target_points: 10 }, t), o);
  const upload = must('V1 upload a photo', await api('POST', '/api/upload', { data: PNG }, t), o);
  const me = must('V1 children', await api('GET', '/api/children', null, t), o).find((c) => c.id === a.id);
  if (quiet) check('synthetic data built on V1 (18 requests, all succeeded)', true);
  return { t, code: fam.family_code, a, b, bike, treat, sticker, outing, award, redemption: spent.redemption, cats, goal, familyGoal, upload: upload.file_url, me };
}

// Every read the app makes (both front ends), and the other read endpoints the
// server has. `v1Only` ones do not exist on the production commit.
function reads(f, isV1) {
  const q = (method, p, body, extra = {}) => ({ method, path: p, body, ...extra });
  const list = [
    q('GET', '/api/health', null, { open: true }),
    q('POST', '/api/family/join', { family_code: f.code }, { open: true }),
    q('GET', `/api/auth/me?family_code=${f.code}`),
    q('GET', `/api/family/${f.code}`),
    q('GET', '/api/family/timezone'),
    q('PUT', '/api/family/timezone', { timezone: 'Europe/London', auto: true }, { tag: 'sent on every page load; this family has a timezone' }),
    q('GET', '/api/family/streak'),
    q('POST', '/api/family/check-streak'),
    q('GET', `/api/children?family_code=${f.code}`),
    q('POST', '/api/children/filter', { filter: { family_code: f.code }, sort: 'name' }),
    q('GET', `/api/children/${f.a.id}/motivation`),
    q('POST', '/api/children/weekly-reset'),
    q('GET', '/api/rewards'),
    q('GET', '/api/rewards?sort=-created_date'),
    q('GET', '/api/point_events'),
    q('GET', '/api/redemptions'),
    q('GET', '/api/family_goals'),
    q('GET', '/api/behavior-categories'),
    q('GET', '/api/quick-actions'),
    q('GET', '/api/summary'),
    q('GET', '/api/activity-feed?limit=5&filter=all'),
    q('GET', '/api/activity-feed?filter=earned&limit=20&offset=0'),
    q('GET', '/api/activity-feed?filter=spent&limit=20&offset=0'),
    q('GET', '/api/family/export'),
    q('GET', '/api/family/export?photos=exclude'),
    q('GET', f.upload, null, { open: true }),
  ];
  if (isV1) {
    list.push(
      q('GET', '/api/todays-goals'),
      q('GET', '/api/todays-goals?manage=true'),
      q('GET', `/api/todays-goals?child_id=${f.a.id}`),
      q('GET', '/api/activity-feed?filter=goals&limit=20&offset=0'),
      q('GET', `/api/activity-feed?filter=all&limit=20&offset=0&child_id=${f.a.id}`),
    );
  }
  return list;
}

// Every kind of write the old app can make (design §7 step 5). The same list,
// in the same order, is sent to the frozen database (every one refused) and to
// an unfrozen database with the same data (every one succeeds). The request
// ids are fixed per run of this list.
function oldAppWrites(f) {
  return [
    { kind: 'award', method: 'POST', path: `/api/children/${f.a.id}/award`, body: { points: 5, category: 'Kindness', request_id: rid() } },
    { kind: 'redeem while points are saved', method: 'POST', path: `/api/children/${f.a.id}/redeem`, body: { reward_id: f.outing.id, request_id: rid() } },
    { kind: 'reward edit', method: 'PUT', path: `/api/rewards/${f.treat.id}`, body: { title: 'Treat (edited)' } },
    { kind: 'reward reassign (goal, away from the child with savings)', method: 'PUT', path: `/api/rewards/${f.bike.id}`, body: { assigned_child_ids: [f.b.id] } },
    { kind: 'behaviour edit', method: 'PUT', path: `/api/behavior-categories/${f.cats[0].id}`, body: { points: 2 } },
    { kind: 'goal completion (legacy family goal; the old app has no Today\'s Goals)', method: 'POST', path: `/api/family-goals/${f.familyGoal.id}/contribute`, body: { points: 10 } },
    { kind: 'undo of a redemption', method: 'POST', path: `/api/redemptions/${f.redemption.id}/undo`, body: { request_id: rid() } },
    { kind: 'badge check (sent after an award)', method: 'POST', path: `/api/children/${f.a.id}/check-badges`, body: {} },
    { kind: 'reward delete (goal with savings)', method: 'DELETE', path: `/api/rewards/${f.bike.id}` },
    { kind: 'child delete (cascades)', method: 'DELETE', path: `/api/children/${f.b.id}` },
  ];
}

// ─── The rehearsal ───────────────────────────────────────────────────────────
async function main() {
  console.log(`Rollback rehearsal with the write freeze. V1: ${v1}  production commit: ${prod}`);

  // 1. V1 on a new database: migrate to 017; the synthetic family.
  section('Step 1: V1 on a new database, migrated to 017, synthetic data');
  const db = await newDatabase();
  note(`database ${dbName(db)}`);
  let s = await started('V1 starts on an empty database and migrates', v1, db);
  const f = await fixture();
  note(`V1 sees child A: total ${f.me.total_points}, available ${f.me.available_points}, saved ${f.me.saved_total}, requested ${f.me.reward_stack_priced.length}`);
  await stop();
  const lastMigration = (await runSql(db, 'SELECT max(name) AS m FROM schema_migrations'))[0].rows[0].m;
  check(`the database is at migration 017 (${lastMigration})`, /^017_/.test(lastMigration));
  let sc = await savingsCheck(db);
  check(`savings-check.sql before the freeze: ${sc.verdict} (${sc.text})`, sc.verdict === 'SAVINGS CHECK: PASS' && sc.conditions.length === 5);
  // The baseline the procedure keeps (design §4 step 1): step 5 must equal it.
  const baseline = JSON.stringify(sc.conditions);

  // 2. A checksum of every table.
  section('Step 2: checksum of every table');
  const before = await checksums(db);
  check(`checksums recorded: ${Object.keys(before).length} tables, ${rowTotal(before)} rows`, Object.keys(before).length > 0 && rowTotal(before) > 0);

  // 3. Freeze on; status FROZEN; again; still FROZEN.
  section('Step 3: freeze on');
  let on = await freezeOn(db);
  check(`write-freeze-on.sql: ${on.tables_frozen} of ${on.tables_total} tables frozen`, on.tables_frozen === on.tables_total && on.tables_total === Object.keys(before).length);
  check(`write-freeze-on.sql: families with no users row = ${on.families_without_user_row}`, on.families_without_user_row === 0);
  let st = await freezeStatus(db);
  check(`write-freeze-status.sql: ${st.write_freeze} (${st.tables.filter((x) => x.row_trigger_on && x.truncate_trigger_on).length} of ${st.tables.length} tables listed with both triggers on)`,
    st.write_freeze === 'FROZEN' && st.tables.length === on.tables_total && st.tables_frozen === on.tables_total && st.tables.every((x) => x.row_trigger_on && x.truncate_trigger_on));
  let again = null;
  try { again = await freezeOn(db); } catch (err) { again = { error: err.message }; }
  st = await freezeStatus(db);
  check(`write-freeze-on.sql run a second time: no error, still ${st.write_freeze}`, !again.error && again.tables_frozen === on.tables_total && st.write_freeze === 'FROZEN', again.error);
  // By hand (contract 1; the TRUNCATE trigger is not reachable through the app).
  check('by hand: UPDATE of a row is refused with 25006', refusedByHand(await byHand(db, 'UPDATE families SET family_name = family_name')));
  check('by hand: INSERT is refused with 25006', refusedByHand(await byHand(db, `INSERT INTO quick_actions (family_code, label) VALUES ('${f.code}', 'By hand')`)));
  check('by hand: DELETE is refused with 25006', refusedByHand(await byHand(db, 'DELETE FROM children')));
  check('by hand: TRUNCATE is refused with 25006', refusedByHand(await byHand(db, 'TRUNCATE savings_events')));
  check('by hand: INSERT ... ON CONFLICT DO NOTHING that would insert nothing is still refused (design §5)',
    refusedByHand(await byHand(db, `INSERT INTO behavior_categories (family_code, name) VALUES ('${f.code}', 'Kindness') ON CONFLICT (family_code, name) DO NOTHING`)));
  const noRow = await byHand(db, 'UPDATE children SET name = name WHERE false');
  check('by hand: a statement that touches no row succeeds (design §3)', noRow.ok && noRow.rowCount === 0, noRow.message);

  // 4. The production commit under the freeze: starts, health, every read.
  section('Step 4: production commit (498e798) on the frozen database: start and reads');
  s = await started('production commit starts while frozen; health check passes', prod, db);
  for (const q of reads(f, false)) {
    const r = await call(q, f.t);
    check(`prod read ${show(q)} (${r.status})`, r.status === 200, r.text.slice(0, 200));
  }

  // 5. Every kind of write: refused with a 500 carrying the freeze.
  section('Step 5: production commit: every kind of write is refused');
  const frozenWrites = oldAppWrites(f);
  for (const q of frozenWrites) await refused(`prod ${q.kind}`, s, q, f.t);
  // Each refused write gave its connection back: more requests than the pool has connections still get an answer.
  let r = await api('GET', '/api/children', null, f.t);
  check(`prod still answers reads after ${frozenWrites.length} refused writes: GET /api/children (${r.status})`, r.status === 200 && r.json.length === 2, r.text.slice(0, 200));
  // Today's Goals do not exist on the production commit: shown, not counted.
  const noGoals = await api('POST', `/api/todays-goals/${f.goal.id}/complete`, { request_id: rid() }, f.t);
  note(`Today's Goal completion on the production commit: ${noGoals.status} (it has no such endpoint; attempted on V1 in step 7)`);
  await stop();

  // 6. The checksums are unchanged.
  section('Step 6: checksums after the refused writes');
  let diff = changedTables(before, await checksums(db));
  check('every table is unchanged (row counts and hashes)', diff.length === 0, 'changed: ' + diff.join(', '));

  // 7. V1 under the freeze: starts, reads, a save is refused, the check passes.
  section('Step 7: V1 on the frozen database');
  s = await started('V1 starts while frozen (no new migration); health check passes', v1, db);
  for (const q of reads(f, true)) {
    const r = await call(q, f.t);
    check(`V1 read ${show(q)} (${r.status})`, r.status === 200, r.text.slice(0, 200));
  }
  const save = { method: 'POST', path: `/api/children/${f.a.id}/savings/save`, body: { reward_id: f.bike.id, points: 10, request_id: rid() } };
  const complete = { method: 'POST', path: `/api/todays-goals/${f.goal.id}/complete`, body: { request_id: rid() } };
  await refused('V1 save towards a goal', s, save, f.t);
  await refused('V1 Today\'s Goal completion', s, complete, f.t);
  sc = await savingsCheck(db);
  check(`savings-check.sql under the freeze: ${sc.verdict} (${sc.text})`, sc.verdict === 'SAVINGS CHECK: PASS');
  check('savings-check.sql under the freeze equals the baseline taken before it, row for row', JSON.stringify(sc.conditions) === baseline);
  diff = changedTables(before, await checksums(db));
  check('every table is still unchanged after V1\'s refused writes', diff.length === 0, 'changed: ' + diff.join(', '));

  // 8. Freeze off; NOT FROZEN; the same save now succeeds on V1.
  section('Step 8: freeze off');
  let off = await freezeOff(db);
  st = await freezeStatus(db);
  check(`write-freeze-off.sql, then status: ${st.write_freeze} (${off.tables_still_frozen} tables still frozen)`,
    st.write_freeze === 'NOT FROZEN' && off.tables_still_frozen === 0 && off.function_present === false && st.tables.every((r) => !r.row_trigger_on && !r.truncate_trigger_on));
  let offAgain = null;
  try { offAgain = await freezeOff(db); } catch (err) { offAgain = { error: err.message }; }
  st = await freezeStatus(db);
  check(`write-freeze-off.sql run when not frozen: no error, ${st.write_freeze}`, !offAgain.error && st.write_freeze === 'NOT FROZEN', offAgain.error);
  r = await call(save, f.t);
  check(`V1: the same save now succeeds (${r.status})`, r.status === 200 && r.json?.child?.saved_total === 130, r.text.slice(0, 200));
  r = await call(complete, f.t);
  check(`V1: the same Today's Goal completion now succeeds (${r.status})`, r.status === 200 && r.json?.duplicate === false, r.text.slice(0, 200));
  await stop();
  diff = changedTables(before, await checksums(db));
  check(`the checksums see those two writes (changed: ${diff.join(', ')})`, diff.includes('savings_events') && diff.includes('point_events'));

  // The old app's write requests are valid: the same list on an unfrozen
  // database with the same data. Every one must return 200.
  section('Unfrozen database: the old app\'s write requests of step 5 all succeed');
  const dbV = await newDatabase();
  note(`database ${dbName(dbV)}`);
  s = await started('V1 starts on a new database', v1, dbV);
  const fv = await fixture({ quiet: true });
  await stop();
  s = await started('production commit starts on it (no freeze)', prod, dbV);
  const openWrites = oldAppWrites(fv);
  for (const q of openWrites) {
    r = await call(q, fv.t);
    check(`prod, not frozen, ${q.kind}: ${show(q)} succeeds (${r.status})`, r.status === 200, r.text.slice(0, 200));
  }
  await stop();

  // 9. Controls: no freeze, each a thing the old app does, each on its own
  // database. After each, savings-check.sql must not say PASS and must name
  // the condition.
  const controls = [
    { id: 'a', what: 'redeem while points are saved', expect: 2,
      act: (c) => ({ method: 'POST', path: `/api/children/${c.a.id}/redeem`, body: { reward_id: c.outing.id, request_id: rid() } }) },
    { id: 'b', what: 'delete a goal that has savings', expect: 3,
      act: (c) => ({ method: 'DELETE', path: `/api/rewards/${c.bike.id}` }) },
    { id: 'c', what: 'reassign a goal away from a child with savings', expect: 3,
      act: (c) => ({ method: 'PUT', path: `/api/rewards/${c.bike.id}`, body: { assigned_child_ids: [c.b.id] } }) },
    { id: 'd', what: 'undo a redemption V1 paid from savings', expect: 4,
      prepare: async (c) => {
        const paid = must('V1 redeems the goal, paid from savings', await api('POST', `/api/children/${c.a.id}/savings/redeem`, { reward_id: c.bike.id, request_id: rid() }, c.t));
        check(`V1 paid ${paid.from_saved} of it from savings`, paid.from_saved === 120);
        c.goalRedemption = paid.redemption;
      },
      act: (c) => ({ method: 'POST', path: `/api/redemptions/${c.goalRedemption.id}/undo`, body: { request_id: rid() } }) },
  ];
  for (const k of controls) {
    section(`Step 9 control (${k.id}): the old app, no freeze: ${k.what}`);
    const dbC = await newDatabase();
    note(`database ${dbName(dbC)}`);
    s = await started('V1 starts on a new database', v1, dbC);
    const c = await fixture({ quiet: true });
    if (k.prepare) await k.prepare(c);
    await stop();
    sc = await savingsCheck(dbC);
    check(`savings-check.sql before the old app acts: ${sc.verdict} (${sc.text})`, sc.verdict === 'SAVINGS CHECK: PASS');
    s = await started('production commit starts on it (no freeze)', prod, dbC);
    const q = k.act(c);
    r = await call(q, c.t);
    check(`prod: ${show(q)} succeeds (${r.status})`, r.status === 200, r.text.slice(0, 200));
    await stop();
    sc = await savingsCheck(dbC);
    const named = sc.conditions.find((x) => x.condition_no === k.expect);
    check(`control (${k.id}): savings-check.sql says ${sc.verdict} and names condition ${k.expect} "${named.check_name}" (${sc.text}; tripped: ${sc.tripped.join(', ') || 'none'})`,
      sc.verdict === 'SAVINGS CHECK: FAIL' && named.offending_rows > 0 && named.child_ids === c.a.id
        && JSON.stringify(sc.tripped) === JSON.stringify([k.expect]));
  }

  // 10. A family with no users row: the on script reports the count as 1.
  section('Step 10: a family with no users row');
  const dbU = await newDatabase();
  note(`database ${dbName(dbU)}`);
  s = await started('V1 starts on a new database', v1, dbU);
  const lone = must('V1 create family (never signed in, no timezone)', await api('POST', '/api/family/create', { family_name: 'Never Signed In' }));
  await stop();
  on = await freezeOn(dbU);
  check(`write-freeze-on.sql reports families with no users row = ${on.families_without_user_row}`, on.families_without_user_row === 1 && on.tables_frozen === on.tables_total);
  st = await freezeStatus(dbU);
  check(`write-freeze-status.sql: ${st.write_freeze}, families with no users row = ${st.families_without_user_row}`, st.write_freeze === 'FROZEN' && st.families_without_user_row === 1);
  const sumsU = await checksums(dbU);
  s = await started('production commit starts while frozen', prod, dbU);
  await refused('prod sign-in of that family (it inserts the users row; design §5)', s, { method: 'GET', path: `/api/auth/me?family_code=${lone.family_code}` }, lone.token);
  // Not in the design: the page-load timezone call writes when the family has no zone. Shown, not counted.
  const tz = await api('PUT', '/api/family/timezone', { timezone: 'Europe/London', auto: true }, lone.token);
  note(`page-load PUT /api/family/timezone (auto) for a family with no timezone, frozen: ${tz.status}`);
  await stop();
  diff = changedTables(sumsU, await checksums(dbU));
  check('that database is unchanged', diff.length === 0, 'changed: ' + diff.join(', '));

  // The status script's other verdict (design §3 and §5), on the same database.
  section('Status script: PARTLY FROZEN (design §3, §5)');
  await runSql(dbU, 'ALTER TABLE families DISABLE TRIGGER percy_write_freeze');
  st = await freezeStatus(dbU);
  check(`one trigger disabled by hand: status ${st.write_freeze}`, st.write_freeze === 'PARTLY FROZEN' && st.tables.find((x) => x.table_name === 'families').row_trigger_on === false);
  on = await freezeOn(dbU);
  st = await freezeStatus(dbU);
  check(`write-freeze-on.sql again: status ${st.write_freeze}`, st.write_freeze === 'FROZEN' && on.tables_frozen === on.tables_total);
  // Enabled for replica sessions only: it never fires for the app, so it is not a freeze (code review).
  await runSql(dbU, 'ALTER TABLE children ENABLE REPLICA TRIGGER percy_write_freeze');
  st = await freezeStatus(dbU);
  check(`one trigger set to replica-only by hand: status ${st.write_freeze}`, st.write_freeze === 'PARTLY FROZEN' && st.tables.find((x) => x.table_name === 'children').row_trigger_on === false);
  on = await freezeOn(dbU);
  st = await freezeStatus(dbU);
  check(`write-freeze-on.sql again: status ${st.write_freeze}`, st.write_freeze === 'FROZEN' && on.tables_frozen === on.tables_total);
  await runSql(dbU, 'CREATE TABLE percy_freeze_probe (id integer)');
  st = await freezeStatus(dbU);
  check(`a table created after the freeze: status ${st.write_freeze}`, st.write_freeze === 'PARTLY FROZEN');
  const tablesBefore = on.tables_total;
  on = await freezeOn(dbU);
  st = await freezeStatus(dbU);
  check(`write-freeze-on.sql again covers the new table: status ${st.write_freeze} (${on.tables_frozen} tables)`, st.write_freeze === 'FROZEN' && on.tables_frozen === tablesBefore + 1);
  off = await freezeOff(dbU);
  st = await freezeStatus(dbU);
  check(`write-freeze-off.sql: status ${st.write_freeze}`, st.write_freeze === 'NOT FROZEN' && off.tables_still_frozen === 0);
}

main()
  .catch((err) => { check('rehearsal ran to the end', false, err.message); })
  .finally(async () => {
    await stop().catch(() => {});
    console.log(`\nDatabases created (left in place): ${created.join(', ') || 'none'}`);
    console.log(`RESULT: ${checks} checks, ${failed} failed. ${failed ? 'FAIL' : 'PASS'}`);
    process.exit(failed ? 1 : 0);
  });
