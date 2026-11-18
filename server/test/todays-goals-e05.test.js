// @vitest-environment node
// E05 server rules (docs/engineering/E05-DESIGN.md sections 2 and 9):
// goals carry their category icon; renaming never moves a routine's start;
// a new effective date only when the schedule changes; completed one-offs keep
// their date (B2); checks run on one locked read in a fixed order.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

describe.skipIf(!hasDb)('E05: Today\'s Goals server rules', () => {
  let ctx, fam, child, kind, today, n = 0;
  const call = (method, path, body) => api(ctx.base, method, path, { token: fam.token, body });
  const read = async (id) => (await ctx.pool.query(
    "SELECT title, schedule_kind, weekdays, to_char(start_date,'YYYY-MM-DD') s, to_char(scheduled_date,'YYYY-MM-DD') d FROM today_goals WHERE id=$1", [id])).rows[0];
  const backdate = (id, days) => ctx.pool.query(
    'UPDATE today_goals SET start_date = start_date - $2::int, scheduled_date = scheduled_date - $2::int WHERE id=$1', [id, days]);
  const weekly = (extra = {}) => ({ title: 'Routine ' + (++n), child_id: child.id, category_id: kind.id, schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], ...extra });
  const oneOff = (extra = {}) => ({ title: 'Task ' + (++n), child_id: child.id, category_id: kind.id, schedule_kind: 'one_off', scheduled_date: today, ...extra });
  const put = (id, body) => call('PUT', `/api/todays-goals/${id}`, body);

  beforeAll(async () => {
    ctx = await startApp();
    fam = await makeFamily(ctx.base, 'E05 family');
    child = (await call('POST', '/api/children', { name: 'Robin' })).json;
    kind = (await call('GET', '/api/behavior-categories')).json.find(c => c.name === 'Kindness');
    today = (await call('GET', '/api/todays-goals')).json.date;
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('S1: goals carry the category icon key, and it follows category edits', async () => {
    const g = (await call('POST', '/api/todays-goals', oneOff())).json;
    let row = (await call('GET', '/api/todays-goals?manage=true')).json.goals.find(x => x.id === g.id);
    expect(row.category_icon_key).toBe(kind.icon_key);
    await call('PUT', `/api/behavior-categories/${kind.id}`, { icon_key: 'kindness' });
    row = (await call('GET', '/api/todays-goals')).json.goals.find(x => x.id === g.id);
    expect(row.category_icon_key).toBe('kindness');
  });

  it('a rename keeps a past start date (client omits start_date)', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly())).json;
    await backdate(g.id, 30);
    const before = await read(g.id);
    const body = weekly({ title: 'Renamed' }); delete body.start_date;
    const r = await put(g.id, body);
    expect(r.status, r.text).toBe(200);
    expect(await read(g.id)).toMatchObject({ title: 'Renamed', s: before.s });
  });

  it('a rename keeps a past start date even when an old client sends today (N1d)', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly())).json;
    await backdate(g.id, 30);
    const before = await read(g.id);
    const r = await put(g.id, weekly({ title: 'Old tab rename', start_date: today }));
    expect(r.status, r.text).toBe(200);
    expect((await read(g.id)).s).toBe(before.s);
  });

  it('a rename keeps completions and the same-day Done state', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly())).json;
    const c = await call('POST', `/api/todays-goals/${g.id}/complete`, { request_id: rid() });
    expect(c.status).toBe(200);
    expect((await put(g.id, weekly({ title: 'Renamed done' }))).status).toBe(200);
    const row = (await call('GET', '/api/todays-goals')).json.goals.find(x => x.id === g.id);
    expect(row.completion_id).toBe(c.json.completion_id);
  });

  it('weekdays unchanged and a future start: the start may move to another date that is not in the past', async () => {
    const start = addDays(today, 5);
    const g = (await call('POST', '/api/todays-goals', weekly({ start_date: start }))).json;
    expect((await put(g.id, weekly({ start_date: addDays(today, 2) }))).status).toBe(200);
    expect((await read(g.id)).s).toBe(addDays(today, 2));
    expect((await put(g.id, weekly({ start_date: addDays(today, -1) }))).status).toBe(400);
  });

  it('weekdays changed on a past routine: today or later required; omitted means today', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly())).json;
    await backdate(g.id, 30);
    const before = await read(g.id);
    const stale = await put(g.id, weekly({ weekdays: [1, 3], start_date: before.s }));
    expect(stale.status).toBe(400);
    expect(stale.json.error).toMatch(/new schedule/);
    const body = weekly({ weekdays: [3, 1] }); delete body.start_date;
    expect((await put(g.id, body)).status).toBe(200);
    expect(await read(g.id)).toMatchObject({ s: today, weekdays: [1, 3] });
  });

  it('weekdays changed on a future routine, start omitted: keeps the later stored start (N1a)', async () => {
    const start = addDays(today, 7);
    const g = (await call('POST', '/api/todays-goals', weekly({ start_date: start }))).json;
    const body = weekly({ weekdays: [2] }); delete body.start_date;
    expect((await put(g.id, body)).status).toBe(200);
    expect((await read(g.id)).s).toBe(start);
  });

  it('weekday order and duplicates in storage do not count as a change', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly({ weekdays: [1, 3] }))).json;
    await backdate(g.id, 10);
    await ctx.pool.query("UPDATE today_goals SET weekdays='{3,1,1}' WHERE id=$1", [g.id]);
    const before = await read(g.id);
    const r = await put(g.id, weekly({ weekdays: [3, 1], title: 'Same days' }));
    expect(r.status, r.text).toBe(200);
    expect((await read(g.id)).s).toBe(before.s);
  });

  it('a past one-off can be renamed; its date cannot move to the past', async () => {
    const g = (await call('POST', '/api/todays-goals', oneOff())).json;
    await backdate(g.id, 3);
    const before = await read(g.id);
    expect((await put(g.id, oneOff({ title: 'Old task renamed', scheduled_date: before.d }))).status).toBe(200);
    expect((await read(g.id)).d).toBe(before.d);
    expect((await put(g.id, oneOff({ scheduled_date: addDays(before.d, -1) }))).status).toBe(400);
  });

  it('B2: a completed one-off keeps its date (409), but can still be renamed', async () => {
    const g = (await call('POST', '/api/todays-goals', oneOff())).json;
    expect((await call('POST', `/api/todays-goals/${g.id}/complete`, { request_id: rid() })).status).toBe(200);
    const move = await put(g.id, oneOff({ scheduled_date: addDays(today, 1) }));
    expect(move.status).toBe(409);
    expect(move.json.error).toMatch(/another date/);
    expect((await read(g.id)).d).toBe(today);
    expect((await put(g.id, oneOff({ title: 'Done task renamed' }))).status).toBe(200);
    // Undone completions do not block a move.
    const g2 = (await call('POST', '/api/todays-goals', oneOff())).json;
    const c2 = await call('POST', `/api/todays-goals/${g2.id}/complete`, { request_id: rid() });
    await call('POST', `/api/point-events/${c2.json.event.id}/undo`, { request_id: rid() });
    expect((await put(g2.id, oneOff({ scheduled_date: addDays(today, 1) }))).status).toBe(200);
  });

  it('check order: a kind change on a completed goal gets the R1 message, not a date error', async () => {
    const g = (await call('POST', '/api/todays-goals', weekly())).json;
    await call('POST', `/api/todays-goals/${g.id}/complete`, { request_id: rid() });
    await backdate(g.id, 10);
    const r = await put(g.id, oneOff({ scheduled_date: addDays(today, -1) }));
    expect(r.status).toBe(409);
    expect(r.json.error).toMatch(/different schedule/);
  });
});
