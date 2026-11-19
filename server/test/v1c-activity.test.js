// @vitest-environment node
// V1-C Activity (docs/engineering/V1-C-DESIGN.md §3): the feed's four
// filters are projections of "All"; goal rows are tagged by the completion
// join, never the note; C7 holds (an undone award is never "earned");
// "Goals completed" counts this week's completions that were not undone.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!hasDb)('V1-C: activity feed and weekly goals count', () => {
  let ctx, F, kindness, kid, sib, ev;
  const call = (method, path, body) => api(ctx.base, method, path, { token: F.token, body });
  const feed = async (filter, extra = '') => (await call('GET', `/api/activity-feed?filter=${filter}&limit=200${extra}`)).json;
  const mine = (rows, c = kid) => rows.filter((r) => r.child_id === c.id);
  const award = async (c, points, category = 'Kindness', note) =>
    (await call('POST', `/api/children/${c.id}/award`, { points, category, note, request_id: rid() })).json.event;

  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Activity family');
    kindness = (await call('GET', '/api/behavior-categories')).json.find((x) => x.name === 'Kindness');
    kid = (await call('POST', '/api/children', { name: 'Ada' })).json;
    sib = (await call('POST', '/api/children', { name: 'Ben' })).json;
    const today = (await call('GET', '/api/todays-goals')).json.date;
    const goal = (await call('POST', '/api/todays-goals', {
      title: 'Finish homework', child_id: kid.id, category_id: kindness.id, schedule_kind: 'one_off', scheduled_date: today })).json;
    const done = (await call('POST', `/api/todays-goals/${(goal.goal || goal).id}/complete`, { request_id: rid() })).json;
    ev = {};
    ev.goal = done.event;
    ev.plain = await award(kid, 3, 'Kindness', 'Helped a friend');
    // A plain award whose note looks like a goal must not be tagged (E4).
    ev.lookalike = await award(kid, 2, 'Kindness', 'Today’s Goal · Finish homework');
    ev.undone = await award(kid, 9);
    await call('POST', `/api/point-events/${ev.undone.id}/undo`, { request_id: rid() });
    const reward = (await call('POST', '/api/rewards', { title: 'Movie night', cost_points: 2 })).json;
    ev.spend = (await call('POST', `/api/children/${kid.id}/redeem`, { reward_id: reward.id, request_id: rid() })).json.redemption;
    ev.reversed = (await call('POST', `/api/children/${kid.id}/redeem`, { reward_id: reward.id, request_id: rid() })).json.redemption;
    await call('POST', `/api/redemptions/${ev.reversed.id}/undo`, { request_id: rid() });
    await award(sib, 5);
    // A legacy 'award' row with an excluded category (migration 009's view).
    await ctx.pool.query(
      "INSERT INTO point_events (child_id, child_name, points, category, family_code, kind) VALUES ($1, 'Ada', 6, 'Starting points', $2, 'award')",
      [kid.id, F.code]);
  }, 60000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('every filter is a subset of All; Earned and Goals are disjoint; none holds an undone row', async () => {
    const all = mine(await feed('all'));
    const key = (r) => r.type + ':' + r.id;
    const allKeys = new Set(all.map(key));
    const sets = {};
    for (const f of ['earned', 'goals', 'spent']) {
      const rows = mine(await feed(f));
      sets[f] = rows;
      for (const r of rows) {
        expect(allKeys.has(key(r)), `${f} row ${key(r)} is in All`).toBe(true);
        expect(r.undone, `${f} row ${key(r)} is not undone`).toBe(false);
      }
    }
    const goalIds = new Set(sets.goals.map((r) => r.id));
    expect(sets.earned.some((r) => goalIds.has(r.id))).toBe(false);
    expect(sets.earned.map((r) => r.id).sort()).toEqual([ev.plain.id, ev.lookalike.id].sort());
    expect(sets.goals.map((r) => r.id)).toEqual([ev.goal.id]);
    expect(sets.spent.map((r) => r.id)).toEqual([ev.spend.id]);
  });

  it('the goal tag comes from the completion join, not the note (E4)', async () => {
    const all = mine(await feed('all'));
    const goal = all.find((r) => r.id === ev.goal.id);
    expect(goal).toMatchObject({ type: 'earn', goal_title: 'Finish homework', label: 'Kindness' });
    expect(goal.goal_completion_id).toBeTruthy();
    expect(all.find((r) => r.id === ev.lookalike.id).goal_completion_id).toBeNull();
    expect(all.find((r) => r.type === 'spend' && r.id === ev.spend.id).goal_title).toBeNull();
  });

  it('All keeps undone rows marked; a legacy starting-points award is never earned (E1c)', async () => {
    const all = mine(await feed('all'));
    expect(all.find((r) => r.id === ev.undone.id)).toMatchObject({ type: 'earn', undone: true });
    expect(all.filter((r) => r.id === ev.reversed.id).map((r) => [r.type, r.undone]).sort()).toEqual([['spend', true], ['undo', true]]);
    expect(all.find((r) => r.label === 'Starting points')).toMatchObject({ type: 'starting' });
  });

  it('the child filter narrows on the server, before paging (E7)', async () => {
    const rows = await feed('all', `&child_id=${sib.id}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.child_id === sib.id)).toBe(true);
    const page = await (await call('GET', `/api/activity-feed?filter=earned&limit=1&offset=0&child_id=${sib.id}`)).json;
    expect(page.map((r) => r.child_id)).toEqual([sib.id]);
    expect((await call('GET', '/api/activity-feed?child_id=nope')).status).toBe(400);
  });

  it('paging follows the filtered set in a stable order (E7)', async () => {
    const full = mine(await feed('all'));
    const paged = [];
    for (let o = 0; o < 40; o += 2) {
      const rows = (await call('GET', `/api/activity-feed?filter=all&limit=2&offset=${o}&child_id=${kid.id}`)).json;
      paged.push(...rows);
      if (rows.length < 2) break;
    }
    expect(paged.map((r) => r.type + r.id)).toEqual(full.map((r) => r.type + r.id));
  });

  it('Goals completed counts this week, not undone ones (E1, E9)', async () => {
    const before = (await call('GET', '/api/summary')).json.goalsCompleted;
    expect(before).toBe(1);
    // An undone completion is not counted.
    await call('POST', `/api/point-events/${ev.goal.id}/undo`, { request_id: rid() });
    expect((await call('GET', '/api/summary')).json.goalsCompleted).toBe(0);
    // A completion from before this week is not counted.
    await ctx.pool.query("UPDATE today_goal_completions SET undone_at = NULL, created_at = NOW() - INTERVAL '8 days' WHERE child_id = $1", [kid.id]);
    expect((await call('GET', '/api/summary')).json.goalsCompleted).toBe(0);
    // After the undo, the goal award leaves Goals (C7).
    expect(mine(await feed('goals'))).toEqual([]);
  });
});
