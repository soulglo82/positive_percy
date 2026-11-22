// Rollback rehearsal on SYNTHETIC data: V1 (migrations to 017, with savings in
// use) -> the production commit's app on the same database -> V1 again.
const { spawn } = require('child_process');
const crypto = require('crypto');
const [v1, prod, dbUrl] = process.argv.slice(2);
const base = 'http://localhost:3312';
const rid = () => crypto.randomUUID();
const start = (dir) => new Promise((resolve, reject) => {
  const p = spawn('node', ['server/index.js'], { cwd: dir, env: { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: 'rehearsal-secret-0123456789abcdef0123456789', PORT: '3312' } });
  let log = '';
  p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  const poll = async () => {
    if (p.exitCode !== null) return reject(new Error('server exited: ' + log.slice(-800)));
    try { const r = await fetch(base + '/api/health'); if (r.ok) return resolve({ p, log: () => log }); } catch {}
    if (Date.now() - t0 > 40000) return reject(new Error('no health: ' + log.slice(-800)));
    setTimeout(poll, 400);
  };
  poll();
});
const stop = (s) => new Promise((r) => { s.p.on('exit', r); s.p.kill(); });
const api = async (m, p, b, t) => {
  const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const ok = (label, r, want = 200) => { const pass = r.status === want; console.log(`${pass ? 'ok  ' : 'FAIL'} ${label} (${r.status})${pass ? '' : ' ' + r.text.slice(0, 200)}`); if (!pass) process.exitCode = 1; return r.json; };
(async () => {
  // 1. V1: migrate to 017 and put savings in use.
  let s = await start(v1);
  const fam = ok('V1 create family', await api('POST', '/api/family/create', { family_name: 'Rehearsal' }));
  const t = fam.token;
  const kid = ok('V1 create child', await api('POST', '/api/children', { name: 'Remy', total_points: 200 }, t));
  const kid2 = ok('V1 create second child', await api('POST', '/api/children', { name: 'Rosa', total_points: 50 }, t));
  const bike = ok('V1 create goal', await api('POST', '/api/rewards', { title: 'Bike', cost_points: 300, is_bigger_goal: true }, t));
  const treat = ok('V1 create reward', await api('POST', '/api/rewards', { title: 'Treat', cost_points: 10 }, t));
  ok('V1 save 120', await api('POST', `/api/children/${kid.id}/savings/save`, { reward_id: bike.id, points: 120, request_id: rid() }, t));
  const cats = ok('V1 behaviours', await api('GET', '/api/behavior-categories', null, t));
  const today = ok('V1 goals date', await api('GET', '/api/todays-goals', null, t)).date;
  ok('V1 create Today\'s Goal', await api('POST', '/api/todays-goals', { child_id: kid.id, title: 'Tidy', category_id: cats[0].id, schedule_kind: 'one_off', scheduled_date: today }, t), 201);
  let me = ok('V1 children', await api('GET', '/api/children', null, t)).find((c) => c.id === kid.id);
  console.log(`     V1 sees: total ${me.total_points}, available ${me.available_points}, saved ${me.saved_total}`);
  await stop(s);

  // 2. The production commit's app on the same database (a Railway rollback).
  s = await start(prod);
  console.log('ok   production commit boots on a database at 017');
  me = ok('prod children', await api('GET', '/api/children', null, t)).find((c) => c.id === kid.id);
  console.log(`     prod sees: total ${me.total_points} (it does not know savings)`);
  ok('prod award', await api('POST', `/api/children/${kid.id}/award`, { points: 5, category: 'Kindness', request_id: rid() }, t));
  ok('prod create reward', await api('POST', '/api/rewards', { title: 'Old-app reward', cost_points: 5 }, t));
  ok('prod edit reward (assign)', await api('PUT', `/api/rewards/${treat.id}`, { assigned_child_ids: [kid.id] }, t));
  ok('prod redeem', await api('POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: rid() }, t));
  ok('prod rewards list', await api('GET', '/api/rewards', null, t));
  ok('prod activity', await api('GET', '/api/activity-feed', null, t));
  ok('prod export', await api('GET', '/api/family/export', null, t));
  ok('prod delete a reward with savings', await api('DELETE', `/api/rewards/${bike.id}`, null, t));
  ok('prod delete a child', await api('DELETE', `/api/children/${kid2.id}`, null, t));
  await stop(s);

  // 3. V1 again (roll forward).
  s = await start(v1);
  console.log('ok   V1 boots again after the production commit ran');
  me = ok('V1 children again', await api('GET', '/api/children', null, t)).find((c) => c.id === kid.id);
  console.log(`     V1 sees: total ${me.total_points}, available ${me.available_points}, saved ${me.saved_total}, goals ${me.goals.length}`);
  ok('V1 activity again', await api('GET', '/api/activity-feed', null, t));
  ok('V1 award again', await api('POST', `/api/children/${kid.id}/award`, { points: 1, category: 'Kindness', request_id: rid() }, t));
  await stop(s);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
