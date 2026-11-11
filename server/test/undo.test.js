// @vitest-environment node
// A2 PR2: undo an award (U1) or a spend (U2) within 10 minutes. Balance
// always equals history (C4), undone awards never count as earned (C7),
// every undo applies once per request id (C5).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!runDb)('A2 PR2: undo', () => {
  let ctx, F, G;
  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Undo family');
    G = await makeFamily(ctx.base, 'Other family');
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const q = (sql, p) => ctx.pool.query(sql, p).then((r) => r.rows);
  const newChild = async (fam = F, name = 'Kid') =>
    (await api(ctx.base, 'POST', '/api/children', { token: fam.token, body: { name } })).json;
  const award = (c, points, fam = F, request_id = rid()) =>
    api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: fam.token, body: { points, category: 'Kindness', request_id } });
  const undoAward = (eventId, fam = F, request_id = rid()) =>
    api(ctx.base, 'POST', `/api/point-events/${eventId}/undo`, { token: fam.token, body: { request_id } });
  const undoSpend = (redemptionId, fam = F, request_id = rid()) =>
    api(ctx.base, 'POST', `/api/redemptions/${redemptionId}/undo`, { token: fam.token, body: { request_id } });
  const reward = async (cost, fam = F) =>
    (await api(ctx.base, 'POST', '/api/rewards', { token: fam.token, body: { title: `R${cost}`, cost_points: cost } })).json;
  const redeem = (c, r, fam = F) =>
    api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: fam.token, body: { reward_id: r.id, request_id: rid() } });
  const balance = async (id) => (await q('SELECT total_points FROM children WHERE id = $1', [id]))[0].total_points;
  const history = async (id) => {
    const [e] = await q('SELECT COALESCE(SUM(points),0)::int AS s FROM point_events WHERE child_id = $1', [id]);
    const [s] = await q("SELECT COALESCE(SUM(reward_cost),0)::int AS s FROM redemptions WHERE child_id = $1 AND status = 'Completed'", [id]);
    return e.s - s.s;
  };
  const weekOf = async (fam, id) =>
    (await api(ctx.base, 'GET', '/api/children', { token: fam.token })).json.find((c) => c.id === id).week_points;

  it('U1: undo an award takes exactly those points back, history still adds up, the week drops', async () => {
    const c = await newChild();
    await award(c, 20);
    const a = (await award(c, 10)).json;
    expect(await weekOf(F, c.id)).toBe(30);
    const r = await undoAward(a.event.id);
    expect(r.status).toBe(200);
    expect(r.json.child.total_points).toBe(20);
    expect(await balance(c.id)).toBe(20);
    expect(await history(c.id)).toBe(20);
    expect(await weekOf(F, c.id)).toBe(20);
    const rows = await q("SELECT kind, points, reverses_id FROM point_events WHERE child_id = $1 AND kind = 'undo'", [c.id]);
    expect(rows).toEqual([{ kind: 'undo', points: -10, reverses_id: a.event.id }]);
  });

  it('U1: the same request id replays; a second undo of the same award is refused', async () => {
    const c = await newChild();
    const a = (await award(c, 15)).json;
    const id = rid();
    const [x, y] = await Promise.all([undoAward(a.event.id, F, id), undoAward(a.event.id, F, id)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect([x.json.duplicate, y.json.duplicate].sort()).toEqual([false, true]);
    expect(await balance(c.id)).toBe(0);
    expect((await undoAward(a.event.id)).status).toBe(409);
    expect(await balance(c.id)).toBe(0);
  });

  it('U1: two different request ids racing on one award: exactly one applies', async () => {
    const c = await newChild();
    await award(c, 5);
    const a = (await award(c, 10)).json;
    const [x, y] = await Promise.all([undoAward(a.event.id), undoAward(a.event.id)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(await balance(c.id)).toBe(5);
    expect(await history(c.id)).toBe(5);
  });

  it('U1: refused when the points are already spent, so the balance never goes below 0', async () => {
    const c = await newChild();
    const a = (await award(c, 10)).json;
    await redeem(c, await reward(8));
    const r = await undoAward(a.event.id);
    expect(r.status).toBe(409);
    expect(await balance(c.id)).toBe(2);
    expect(await history(c.id)).toBe(2);
  });

  it('U1: refused when the points are set aside in the reward stack', async () => {
    const c = await newChild();
    const a = (await award(c, 10)).json;
    const r6 = await reward(6);
    expect((await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: r6.id } })).status).toBe(200);
    expect((await undoAward(a.event.id)).status).toBe(409);
    expect(await balance(c.id)).toBe(10);
  });

  it('U1: undo of a deduction gives back exactly what was taken', async () => {
    const c = await newChild();
    await award(c, 3);
    const d = (await award(c, -10)).json; // capped at -3
    expect(d.event.points).toBe(-3);
    expect((await undoAward(d.event.id)).status).toBe(200);
    expect(await balance(c.id)).toBe(3);
    expect(await history(c.id)).toBe(3);
  });

  it('U1: over 10 minutes, another family, starting points, corrections and undo rows: 404', async () => {
    const c = await newChild();
    const old = (await award(c, 4)).json;
    await q("UPDATE point_events SET created_date = now() - interval '11 minutes' WHERE id = $1", [old.event.id]);
    expect((await undoAward(old.event.id)).status).toBe(404);
    const mine = (await award(c, 4)).json;
    expect((await undoAward(mine.event.id, G)).status).toBe(404);
    const [corr] = await q(
      `INSERT INTO point_events (child_id, points, category, family_code, kind) VALUES ($1, 0, 'Balance correction', $2, 'correction') RETURNING id`,
      [c.id, F.code]);
    expect((await undoAward(corr.id)).status).toBe(404);
    const u = (await undoAward(mine.event.id)).json;
    expect((await undoAward(u.event.id)).status).toBe(404);
    expect((await undoAward('not-a-uuid')).status).toBe(404);
  });

  it('U1/I0: an undo request id already used by an award or a spend is refused', async () => {
    const c = await newChild();
    const id = rid();
    await award(c, 10, F, id);
    const a = (await award(c, 5)).json;
    expect((await undoAward(a.event.id, F, id)).status).toBe(409);
    expect(await balance(c.id)).toBe(15);
  });

  it('C7: an undone award never counts in summary, motivation or the earned feed', async () => {
    const c = await newChild(F, 'Summed');
    await award(c, 7);
    const a = (await award(c, 9)).json;
    await undoAward(a.event.id);
    const earned = (await api(ctx.base, 'GET', '/api/activity-feed?filter=earned', { token: F.token })).json
      .filter((r) => r.child_id === c.id);
    expect(earned.map((r) => r.points)).toEqual([7]);
    const [v] = await q('SELECT COALESCE(SUM(points),0)::int AS s FROM effective_point_events WHERE child_id = $1', [c.id]);
    expect(v.s).toBe(7);
  });

  it('Feed: shows the award and its undo, both marked undone, and rows add up to the balance', async () => {
    const c = await newChild(F, 'Feedkid');
    await award(c, 12);
    const a = (await award(c, 6)).json;
    await undoAward(a.event.id);
    const feed = (await api(ctx.base, 'GET', '/api/activity-feed', { token: F.token })).json.filter((r) => r.child_id === c.id);
    const undone = feed.filter((r) => r.undone);
    expect(undone.map((r) => r.points).sort((x, y) => x - y)).toEqual([-6, 6]);
    expect(feed.reduce((s, r) => s + r.points, 0)).toBe(await balance(c.id));
  });

  it('U2: undo a spend gives the points back, marks it Reversed, and the feed still adds up', async () => {
    const c = await newChild(F, 'Spendkid');
    await award(c, 30);
    const red = (await redeem(c, await reward(10))).json.redemption;
    const r = await undoSpend(red.id);
    expect(r.status).toBe(200);
    expect(r.json.child.total_points).toBe(30);
    const [row] = await q('SELECT status, reversed_at FROM redemptions WHERE id = $1', [red.id]);
    expect(row.status).toBe('Reversed');
    expect(row.reversed_at).not.toBeNull();
    const [ch] = await q('SELECT total_points, points_spent FROM children WHERE id = $1', [c.id]);
    expect(ch).toEqual({ total_points: 30, points_spent: 0 });
    expect(await history(c.id)).toBe(30);
    const feed = (await api(ctx.base, 'GET', '/api/activity-feed', { token: F.token })).json.filter((x) => x.child_id === c.id);
    expect(feed.reduce((s, x) => s + x.points, 0)).toBe(30);
    expect(feed.filter((x) => x.undone)).toHaveLength(2);
  });

  it('U2: replay, double undo, other family and over 10 minutes', async () => {
    const c = await newChild(F, 'Spendkid2');
    await award(c, 30);
    const red = (await redeem(c, await reward(10))).json.redemption;
    const id = rid();
    const [x, y] = await Promise.all([undoSpend(red.id, F, id), undoSpend(red.id, F, id)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(await balance(c.id)).toBe(30);
    expect((await undoSpend(red.id)).status).toBe(409);
    expect(await balance(c.id)).toBe(30);
    const red2 = (await redeem(c, await reward(5))).json.redemption;
    expect((await undoSpend(red2.id, G)).status).toBe(404);
    await q("UPDATE redemptions SET created_date = now() - interval '11 minutes' WHERE id = $1", [red2.id]);
    expect((await undoSpend(red2.id)).status).toBe(404);
    expect(await balance(c.id)).toBe(25);
  });

  it('U1: undoing a deduction is never refused by the stack reserve (it gives points back)', async () => {
    const c = await newChild(F, 'Stackdeduct');
    await award(c, 10);
    const r10 = await reward(10);
    expect((await api(ctx.base, 'POST', `/api/children/${c.id}/stack/add`, { token: F.token, body: { reward_id: r10.id } })).status).toBe(200);
    await award(c, -5);
    const d = (await award(c, -3)).json;
    expect(await balance(c.id)).toBe(2);
    expect((await undoAward(d.event.id)).status).toBe(200);
    expect(await balance(c.id)).toBe(5);
    expect(await history(c.id)).toBe(5);
  });

  it('U1: an undo racing a spend on the same child: balance never below 0 and equals history', async () => {
    for (let i = 0; i < 5; i += 1) {
      const c = await newChild(F, `Race${i}`);
      const a = (await award(c, 10)).json;
      const [u, s] = await Promise.all([undoAward(a.event.id), redeem(c, await reward(10))]);
      expect([u.status, s.status].filter((x) => x === 200)).toHaveLength(1);
      expect(await balance(c.id)).toBeGreaterThanOrEqual(0);
      expect(await balance(c.id)).toBe(await history(c.id));
    }
  });

  it('C7: an undone award leaves summary and motivation as if it never happened', async () => {
    const c = await newChild(F, 'Summary7');
    await award(c, 7);
    const before = {
      sum: (await api(ctx.base, 'GET', '/api/summary', { token: F.token })).json,
      mot: (await api(ctx.base, 'GET', `/api/children/${c.id}/motivation`, { token: F.token })).json,
    };
    const a = (await award(c, 9)).json;
    await undoAward(a.event.id);
    const sum = (await api(ctx.base, 'GET', '/api/summary', { token: F.token })).json;
    const mot = (await api(ctx.base, 'GET', `/api/children/${c.id}/motivation`, { token: F.token })).json;
    expect(sum).toEqual(before.sum);
    expect(mot).toEqual(before.mot);
  });

  it('U1: starting points can\'t be undone (404)', async () => {
    const c = (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Starter', total_points: 12 } })).json;
    const [s] = await q("SELECT id FROM point_events WHERE child_id = $1 AND kind = 'starting'", [c.id]);
    expect(s).toBeTruthy();
    expect((await undoAward(s.id)).status).toBe(404);
    expect(await balance(c.id)).toBe(12);
  });

  it('I0: undo ids already used by a spend are refused, and an award can\'t reuse an undo id', async () => {
    const c = await newChild(F, 'Ids');
    await award(c, 20);
    const spendId = rid();
    const r5 = await reward(5);
    expect((await api(ctx.base, 'POST', `/api/children/${c.id}/redeem`, { token: F.token, body: { reward_id: r5.id, request_id: spendId } })).status).toBe(200);
    const a = (await award(c, 4)).json;
    expect((await undoAward(a.event.id, F, spendId)).status).toBe(409);
    const undoId = rid();
    expect((await undoAward(a.event.id, F, undoId)).status).toBe(200);
    expect((await award(c, 4, F, undoId)).status).toBe(409);
    expect(await balance(c.id)).toBe(15);
    expect(await history(c.id)).toBe(15);
  });

  it('Replay returns the same shape as the first reply (week_points included)', async () => {
    const c = await newChild(F, 'Shape');
    const a = (await award(c, 6)).json;
    const id = rid();
    const first = (await undoAward(a.event.id, F, id)).json;
    const again = (await undoAward(a.event.id, F, id)).json;
    expect(again.duplicate).toBe(true);
    expect(again.child.week_points).toBe(first.child.week_points);
  });

  it('A category whose only use was an undone award can be deleted', async () => {
    const cat = (await api(ctx.base, 'POST', '/api/behavior-categories', { token: F.token, body: { name: 'Mistap' } })).json;
    const c = await newChild(F, 'Cat');
    const a = (await api(ctx.base, 'POST', `/api/children/${c.id}/award`, { token: F.token, body: { points: 5, category: 'Mistap', request_id: rid() } })).json;
    await undoAward(a.event.id);
    expect((await api(ctx.base, 'DELETE', `/api/behavior-categories/${cat.id}`, { token: F.token })).status).toBe(200);
  });

  it('Sequence: random awards, deductions, spends and undos keep balance = history and >= 0', async () => {
    const c = await newChild(F, 'Seq');
    const rs = [await reward(3), await reward(9)];
    const events = [];
    const reds = [];
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 40; i += 1) {
      const op = rnd(5);
      if (op === 0) { const r = (await award(c, 1 + rnd(12))).json; if (r.event) events.push(r.event.id); }
      if (op === 1) { const r = (await award(c, -(1 + rnd(6)))).json; if (r.event) events.push(r.event.id); }
      if (op === 2) { const r = await redeem(c, rs[rnd(2)]); if (r.status === 200) reds.push(r.json.redemption.id); }
      if (op === 3 && events.length) await undoAward(events[rnd(events.length)]);
      if (op === 4 && reds.length) await undoSpend(reds[rnd(reds.length)]);
      const b = await balance(c.id);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b, `step ${i}`).toBe(await history(c.id));
    }
  });
});
