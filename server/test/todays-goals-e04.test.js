// @vitest-environment node
// E04: independent review and hardening of PR #45 (Today's Goals backend).
// Adds the cases the Batch E suite did not cover: family-local date
// boundaries, NULL timezone, a timezone change between viewing and completing,
// cross-family access on every write endpoint, identical request ids in
// parallel, request ids reused from other endpoints, ledger invariants across
// undo/correct/redo, category changes after completion, migration 014 re-run
// on existing data, and export of undone completions.
// Design and findings: docs/engineering/E04-GOALS-SERVER-REVIEW.md
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

// The local calendar date and ISO weekday for a zone, from the JS runtime's
// own tz database, independent of Postgres.
function localDay(zone, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(at).map(p => [p.type, p.value]));
  const iso = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: iso };
}

describe.skipIf(!hasDb)('E04: Today\'s Goals server hardening', () => {
  let ctx;
  const T = {};

  const call = (fam, method, path, body) => api(ctx.base, method, path, { token: fam.token, body });
  const list = (fam, q = '') => call(fam, 'GET', '/api/todays-goals' + q);
  const create = (fam, body) => call(fam, 'POST', '/api/todays-goals', body);
  const complete = (fam, goalId, requestId = rid()) =>
    call(fam, 'POST', `/api/todays-goals/${goalId}/complete`, { request_id: requestId });
  const setZone = (code, zone) => ctx.pool.query('UPDATE families SET timezone=$2 WHERE family_code=$1', [code, zone]);
  const balance = async (childId) =>
    (await ctx.pool.query('SELECT total_points FROM children WHERE id=$1', [childId])).rows[0].total_points;

  async function family(name, zone) {
    const f = await makeFamily(ctx.base, name);
    if (zone !== undefined) await setZone(f.code, zone);
    const c = await call(f, 'POST', '/api/children', { name: name + ' child' });
    expect(c.status).toBe(200);
    const cats = (await call(f, 'GET', '/api/behavior-categories')).json;
    return { ...f, child: c.json, kindness: cats.find(x => x.name === 'Kindness'), cats };
  }
  // Family creation is rate limited per hour, so most tests use a fresh child
  // in an existing family instead of a new family.
  async function freshChild(f, name) {
    const c = await call(f, 'POST', '/api/children', { name });
    expect(c.status).toBe(200);
    return { ...f, child: c.json };
  }
  const oneOff = (f, date, extra = {}) => ({
    title: 'Tidy up', child_id: f.child.id, category_id: f.kindness.id,
    schedule_kind: 'one_off', scheduled_date: date, ...extra,
  });

  beforeAll(async () => {
    ctx = await startApp();
    // +14:00 and -11:00: the same instant is always on different local dates.
    T.east = await family('East', 'Pacific/Kiritimati');
    T.west = await family('West', 'Pacific/Pago_Pago');
    T.utc = await family('Utc', null);
    T.a = await family('Alpha', 'Europe/London');
    T.b = await family('Bravo', 'Europe/London');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  describe('family-local dates', () => {
    it('list reports each family\'s own local date and ISO weekday (checked against Intl)', async () => {
      for (const [f, zone] of [[T.east, 'Pacific/Kiritimati'], [T.west, 'Pacific/Pago_Pago'], [T.utc, 'UTC']]) {
        const before = localDay(zone);
        const r = await list(f);
        const after = localDay(zone);
        expect(r.status).toBe(200);
        // Allow the rare case of crossing midnight during the call.
        expect([before.date, after.date]).toContain(r.json.date);
        expect([before.weekday, after.weekday]).toContain(r.json.weekday);
      }
      const e = (await list(T.east)).json.date, w = (await list(T.west)).json.date;
      expect(e > w).toBe(true); // +14 is always ahead of -11
    });

    it('a goal dated for one zone\'s today is "not due" in a family whose today differs', async () => {
      const eastToday = (await list(T.east)).json.date;
      const g = await create(T.east, oneOff(T.east, eastToday));
      expect(g.status).toBe(201);
      // West cannot even create a goal for the east date's child (other family),
      // so test the same rule inside one family by moving its zone.
      await setZone(T.east.code, 'Pacific/Pago_Pago');
      const r = await complete(T.east, g.json.id);
      expect(r.status).toBe(409);
      expect(r.json.error).toMatch(/not scheduled for today/);
      expect(await balance(T.east.child.id)).toBe(0);
      await setZone(T.east.code, 'Pacific/Kiritimati');
      const ok = await complete(T.east, g.json.id);
      expect(ok.status).toBe(200);
      expect(ok.json.date).toBe(eastToday);
    });

    it('NULL timezone uses the UTC calendar for listing, creating and completing', async () => {
      const utcToday = localDay('UTC').date;
      const r = await list(T.utc);
      expect([utcToday, localDay('UTC').date]).toContain(r.json.date);
      const g = await create(T.utc, oneOff(T.utc, r.json.date));
      expect(g.status).toBe(201);
      expect((await complete(T.utc, g.json.id)).status).toBe(200);
    });

    it('rejects a one-off dated yesterday in the family\'s own calendar', async () => {
      const today = (await list(T.west)).json.date;
      const y = new Date(today + 'T00:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
      const r = await create(T.west, oneOff(T.west, y.toISOString().slice(0, 10)));
      expect(r.status).toBe(400);
    });

    it('weekly: due only on a listed weekday of the family-local week', async () => {
      const { weekday } = (await list(T.a)).json;
      const off = [1, 2, 3, 4, 5, 6, 7].filter(d => d !== weekday);
      const due = await create(T.a, { ...oneOff(T.a), schedule_kind: 'weekly', weekdays: [weekday], scheduled_date: undefined });
      const notDue = await create(T.a, { ...oneOff(T.a), title: 'Other days', schedule_kind: 'weekly', weekdays: off, scheduled_date: undefined });
      expect([due.status, notDue.status]).toEqual([201, 201]);
      const ids = (await list(T.a)).json.goals.map(g => g.id);
      expect(ids).toContain(due.json.id);
      expect(ids).not.toContain(notDue.json.id);
      expect((await complete(T.a, notDue.json.id)).status).toBe(409);
    });
  });

  describe('cross-family isolation', () => {
    let goalA;
    beforeAll(async () => {
      const today = (await list(T.a)).json.date;
      goalA = (await create(T.a, oneOff(T.a, today, { title: 'Alpha only' }))).json;
    });

    it('another family cannot list, edit, archive or complete a goal', async () => {
      expect((await list(T.b, '?manage=true')).json.goals.map(g => g.id)).not.toContain(goalA.id);
      const body = oneOff(T.a, goalA.scheduled_date, { title: 'Hijacked' });
      expect((await call(T.b, 'PUT', `/api/todays-goals/${goalA.id}`, body)).status).toBe(404);
      expect((await call(T.b, 'DELETE', `/api/todays-goals/${goalA.id}`)).status).toBe(404);
      expect((await complete(T.b, goalA.id)).status).toBe(404);
      const { rows } = await ctx.pool.query('SELECT title, archived_at FROM today_goals WHERE id=$1', [goalA.id]);
      expect(rows[0]).toEqual({ title: 'Alpha only', archived_at: null });
      expect(await balance(T.a.child.id)).toBe(0);
    });

    it('cannot attach another family\'s child or category, on create or edit', async () => {
      const today = (await list(T.b)).json.date;
      expect((await create(T.b, oneOff(T.b, today, { child_id: T.a.child.id }))).status).toBe(404);
      expect((await create(T.b, oneOff(T.b, today, { category_id: T.a.kindness.id }))).status).toBe(404);
      const own = (await create(T.b, oneOff(T.b, today))).json;
      const edit = await call(T.b, 'PUT', `/api/todays-goals/${own.id}`, oneOff(T.b, today, { category_id: T.a.kindness.id }));
      expect(edit.status).toBe(404);
    });

    it('respects a category restricted to other children', async () => {
      const second = (await call(T.a, 'POST', '/api/children', { name: 'Second' })).json;
      const cat = await call(T.a, 'POST', '/api/behavior-categories', { name: 'Only second', icon_key: 'star' });
      expect(cat.status).toBe(200);
      const upd = await call(T.a, 'PUT', `/api/behavior-categories/${cat.json.id}`, { assigned_children: [second.id] });
      expect(upd.status).toBe(200);
      const today = (await list(T.a)).json.date;
      expect((await create(T.a, oneOff(T.a, today, { category_id: cat.json.id }))).status).toBe(404);
    });
  });

  describe('idempotency and races', () => {
    it('the same request id sent 6 times in parallel awards once; the rest are duplicates', async () => {
      const f = T.b;
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today, { title: 'Parallel same id' }))).json;
      const before = await balance(f.child.id);
      const requestId = rid();
      const rs = await Promise.all(Array.from({ length: 6 }, () => complete(f, g.id, requestId)));
      expect(rs.map(r => r.status).every(s => s === 200)).toBe(true);
      expect(rs.filter(r => r.json.duplicate === false)).toHaveLength(1);
      expect(new Set(rs.map(r => r.json.completion_id)).size).toBe(1);
      expect(await balance(f.child.id)).toBe(before + f.kindness.points);
      const { rows } = await ctx.pool.query('SELECT COUNT(*)::int n FROM point_events WHERE request_id=$1', [requestId]);
      expect(rows[0].n).toBe(1);
    });

    it('6 different request ids in parallel award once; the rest get 409', async () => {
      const f = T.b;
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today, { title: 'Parallel distinct ids' }))).json;
      const before = await balance(f.child.id);
      const rs = await Promise.all(Array.from({ length: 6 }, () => complete(f, g.id)));
      expect(rs.filter(r => r.status === 200)).toHaveLength(1);
      expect(rs.filter(r => r.status === 409)).toHaveLength(5);
      expect(await balance(f.child.id)).toBe(before + f.kindness.points);
    });

    it('a request id already used by a manual award, undo or another goal cannot complete a goal', async () => {
      const f = T.b;
      const today = (await list(f)).json.date;
      const used = rid();
      const award = await call(f, 'POST', `/api/children/${f.child.id}/award`, { points: 1, category: 'Kindness', request_id: used });
      expect(award.status).toBe(200);
      const g1 = (await create(f, oneOff(f, today, { title: 'Reuse award id' }))).json;
      const before = await balance(f.child.id);
      const r1 = await complete(f, g1.id, used);
      expect(r1.status).toBe(409);
      expect(await balance(f.child.id)).toBe(before);
      // A completion's id replayed against a different goal is refused, not replayed.
      const g2 = (await create(f, oneOff(f, today, { title: 'Second goal' }))).json;
      const firstId = rid();
      expect((await complete(f, g1.id, firstId)).status).toBe(200);
      const r2 = await complete(f, g2.id, firstId);
      expect(r2.status).toBe(409);
      const { rows } = await ctx.pool.query('SELECT COUNT(*)::int n FROM today_goal_completions WHERE goal_id=$1', [g2.id]);
      expect(rows[0].n).toBe(0);
    });

    it('rejects malformed request ids and goal ids without touching the ledger', async () => {
      const f = T.b;
      const before = await balance(f.child.id);
      for (const bad of [undefined, '', 'abc', 7, rid().toUpperCase().replace(/-/g, '')]) {
        const r = await call(f, 'POST', `/api/todays-goals/${rid()}/complete`, { request_id: bad });
        expect([400, 404]).toContain(r.status);
      }
      expect((await complete(f, 'not-a-uuid')).status).toBe(404);
      expect(await balance(f.child.id)).toBe(before);
    });
  });

  describe('ledger integrity', () => {
    it('complete, undo, redo, correct, redo: balances and links stay consistent', async () => {
      const f = await freshChild(T.a, 'Ledger');
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today, { title: 'Ledger goal' }))).json;
      const p = f.kindness.points;
      const c1 = await complete(f, g.id);
      expect(c1.status).toBe(200);
      expect((await complete(f, g.id)).status).toBe(409); // already done today
      const u = await call(f, 'POST', `/api/point-events/${c1.json.event.id}/undo`, { request_id: rid() });
      expect(u.status).toBe(200);
      const c2 = await complete(f, g.id);
      expect(c2.status).toBe(200);
      const k = await call(f, 'POST', `/api/point-events/${c2.json.event.id}/correct`, { request_id: rid() });
      expect(k.status).toBe(200);
      const c3 = await complete(f, g.id);
      expect(c3.status).toBe(200);
      expect(await balance(f.child.id)).toBe(p);

      const { rows: sum } = await ctx.pool.query('SELECT COALESCE(SUM(points),0)::int s FROM point_events WHERE child_id=$1', [f.child.id]);
      expect(sum[0].s).toBe(p);
      const { rows: comps } = await ctx.pool.query(`
        SELECT x.awarded_points, x.undone_at IS NOT NULL AS undone, e.points,
          EXISTS (SELECT 1 FROM point_events r WHERE r.reverses_id = e.id) AS reversed
        FROM today_goal_completions x JOIN point_events e ON e.id = x.point_event_id
        WHERE x.goal_id = $1 ORDER BY x.created_at`, [g.id]);
      expect(comps).toHaveLength(3);
      for (const c of comps) {
        expect(c.awarded_points).toBe(c.points);
        expect(c.undone).toBe(c.reversed);
      }
      expect(comps.map(c => c.undone)).toEqual([true, true, false]);
    });

    it('a category points change after completion keeps the awarded amount', async () => {
      const f = await freshChild(T.a, 'Repricing');
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today))).json;
      const c = await complete(f, g.id);
      const awarded = c.json.event.points;
      const up = await call(f, 'PUT', `/api/behavior-categories/${f.kindness.id}`, { points: awarded + 4 });
      expect(up.status).toBe(200);
      const { rows } = await ctx.pool.query('SELECT awarded_points FROM today_goal_completions WHERE id=$1', [c.json.completion_id]);
      expect(rows[0].awarded_points).toBe(awarded);
      expect(await balance(f.child.id)).toBe(awarded);
    });

    it('deleting an unused custom category leaves the goal listed but not completable', async () => {
      const f = await freshChild(T.a, 'Deleted cat');
      const cat = (await call(f, 'POST', '/api/behavior-categories', { name: 'Temporary', icon_key: 'star' })).json;
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today, { category_id: cat.id }))).json;
      expect((await call(f, 'DELETE', `/api/behavior-categories/${cat.id}`)).status).toBe(200);
      const row = (await list(f)).json.goals.find(x => x.id === g.id);
      expect(row).toBeTruthy();
      expect(row.category_id).toBeNull();
      const r = await complete(f, g.id);
      expect(r.status).toBe(409);
      expect(await balance(f.child.id)).toBe(0);
    });

    it('an archived goal cannot be completed; its earlier award stays', async () => {
      const f = await freshChild(T.a, 'Archive');
      const today = (await list(f)).json.date;
      const g = (await create(f, { ...oneOff(f), schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], scheduled_date: undefined })).json;
      const c = await complete(f, g.id);
      expect(c.status).toBe(200);
      expect((await call(f, 'DELETE', `/api/todays-goals/${g.id}`)).status).toBe(200);
      expect((await complete(f, g.id)).status).toBe(404);
      expect(await balance(f.child.id)).toBe(c.json.event.points);
      expect(today).toBe(c.json.date);
    });
  });

  describe('migration 014 and existing families', () => {
    it('re-running 014 is a no-op: no backfill, no change to families, children, points or goals', async () => {
      const snap = async () => (await ctx.pool.query(`
        SELECT (SELECT COUNT(*) FROM families)::int fams, (SELECT COUNT(*) FROM children)::int kids,
          (SELECT COALESCE(SUM(total_points),0) FROM children)::int pts,
          (SELECT COUNT(*) FROM point_events)::int events,
          (SELECT COUNT(*) FROM today_goals)::int goals,
          (SELECT COUNT(*) FROM today_goal_completions)::int comps`)).rows[0];
      const before = await snap();
      const sql = fs.readFileSync(new URL('../migrations/014_todays_goals.sql', import.meta.url), 'utf8');
      await ctx.pool.query(sql);
      await ctx.pool.query(sql);
      expect(await snap()).toEqual(before);
      // A family that never used goals has none.
      // West only ever had a refused create, so it has no goals.
      const { rows } = await ctx.pool.query('SELECT COUNT(*)::int n FROM today_goals WHERE family_code=$1', [T.west.code]);
      expect(rows[0].n).toBe(0);
    });

    it('the schema refuses malformed rows the API would never write', async () => {
      const f = T.a;
      const bad = [
        ["'one_off'", 'NULL', "'{}'", 'CURRENT_DATE'],
        ["'one_off'", 'CURRENT_DATE', "'{1}'", 'CURRENT_DATE'],
        ["'weekly'", 'CURRENT_DATE', "'{1}'", 'CURRENT_DATE'],
        ["'weekly'", 'NULL', "'{}'", 'CURRENT_DATE'],
        ["'weekly'", 'NULL', "'{0}'", 'CURRENT_DATE'],
        ["'weekly'", 'NULL', "'{8}'", 'CURRENT_DATE'],
        ["'monthly'", 'NULL', "'{1}'", 'CURRENT_DATE'],
      ];
      for (const [kind, sched, days, start] of bad) {
        await expect(ctx.pool.query(`INSERT INTO today_goals (family_code, child_id, title, schedule_kind, scheduled_date, weekdays, start_date)
          VALUES ($1, $2, 'x', ${kind}, ${sched}, ${days}::smallint[], ${start})`, [f.code, f.child.id]), `${kind} ${sched} ${days}`).rejects.toThrow();
      }
    });
  });

  // Findings from the independent E04 review (docs/engineering/E04-GOALS-SERVER-REVIEW.md).
  describe('review findings', () => {
    it('R1: a goal completed as weekly cannot be turned into a one-off (its old completions would block it forever)', async () => {
      const f = await freshChild(T.b, 'R1');
      const today = (await list(f)).json.date;
      const g = (await create(f, { ...oneOff(f), schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], scheduled_date: undefined })).json;
      expect((await complete(f, g.id)).status).toBe(200);
      // Simulate that completion being from an earlier day.
      await ctx.pool.query("UPDATE today_goal_completions SET scheduled_for = scheduled_for - 1 WHERE goal_id=$1", [g.id]);
      const edit = await call(f, 'PUT', `/api/todays-goals/${g.id}`, oneOff(f, today));
      expect(edit.status).toBe(409);
      expect(edit.json.error).toMatch(/separate goal/i);
      // Same kind, new days: still allowed.
      const keep = await call(f, 'PUT', `/api/todays-goals/${g.id}`, { ...oneOff(f), schedule_kind: 'weekly', weekdays: [1, 3], scheduled_date: undefined, start_date: today });
      expect(keep.status).toBe(200);
      // A goal with no completions can still change kind.
      const fresh = (await create(f, { ...oneOff(f), title: 'Unused', schedule_kind: 'weekly', weekdays: [1], scheduled_date: undefined })).json;
      expect((await call(f, 'PUT', `/api/todays-goals/${fresh.id}`, oneOff(f, today, { title: 'Unused' }))).status).toBe(200);
    });

    it('R2: moving a goal to a category that is being deleted gives 404, never a 500', async () => {
      const f = await freshChild(T.b, 'R2');
      const today = (await list(f)).json.date;
      const cat = (await call(f, 'POST', '/api/behavior-categories', { name: 'Going away', icon_key: 'star' })).json;
      const g = (await create(f, oneOff(f, today))).json;
      const del = await ctx.pool.connect();
      try {
        await del.query('BEGIN');
        await del.query('DELETE FROM behavior_categories WHERE id=$1', [cat.id]);
        const pending = call(f, 'PUT', `/api/todays-goals/${g.id}`, oneOff(f, today, { category_id: cat.id }));
        await new Promise(r => setTimeout(r, 300)); // let the edit reach its lock wait
        await del.query('COMMIT');
        const r = await pending;
        expect(r.status, r.text).toBe(404);
      } finally { del.release(); }
      const { rows } = await ctx.pool.query('SELECT category_id FROM today_goals WHERE id=$1', [g.id]);
      expect(rows[0].category_id).toBe(f.kindness.id);
    });

    it('R3: a goal completion\'s request id is not replayed as a manual award', async () => {
      const f = await freshChild(T.b, 'R3');
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today))).json;
      const used = rid();
      const c = await complete(f, g.id, used);
      expect(c.status).toBe(200);
      const before = await balance(f.child.id);
      const r = await call(f, 'POST', `/api/children/${f.child.id}/award`, { points: c.json.event.points, category: c.json.event.category, request_id: used });
      expect(r.status).toBe(409);
      expect(await balance(f.child.id)).toBe(before);
      // A plain award retry still replays.
      const plain = rid();
      const a1 = await call(f, 'POST', `/api/children/${f.child.id}/award`, { points: 2, category: 'Kindness', request_id: plain });
      const a2 = await call(f, 'POST', `/api/children/${f.child.id}/award`, { points: 2, category: 'Kindness', request_id: plain });
      expect([a1.status, a2.status]).toEqual([200, 200]);
      expect(a2.json.duplicate).toBe(true);
    });

    it('R4: upper-case ids are treated like lower-case ids', async () => {
      const f = await freshChild(T.b, 'R4');
      const cat = (await call(f, 'POST', '/api/behavior-categories', { name: 'R4 only', icon_key: 'star' })).json;
      expect((await call(f, 'PUT', `/api/behavior-categories/${cat.id}`, { assigned_children: [f.child.id] })).status).toBe(200);
      const today = (await list(f)).json.date;
      const up = oneOff(f, today, { child_id: f.child.id.toUpperCase(), category_id: cat.id.toUpperCase() });
      const g = await create(f, up);
      expect(g.status, g.text).toBe(201);
      const edit = await call(f, 'PUT', `/api/todays-goals/${g.json.id}`, { ...up, title: 'Renamed' });
      expect(edit.status, edit.text).toBe(200);
    });
  });

  describe('export', () => {
    it('includes undone completions with their undone marker, and archived goals', async () => {
      const f = await freshChild(T.a, 'Export');
      const today = (await list(f)).json.date;
      const g = (await create(f, oneOff(f, today))).json;
      const c = await complete(f, g.id);
      await call(f, 'POST', `/api/point-events/${c.json.event.id}/undo`, { request_id: rid() });
      await call(f, 'DELETE', `/api/todays-goals/${g.id}`);
      const ex = await call(f, 'GET', '/api/family/export');
      expect(ex.status).toBe(200);
      const text = ex.text;
      const data = JSON.parse(text);
      const goals = data.todays_goals || data.today_goals || data.todaysGoals;
      const comps = data.today_goal_completions || data.todayGoalCompletions || data.todays_goal_completions;
      expect(Array.isArray(goals), `export keys: ${Object.keys(data)}`).toBe(true);
      expect(Array.isArray(comps)).toBe(true);
      expect(goals.find(x => x.id === g.id).archived_at).toBeTruthy();
      const exported = comps.find(x => x.id === c.json.completion_id);
      expect(exported.undone_at).toBeTruthy();
      expect(text).not.toContain(T.b.child.id); // another family's child
    });
  });
});
