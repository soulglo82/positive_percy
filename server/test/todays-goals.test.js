// @vitest-environment node
// Batch E: recurring/one-off goals must use the existing points ledger,
// respect the family's local calendar, and never double-award.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const id = () => crypto.randomUUID();

describe.skipIf(!hasDb)("Batch E: Today's Goals", () => {
  let ctx, fam, other, child, stranger, kindness, helpful, today, weekday;
  let oneOff, weekly;
  const list = (token = fam.token, suffix = '') =>
    api(ctx.base, 'GET', '/api/todays-goals' + suffix, { token });
  const create = (body, token = fam.token) =>
    api(ctx.base, 'POST', '/api/todays-goals', { token, body });
  const complete = (goalId, requestId = id(), token = fam.token) =>
    api(ctx.base, 'POST', `/api/todays-goals/${goalId}/complete`, {
      token, body: { request_id: requestId },
    });

  beforeAll(async () => {
    ctx = await startApp();
    fam = await makeFamily(ctx.base, 'Goals family');
    other = await makeFamily(ctx.base, 'Other family');
    const a = await api(ctx.base, 'POST', '/api/children', {
      token: fam.token, body: { name: 'Percy child' },
    });
    const b = await api(ctx.base, 'POST', '/api/children', {
      token: other.token, body: { name: 'Other child' },
    });
    expect([a.status, b.status]).toEqual([200, 200]);
    child = a.json; stranger = b.json;
    const zone = await api(ctx.base, 'PUT', '/api/family/timezone', {
      token: fam.token, body: { timezone: 'Asia/Singapore' },
    });
    expect(zone.status).toBe(200);
    const catRes = await api(ctx.base, 'GET', '/api/behavior-categories', {
      token: fam.token,
    });
    kindness = catRes.json.find(x => x.name === 'Kindness');
    helpful = catRes.json.find(x => x.name === 'Helpfulness');
    const initial = await list();
    expect(initial.status).toBe(200);
    today = initial.json.date; weekday = initial.json.weekday;
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(weekday).toBeGreaterThanOrEqual(1);
    expect(weekday).toBeLessThanOrEqual(7);
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const payload = (title, categoryId = kindness.id) => ({
    title, child_id: child.id, category_id: categoryId,
    schedule_kind: 'one_off', scheduled_date: today,
  });

  const balance = async () => {
    const { rows } = await ctx.pool.query('SELECT total_points FROM children WHERE id=$1', [child.id]);
    return rows[0].total_points;
  };
  const eventSum = async () => {
    const { rows } = await ctx.pool.query(
      'SELECT COALESCE(SUM(points),0)::int AS points FROM point_events WHERE child_id=$1', [child.id]);
    return rows[0].points;
  };

  it('accepts a per-child one-off due today and lists it only to its family', async () => {
    const r = await create(payload('Tidy up books'));
    expect(r.status).toBe(201);
    oneOff = r.json;
    const due = await list();
    expect(due.status).toBe(200);
    expect(due.json.goals.find(g => g.id === oneOff.id)).toMatchObject({
      title: 'Tidy up books', child_id: child.id, schedule_kind: 'one_off',
      scheduled_date: today, category_points: 1, completion_id: null,
    });
    expect((await list(other.token)).json.goals).toEqual([]);
    expect((await complete(oneOff.id, id(), other.token)).status).toBe(404);
    expect((await create({ ...payload('Wrong family child'), child_id: stranger.id })).status).toBe(404);
  });

  it('rejects invalid dates, weekdays, user-supplied points and wrong categories', async () => {
    for (const bad of [
      { ...payload('Date issue'), scheduled_date: '2026-02-30' },
      { ...payload('Missing category'), category_id: id() },
      { ...payload('Duplicate weekdays'), schedule_kind: 'weekly', scheduled_date: null, weekdays: [1,1] },
      { ...payload('No weekdays'), schedule_kind: 'weekly', scheduled_date: null, weekdays: [] },
      { ...payload('Too long ' + 'x'.repeat(120)) },
    ]) {
      const r = await create(bad);
      expect(r.status, JSON.stringify(bad)).toBeGreaterThanOrEqual(400);
    }
    // The goal creation API has no points field; client-supplied points can
    // never set the award amount. It always reads the category value.
    const r = await create({ ...payload('Client cannot force points'), points: 999 });
    expect(r.status).toBe(201);
    expect((await complete(r.json.id)).json.event.points).toBe(1);
    expect(await balance()).toBe(1);
  });

  it('completes one-off once, retry-safe and with consistent points history', async () => {
    const firstId = id();
    const a = await complete(oneOff.id, firstId);
    expect(a.status).toBe(200);
    expect(a.json).toMatchObject({ goal_id: oneOff.id, date: today, duplicate: false });
    expect(a.json.event.points).toBe(1);
    const replay = await complete(oneOff.id, firstId);
    expect(replay.status).toBe(200);
    expect(replay.json.duplicate).toBe(true);
    expect(replay.json.event.id).toBe(a.json.event.id);
    const again = await complete(oneOff.id);
    expect(again.status).toBe(409);
    expect(await balance()).toBe(2);
    expect(await eventSum()).toBe(await balance());
    const shown = (await list()).json.goals.find(g => g.id === oneOff.id);
    expect(shown.completion_id).toBeTruthy();
    expect(shown.awarded_points).toBe(1);
  });

  it('reads current category values, not client amounts or stale goal config', async () => {
    const change = await api(ctx.base, 'PUT', `/api/behavior-categories/${helpful.id}`, {
      token: fam.token, body: { points: 6 },
    });
    expect(change.status).toBe(200);
    const r = await create(payload('Help with dishes', helpful.id));
    expect(r.status).toBe(201);
    const goal = r.json;
    const done = await complete(goal.id);
    expect(done.status).toBe(200);
    expect(done.json.event.points).toBe(6);
    const updateCategory = await api(ctx.base, 'PUT', `/api/behavior-categories/${helpful.id}`, {
      token: fam.token, body: { points: 2 },
    });
    expect(updateCategory.status).toBe(200);
    const history = await ctx.pool.query('SELECT points FROM point_events WHERE id=$1', [done.json.event.id]);
    expect(history.rows[0].points).toBe(6);
    expect(await balance()).toBe(await eventSum());
  });

  it('supports weekly routine weekdays and refuses off-day completion', async () => {
    const offDay = weekday === 7 ? 1 : weekday + 1;
    const away = await create({
      title: 'Weekly on another day', child_id: child.id, category_id: kindness.id,
      schedule_kind: 'weekly', weekdays: [offDay], start_date: today,
    });
    expect(away.status).toBe(201);
    expect((await complete(away.json.id)).status).toBe(409);
    const here = await create({
      title: 'Read today and other days', child_id: child.id,
      category_id: kindness.id, schedule_kind: 'weekly',
      weekdays: [weekday, offDay], start_date: today,
    });
    expect(here.status).toBe(201);
    weekly = here.json;
    const first = await complete(weekly.id);
    expect(first.status).toBe(200);
    expect(first.json.event.points).toBe(1);
    expect((await complete(weekly.id)).status).toBe(409);
  });

  it('rejects a weekly edit with a start date before the family-local day', async () => {
    const created = await create({
      title: 'Weekly future routine', child_id: child.id, category_id: kindness.id,
      schedule_kind: 'weekly', weekdays: [weekday], start_date: today,
    });
    expect(created.status).toBe(201);
    const yesterday = new Date(today + 'T00:00:00.000Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const changed = await api(ctx.base, 'PUT', `/api/todays-goals/${created.json.id}`, {
      token: fam.token,
      body: {
        title: 'Backdated routine', child_id: child.id, category_id: kindness.id,
        schedule_kind: 'weekly', weekdays: [weekday],
        start_date: yesterday.toISOString().slice(0, 10),
      },
    });
    expect(changed.status).toBe(400);
    const saved = (await list(fam.token, '?manage=true')).json.goals.find(g => g.id === created.json.id);
    expect(saved.title).toBe('Weekly future routine');
    expect(saved.start_date).toBe(today);
  });

  it('concurrent double taps produce one goal completion and one award', async () => {
    const created = await create(payload('Concurrent task'));
    expect(created.status).toBe(201);
    const before = await balance();
    const sameId = id();
    const [a,b] = await Promise.all([complete(created.json.id,sameId),complete(created.json.id,sameId)]);
    expect([a.status,b.status]).toEqual([200,200]);
    expect([a.json.duplicate,b.json.duplicate].sort()).toEqual([false,true]);
    expect(await balance()).toBe(before + 1);
    const x = await create(payload('Two different request ids'));
    const initial = await balance();
    const [c,d] = await Promise.all([complete(x.json.id),complete(x.json.id)]);
    expect([c.status,d.status].sort()).toEqual([200,409]);
    expect(await balance()).toBe(initial + 1);
    const rows = await ctx.pool.query(
      'SELECT count(*)::int AS count FROM today_goal_completions WHERE goal_id=$1 AND undone_at IS NULL',
      [x.json.id]);
    expect(rows.rows[0].count).toBe(1);
  });

  it('correction reverses a goal without deleting history, and allows redoing today', async () => {
    const done = await list();
    const eventId = done.json.goals.find(g => g.id === weekly.id).point_event_id;
    expect(eventId).toBeTruthy();
    const before = await balance();
    const correction = await api(ctx.base, 'POST', `/api/point-events/${eventId}/correct`, {
      token: fam.token, body: { request_id: id() },
    });
    expect(correction.status).toBe(200);
    expect(await balance()).toBe(before - 1);
    const current = (await list()).json.goals.find(g => g.id === weekly.id);
    expect(current.completion_id).toBe(null);
    expect((await complete(weekly.id)).status).toBe(200);
    expect(await balance()).toBe(before);
    expect(await eventSum()).toBe(await balance());
    const historic = await ctx.pool.query(
      'SELECT count(*)::int AS count, count(undone_at)::int AS undone FROM today_goal_completions WHERE goal_id=$1',
      [weekly.id]);
    expect(historic.rows[0]).toEqual({ count: 2, undone: 1 });
  });

  it('editing cannot move a goal to another child; archiving keeps old awards', async () => {
    const attempt = await api(ctx.base, 'PUT', `/api/todays-goals/${oneOff.id}`, {
      token: fam.token, body: { ...payload('Move child'), child_id: stranger.id },
    });
    expect(attempt.status).toBe(409);
    const before = await balance();
    const deleted = await api(ctx.base, 'DELETE', `/api/todays-goals/${oneOff.id}`, {
      token: fam.token,
    });
    expect(deleted.status).toBe(200);
    expect((await complete(oneOff.id)).status).toBe(404);
    expect((await list()).json.goals.find(x => x.id === oneOff.id)).toBeUndefined();
    expect(await balance()).toBe(before);
  });

  it('family export includes own completion and archived goal, never another family', async () => {
    const exp = await api(ctx.base, 'GET', '/api/family/export?photos=exclude', { token: fam.token });
    expect(exp.status).toBe(200);
    expect(exp.json.todaysGoals.some(g => g.id === oneOff.id && g.archived_at)).toBe(true);
    expect(exp.json.todayGoalCompletions.some(c => c.goal_id === weekly.id)).toBe(true);
    const foreign = await api(ctx.base, 'GET', '/api/family/export?photos=exclude', { token: other.token });
    expect(foreign.status).toBe(200);
    expect(foreign.json.todaysGoals).toEqual([]);
    expect(foreign.json.todayGoalCompletions).toEqual([]);
  });
});
