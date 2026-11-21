// @vitest-environment node
// D1 savings feature (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §19): save,
// move back, undo, redeem a bigger goal, and the refund when that redemption
// is undone. After every write the app's figures must agree with the
// independent SQL reconciliation (server/reconcile.js), and committed points
// may never exceed a child's total.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { startApp, stopApp, api, makeFamily } from './harness.js';
import { fingerprint, overCommitted } from '../reconcile.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const rid = () => crypto.randomUUID();

describe.skipIf(!hasDb)('D1 savings feature', () => {
  let ctx, F, G;
  const call = (fam, method, path, body) => api(ctx.base, method, path, { token: fam.token, body });
  const child = async (fam, id) => (await call(fam, 'GET', '/api/children')).json.find((c) => c.id === id);
  const award = (fam, id, points) => call(fam, 'POST', `/api/children/${id}/award`, { points, category: 'Kindness', request_id: rid() });
  const save = (fam, id, reward_id, points, request_id = rid()) => call(fam, 'POST', `/api/children/${id}/savings/save`, { reward_id, points, request_id });
  const release = (fam, id, reward_id, points, request_id = rid()) => call(fam, 'POST', `/api/children/${id}/savings/release`, { reward_id, points, request_id });
  const undo = (fam, eventId, request_id = rid()) => call(fam, 'POST', `/api/savings-events/${eventId}/undo`, { request_id });
  const redeemGoal = (fam, id, reward_id, request_id = rid()) => call(fam, 'POST', `/api/children/${id}/savings/redeem`, { reward_id, request_id });
  // §21: the parent confirms exactly what the server showed (the 409's snapshot).
  const putConfirmed = async (fam, id, body) => {
    let r = await call(fam, 'PUT', `/api/rewards/${id}`, body);
    if (r.status === 409 && r.json?.code === 'ENDS_SAVINGS') r = await call(fam, 'PUT', `/api/rewards/${id}`, { ...body, confirm_end_savings: r.json.snapshot });
    return r;
  };
  const delConfirmed = async (fam, id) => {
    let r = await call(fam, 'DELETE', `/api/rewards/${id}`);
    if (r.status === 409 && r.json?.code === 'ENDS_SAVINGS') r = await call(fam, 'DELETE', `/api/rewards/${id}`, { confirm_end_savings: r.json.snapshot });
    return r;
  };
  const newKid = async (fam, name, points) => {
    const kid = (await call(fam, 'POST', '/api/children', { name })).json;
    if (points) expect((await award(fam, kid.id, points)).status).toBe(200);
    return kid;
  };
  const newGoal = async (fam, title, cost, extra = {}) => (await call(fam, 'POST', '/api/rewards', { title, cost_points: cost, is_bigger_goal: true, ...extra })).json;
  // The app and the SQL reconciliation agree, and nothing is over-committed.
  const agree = async (fam, id) => {
    const app = await child(fam, id);
    const db = (await fingerprint(ctx.pool)).children[id];
    expect({ total: app.total_points, available: app.available_points, saved: app.saved_total })
      .toEqual({ total: db.total_points, available: db.available, saved: db.saved });
    expect(overCommitted(db)).toBe(false);
    expect(db.history).toBe(db.total_points);
    return app;
  };

  beforeAll(async () => {
    ctx = await startApp();
    F = await makeFamily(ctx.base, 'Savers');
    G = await makeFamily(ctx.base, 'Others');
  }, 60000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('a parent marks a reward as a bigger goal (the column is writable, create and update)', async () => {
    const r = await newGoal(F, 'Bike', 300);
    expect(r.is_bigger_goal).toBe(true);
    const plain = (await call(F, 'POST', '/api/rewards', { title: 'Ice cream', cost_points: 5 })).json;
    expect(plain.is_bigger_goal).toBe(false);
    const up = await call(F, 'PUT', `/api/rewards/${plain.id}`, { is_bigger_goal: true });
    expect(up.status).toBe(200);
    expect(up.json.is_bigger_goal).toBe(true);
  });

  it('save: available drops by exactly the amount, total and history do not move (F2 boundary)', async () => {
    const kid = await newKid(F, 'Ava', 100);
    const bike = await newGoal(F, 'Ava bike', 300);
    const was = await agree(F, kid.id);
    expect((await save(F, kid.id, bike.id, 101)).status).toBe(400); // available 100 + 1
    expect((await agree(F, kid.id)).saved_total).toBe(0);
    const ok = await save(F, kid.id, bike.id, 100); // exactly available
    expect(ok.status).toBe(200);
    expect(ok.json.event).toMatchObject({ kind: 'save', delta: 100 });
    expect(ok.json.child).toMatchObject({ available_points: 0, saved_total: 100, total_points: was.total_points });
    const now = await agree(F, kid.id);
    expect(now.goals).toEqual([expect.objectContaining({ rewardId: bike.id, saved: 100, cost: 300, to_go: 200 })]);
  });

  it('F1: only whole numbers from 1 to 1000 are accepted', async () => {
    const kid = await newKid(F, 'Ben', 50);
    const bike = await newGoal(F, 'Ben bike', 300);
    for (const points of [0, -1, 1.5, '5', 1001, null]) {
      expect((await save(F, kid.id, bike.id, points)).status, String(points)).toBe(400);
      expect((await release(F, kid.id, bike.id, points)).status, String(points)).toBe(400);
    }
    expect((await call(F, 'POST', `/api/children/${kid.id}/savings/save`, { reward_id: bike.id, points: 5 })).status).toBe(400); // request_id required
    expect((await agree(F, kid.id)).saved_total).toBe(0);
  });

  it('release: up to what is saved, exactly (F3)', async () => {
    const kid = await newKid(F, 'Cal', 60);
    const bike = await newGoal(F, 'Cal bike', 300);
    expect((await save(F, kid.id, bike.id, 40)).status).toBe(200);
    expect((await release(F, kid.id, bike.id, 41)).status).toBe(400);
    const r = await release(F, kid.id, bike.id, 40);
    expect(r.status).toBe(200);
    expect(r.json.event).toMatchObject({ kind: 'release', delta: -40 });
    const now = await agree(F, kid.id);
    expect(now).toMatchObject({ saved_total: 0, available_points: 60 });
  });

  it('I4: only a bigger goal this child may have; other families and children are 404 (F14)', async () => {
    const kid = await newKid(F, 'Dee', 50);
    const sib = await newKid(F, 'Eli', 50);
    const plain = (await call(F, 'POST', '/api/rewards', { title: 'Sticker', cost_points: 5 })).json;
    expect((await save(F, kid.id, plain.id, 5)).status).toBe(409);
    const sibOnly = await newGoal(F, 'Eli only', 100, { assigned_child_ids: [sib.id] });
    expect((await save(F, kid.id, sibOnly.id, 5)).status).toBe(404);
    const theirs = await newGoal(G, 'Their bike', 100);
    expect((await save(F, kid.id, theirs.id, 5)).status).toBe(404);
    const otherKid = await newKid(G, 'Fay', 50);
    const mine = await newGoal(F, 'Dee bike', 100);
    expect((await save(F, otherKid.id, mine.id, 5)).status).toBe(404);
    expect((await save(G, kid.id, mine.id, 5)).status).toBe(404);
    expect((await agree(F, kid.id)).saved_total).toBe(0);
  });

  it('F4: a child id in capitals is the same child and the same goal', async () => {
    const kid = await newKid(F, 'Gus', 50);
    const bike = await newGoal(F, 'Gus bike', 100, { assigned_child_ids: [kid.id] });
    expect((await save(F, kid.id.toUpperCase(), bike.id.toUpperCase(), 30)).status).toBe(200);
    expect((await agree(F, kid.id)).goals[0]).toMatchObject({ saved: 30 });
    expect((await save(F, kid.id.toUpperCase(), bike.id, 21)).status).toBe(400); // available 20
  });

  it('E8/E9/F10: a replay returns the original once; the same id elsewhere is 409', async () => {
    const kid = await newKid(F, 'Hal', 50);
    const bike = await newGoal(F, 'Hal bike', 100);
    const id = rid();
    const a = await save(F, kid.id, bike.id, 10, id);
    const b = await save(F, kid.id, bike.id, 10, id);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.json.duplicate).toBe(true);
    expect(b.json.event.id).toBe(a.json.event.id);
    expect(b.json.child.saved_total).toBe(10); // the current balance, not a stale one
    expect((await save(F, kid.id, bike.id, 11, id)).status).toBe(409); // other arguments
    expect((await release(F, kid.id, bike.id, 10, id)).status).toBe(409); // other endpoint
    expect((await call(F, 'POST', `/api/children/${kid.id}/award`, { points: 1, category: 'Kindness', request_id: id })).status).toBe(409);
    expect((await agree(F, kid.id)).saved_total).toBe(10);
  });

  it('undo a save, once; undo a release; refused when it would break I1 or I2 (F6)', async () => {
    const kid = await newKid(F, 'Ida', 50);
    const bike = await newGoal(F, 'Ida bike', 100);
    const s = (await save(F, kid.id, bike.id, 30)).json.event;
    const u = await undo(F, s.id);
    expect(u.status).toBe(200);
    expect(u.json.event).toMatchObject({ kind: 'undo', delta: -30, undoes: s.id });
    expect((await agree(F, kid.id)).saved_total).toBe(0);
    expect((await undo(F, s.id)).status).toBe(409); // already undone
    // F6: save 50, move 30 back, undo the save: saved 20 < 50.
    const s2 = (await save(F, kid.id, bike.id, 50)).json.event;
    const r2 = (await release(F, kid.id, bike.id, 30)).json.event;
    expect((await undo(F, s2.id)).status).toBe(409);
    // Undo the release while available allows it.
    expect((await undo(F, r2.id)).status).toBe(200);
    expect((await agree(F, kid.id)).saved_total).toBe(50);
    // A release whose undo would exceed available: move 50 back, spend the 50, undo the release.
    const r3 = (await release(F, kid.id, bike.id, 50)).json.event;
    const treat = (await call(F, 'POST', '/api/rewards', { title: 'Ida treat', cost_points: 50 })).json;
    expect((await call(F, 'POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: rid() })).status).toBe(200);
    expect((await undo(F, r3.id)).status).toBe(409);
    await agree(F, kid.id);
  });

  it('only save and release can be undone, and only in the family', async () => {
    const kid = await newKid(F, 'Jo', 300);
    const bike = await newGoal(F, 'Jo bike', 100);
    await save(F, kid.id, bike.id, 60);
    const red = await redeemGoal(F, kid.id, bike.id);
    expect(red.status).toBe(200);
    const { rows: [spend] } = await ctx.pool.query("SELECT id FROM savings_events WHERE redemption_id = $1 AND kind = 'spend'", [red.json.redemption.id]);
    expect((await undo(F, spend.id)).status).toBe(404);
    const s = (await save(F, kid.id, bike.id, 10)).json.event;
    expect((await undo(G, s.id)).status).toBe(404);
    expect((await undo(F, 'not-a-uuid')).status).toBe(404);
  });

  it('F5 (O6): an undo after un-mark and re-mark is refused; nothing revives', async () => {
    const kid = await newKid(F, 'Kim', 50);
    const bike = await newGoal(F, 'Kim bike', 100);
    const s = (await save(F, kid.id, bike.id, 30)).json.event;
    await putConfirmed(F, bike.id, { is_bigger_goal: false });
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { is_bigger_goal: true });
    expect((await undo(F, s.id)).status).toBe(409);
    expect((await agree(F, kid.id)).saved_total).toBe(0);
    // And a release can't take points from an old generation either.
    expect((await release(F, kid.id, bike.id, 1)).status).toBe(400);
  });

  it('a goal never holds more than it needs: saves and undos stop at its cost', async () => {
    const kid = await newKid(F, 'Zed', 500);
    const bike = await newGoal(F, 'Zed bike', 100);
    expect((await save(F, kid.id, bike.id, 101)).status).toBe(400);
    expect((await save(F, kid.id, bike.id, 100)).status).toBe(200); // exactly the cost
    expect((await save(F, kid.id, bike.id, 1)).status).toBe(400);
    const r = (await release(F, kid.id, bike.id, 40)).json.event;
    expect((await save(F, kid.id, bike.id, 40)).status).toBe(200); // back to 100
    expect((await undo(F, r.id)).status).toBe(409); // would make 140 of 100
    expect(await agree(F, kid.id)).toMatchObject({ saved_total: 100 });
  });

  it('F5b (O6): a move back from an old generation cannot be undone either', async () => {
    const kid = await newKid(F, 'Kit', 50);
    const bike = await newGoal(F, 'Kit bike', 100);
    await save(F, kid.id, bike.id, 30);
    const r = (await release(F, kid.id, bike.id, 30)).json.event;
    await putConfirmed(F, bike.id, { is_bigger_goal: false });
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { is_bigger_goal: true });
    expect((await undo(F, r.id)).status).toBe(409);
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE undoes = $1", [r.id])).rows[0].n).toBe(0);
    expect(await agree(F, kid.id)).toMatchObject({ saved_total: 0, available_points: 50 });
  });

  it('F7/F8: redeem a goal from savings and available; undo restores both (E5/E6)', async () => {
    const kid = await newKid(F, 'Lou', 320);
    const bike = await newGoal(F, 'Lou bike', 300);
    expect((await save(F, kid.id, bike.id, 120)).status).toBe(200);
    const was = await agree(F, kid.id); // total 320, saved 120, available 200
    expect(was).toMatchObject({ total_points: 320, saved_total: 120, available_points: 200 });
    const red = await redeemGoal(F, kid.id, bike.id);
    expect(red.status).toBe(200);
    expect(red.json.redemption).toMatchObject({ reward_cost: 300, status: 'Completed' });
    expect(red.json.child).toMatchObject({ total_points: 20, saved_total: 0, available_points: 20 });
    expect(red.json.from_saved).toBe(120);
    await agree(F, kid.id);
    const u = await call(F, 'POST', `/api/redemptions/${red.json.redemption.id}/undo`, { request_id: rid() });
    expect(u.status).toBe(200);
    expect(u.json.child).toMatchObject({ total_points: 320, saved_total: 120, available_points: 200 });
    expect(await agree(F, kid.id)).toMatchObject({ saved_total: 120, available_points: 200 });
    // The refund happens once: replaying the undo restores nothing more.
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE child_id = $1 AND kind = 'undo'", [kid.id])).rows[0].n).toBe(1);
  });

  it('F9: undoing a goal redemption after the goal was un-marked returns all points to available', async () => {
    const kid = await newKid(F, 'Max', 320);
    const bike = await newGoal(F, 'Max bike', 300);
    await save(F, kid.id, bike.id, 120);
    const red = (await redeemGoal(F, kid.id, bike.id)).json;
    await putConfirmed(F, bike.id, { is_bigger_goal: false });
    const u = await call(F, 'POST', `/api/redemptions/${red.redemption.id}/undo`, { request_id: rid() });
    expect(u.status).toBe(200);
    expect(await agree(F, kid.id)).toMatchObject({ total_points: 320, saved_total: 0, available_points: 320 });
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE child_id = $1 AND kind = 'undo'", [kid.id])).rows[0].n).toBe(0);
  });

  it('F9b (O6): undoing a goal redemption after un-mark and re-mark refunds nothing to the new generation', async () => {
    const kid = await newKid(F, 'Ned2', 320);
    const bike = await newGoal(F, 'Ned2 bike', 300);
    await save(F, kid.id, bike.id, 120);
    const red = (await redeemGoal(F, kid.id, bike.id)).json;
    await putConfirmed(F, bike.id, { is_bigger_goal: false });
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { is_bigger_goal: true }); // a new generation
    const u = await call(F, 'POST', `/api/redemptions/${red.redemption.id}/undo`, { request_id: rid() });
    expect(u.status).toBe(200);
    expect(u.json.refunded_to_goal).toBe(0);
    expect(await agree(F, kid.id)).toMatchObject({ total_points: 320, saved_total: 0, available_points: 320 });
  });

  it('goal redeem: not enough, replay, and the direct spend path refuses goals (F10, F13)', async () => {
    const kid = await newKid(F, 'Ned', 100);
    const bike = await newGoal(F, 'Ned bike', 300);
    await save(F, kid.id, bike.id, 50);
    expect((await redeemGoal(F, kid.id, bike.id)).status).toBe(400); // 50 + 50 < 300
    await award(F, kid.id, 200); // saved 50 + available 250 = 300
    const id = rid();
    const a = await redeemGoal(F, kid.id, bike.id, id);
    const b = await redeemGoal(F, kid.id, bike.id, id);
    expect(a.status).toBe(200);
    expect(b.json.duplicate).toBe(true);
    expect(b.json.redemption.id).toBe(a.json.redemption.id);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM redemptions WHERE child_id = $1', [kid.id])).rows[0].n).toBe(1);
    expect(await agree(F, kid.id)).toMatchObject({ total_points: 0, saved_total: 0 });
    // A goal with nothing saved still can't be spent directly (one path, B1/O7).
    const kid2 = await newKid(F, 'Oli', 400);
    const car = await newGoal(F, 'Oli car', 300);
    expect((await call(F, 'POST', `/api/children/${kid2.id}/redeem`, { reward_id: car.id, request_id: rid() })).status).toBe(409);
    expect((await redeemGoal(F, kid2.id, car.id)).status).toBe(200); // with 0 saved, all from available
    const plain = (await call(F, 'POST', '/api/rewards', { title: 'Oli treat', cost_points: 5 })).json;
    expect((await redeemGoal(F, kid2.id, plain.id)).status).toBe(409); // not a goal
  });

  it('E7: an award that was saved cannot be undone until the points are moved back', async () => {
    const kid = (await call(F, 'POST', '/api/children', { name: 'Pip' })).json;
    const aw = (await award(F, kid.id, 50)).json;
    const bike = await newGoal(F, 'Pip bike', 100);
    await save(F, kid.id, bike.id, 50);
    expect((await call(F, 'POST', `/api/point-events/${aw.event.id}/undo`, { request_id: rid() })).status).toBe(409);
    await release(F, kid.id, bike.id, 50);
    expect((await call(F, 'POST', `/api/point-events/${aw.event.id}/undo`, { request_id: rid() })).status).toBe(200);
    await agree(F, kid.id);
  });

  it('F11: two saves racing for the last points: exactly one wins', async () => {
    for (let round = 0; round < 5; round++) {
      const kid = await newKid(F, `Race${round}`, 40);
      const bike = await newGoal(F, `Race bike ${round}`, 100);
      const results = await Promise.all([save(F, kid.id, bike.id, 30), save(F, kid.id, bike.id, 30)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
      expect((await agree(F, kid.id)).saved_total).toBe(30);
    }
  });

  it('F12: saves racing un-mark never over-commit (probabilistic, 20 rounds)', async () => {
    const kid = await newKid(F, 'Quin', 100);
    const bike = await newGoal(F, 'Quin bike', 200);
    const treat = (await call(F, 'POST', '/api/rewards', { title: 'Quin treat', cost_points: 1 })).json;
    for (let round = 0; round < 20; round++) {
      await Promise.all([
        save(F, kid.id, bike.id, 5),
        putConfirmed(F, bike.id, { is_bigger_goal: round % 2 === 1 }),
      ]);
      const db = (await fingerprint(ctx.pool)).children[kid.id];
      expect(overCommitted(db)).toBe(false);
    }
    // Whatever survived, spending everything available still never over-commits.
    const now = await agree(F, kid.id);
    for (let i = 0; i < now.available_points && i < 3; i++) {
      await call(F, 'POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: rid() });
    }
    await agree(F, kid.id);
  });

  it('property: random sequences keep committed ≤ total and total = history', async () => {
    let seed = 20261121;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const kid = await newKid(F, 'Rae', 50);
    const sib = await newKid(F, 'Ray', 20);
    const goals = [await newGoal(F, 'Rae bike', 120), await newGoal(F, 'Rae tent', 80)];
    const treat = (await call(F, 'POST', '/api/rewards', { title: 'Rae treat', cost_points: 15 })).json;
    const events = [];
    const redemptions = [];
    for (let i = 0; i < 90; i++) {
      const g = goals[rand(2)];
      const op = rand(13);
      let r;
      if (op === 0) r = await award(F, kid.id, 1 + rand(40));
      else if (op === 1 || op === 2) r = await save(F, kid.id, g.id, 1 + rand(40));
      else if (op === 3) r = await release(F, kid.id, g.id, 1 + rand(40));
      else if (op === 4 && events.length) r = await undo(F, events[rand(events.length)]);
      else if (op === 5) r = await redeemGoal(F, kid.id, g.id);
      else if (op === 6 && redemptions.length) r = await call(F, 'POST', `/api/redemptions/${redemptions[rand(redemptions.length)]}/undo`, { request_id: rid() });
      else if (op === 7) r = await putConfirmed(F, g.id, { is_bigger_goal: rand(3) > 0 });
      else if (op === 8) r = await putConfirmed(F, g.id, { assigned_child_ids: [[], [kid.id], [sib.id], [kid.id, sib.id]][rand(4)] });
      // Goal costs only: a cost raised on a REQUESTED reward is the known
      // read-time clamp (B4), not a write this test is about.
      else if (op === 9) r = await call(F, 'PUT', `/api/rewards/${g.id}`, { cost_points: 40 + rand(120) });
      else if (op === 10) r = await call(F, 'POST', `/api/children/${kid.id}/stack/add`, { reward_id: treat.id });
      else if (op === 11) {
        const items = (await child(F, kid.id)).reward_stack_priced;
        r = items.length
          ? await call(F, 'POST', `/api/children/${kid.id}/stack/confirm`, { request_id: rid(), expected: items.map((x) => ({ reward_id: x.rewardId, stack_index: x.stackIndex, cost: x.cost })) })
          : await award(F, kid.id, 5);
      }
      else r = await call(F, 'POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: rid() });
      expect(r.status, `step ${i} op ${op}: ${r.text}`).toBeLessThan(500);
      if (r.status === 200 && r.json?.event?.kind && ['save', 'release'].includes(r.json.event.kind)) events.push(r.json.event.id);
      if (r.status === 200 && r.json?.redemption?.id && !r.json.duplicate) redemptions.push(r.json.redemption.id);
      await agree(F, kid.id);
      await agree(F, sib.id);
    }
  }, 120000);

  it('S1: a goal that is also requested cannot be saved towards or redeemed as a goal', async () => {
    const kid = await newKid(F, 'Sid', 150);
    const r = (await call(F, 'POST', '/api/rewards', { title: 'Sid kite', cost_points: 100 })).json;
    expect((await call(F, 'POST', `/api/children/${kid.id}/stack/add`, { reward_id: r.id })).status).toBe(200);
    await call(F, 'PUT', `/api/rewards/${r.id}`, { is_bigger_goal: true }); // marked after the request
    const s = await save(F, kid.id, r.id, 50);
    expect(s.status).toBe(409);
    expect(s.json.error).toBe('The requests changed. Check them again.');
    expect((await redeemGoal(F, kid.id, r.id)).status).toBe(409);
    expect(await agree(F, kid.id)).toMatchObject({ saved_total: 0, available_points: 50 });
  });

  it('S3: the generic API cannot read, change or delete the ledger', async () => {
    const kid = await newKid(F, 'Tia', 50);
    const bike = await newGoal(F, 'Tia bike', 100);
    const ev = (await save(F, kid.id, bike.id, 10)).json.event;
    expect((await call(F, 'DELETE', `/api/savings_events/${ev.id}`)).status).toBeGreaterThanOrEqual(400);
    expect((await call(F, 'PUT', `/api/savings_events/${ev.id}`, { delta: 999 })).status).toBeGreaterThanOrEqual(400);
    expect((await call(F, 'POST', '/api/savings_events', { delta: 999 })).status).toBeGreaterThanOrEqual(400);
    expect((await agree(F, kid.id)).saved_total).toBe(10);
  });

  it('S4: every response that returns a child carries its balance (available, saved, goals)', async () => {
    const kid = await newKid(F, 'Uma', 200);
    const bike = await newGoal(F, 'Uma bike', 300);
    await save(F, kid.id, bike.id, 40);
    const treat = (await call(F, 'POST', '/api/rewards', { title: 'Uma treat', cost_points: 10 })).json;
    const has = (c, label) => {
      expect(c, label).toBeTruthy();
      expect(c.available_points, label).toBe(c.total_points - (c.reward_stack_priced || []).reduce((n, i) => n + i.cost, 0) - c.saved_total);
      expect(c.goals, label).toEqual(expect.any(Array));
    };
    const id = rid();
    has((await call(F, 'POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: id })).json.child, 'redeem');
    const replay = (await call(F, 'POST', `/api/children/${kid.id}/redeem`, { reward_id: treat.id, request_id: id })).json;
    has(replay.child, 'redeem replay');
    has((await call(F, 'POST', `/api/redemptions/${replay.redemption.id}/undo`, { request_id: rid() })).json.child, 'redemption undo');
    await call(F, 'POST', `/api/children/${kid.id}/stack/add`, { reward_id: treat.id });
    const item = (await child(F, kid.id)).reward_stack_priced[0];
    const body = { request_id: rid(), expected: [{ reward_id: item.rewardId, stack_index: item.stackIndex, cost: item.cost }] };
    const confirmed = await call(F, 'POST', `/api/children/${kid.id}/stack/confirm`, body);
    expect(confirmed.status, confirmed.text).toBe(200);
    has(confirmed.json.child, 'confirm');
    has((await call(F, 'POST', `/api/children/${kid.id}/stack/confirm`, body)).json.child, 'confirm replay');
    const aw = (await award(F, kid.id, 5)).json;
    has((await call(F, 'POST', `/api/point-events/${aw.event.id}/undo`, { request_id: rid() })).json.child, 'award undo');
    const gid = rid();
    await award(F, kid.id, 300);
    has((await redeemGoal(F, kid.id, bike.id, gid)).json.child, 'goal redeem');
    has((await redeemGoal(F, kid.id, bike.id, gid)).json.child, 'goal redeem replay');
  });

  it('S7: the same save sent with ids in capitals is a replay, not a conflict', async () => {
    const kid = await newKid(F, 'Vic', 50);
    const bike = await newGoal(F, 'Vic bike', 100);
    const id = rid();
    expect((await save(F, kid.id, bike.id, 10, id)).status).toBe(200);
    const again = await save(F, kid.id.toUpperCase(), bike.id.toUpperCase(), 10, id);
    expect(again.status).toBe(200);
    expect(again.json.duplicate).toBe(true);
    expect((await agree(F, kid.id)).saved_total).toBe(10);
  });

  it('N3: a goal created with the switch on starts after generation 0 (the 0:0 every inserted row gets)', async () => {
    const bike = await newGoal(F, 'Wren bike', 100);
    const { rows: [r] } = await ctx.pool.query('SELECT goal_epoch FROM rewards WHERE id = $1', [bike.id]);
    expect(r.goal_epoch).toBeGreaterThan(0);
  });

  it('E12 after redemption: an excess over a lowered cost stays saved, visible and movable; never lost or counted twice', async () => {
    const kid = await newKid(F, 'Exa', 100);
    const bike = await newGoal(F, 'Exa bike', 100);
    expect((await save(F, kid.id, bike.id, 100)).status).toBe(200);
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { cost_points: 60 }); // lowered below saved
    const before = await agree(F, kid.id);
    expect(before).toMatchObject({ total_points: 100, saved_total: 100, available_points: 0 });
    const red = await redeemGoal(F, kid.id, bike.id);
    expect(red.status).toBe(200);
    expect(red.json.from_saved).toBe(60);
    const after = await agree(F, kid.id); // committed <= total, total = history
    expect(after).toMatchObject({ total_points: 40, saved_total: 40, available_points: 0 });
    expect(after.goals[0]).toMatchObject({ saved: 40, cost: 60, to_go: 20 });
    const back = await release(F, kid.id, bike.id, 40);
    expect(back.status).toBe(200);
    expect(await agree(F, kid.id)).toMatchObject({ total_points: 40, saved_total: 0, available_points: 40 });
  });

  it('Activity: savings moves are listed under All only, never as Earned or Spent; an undone move is marked', async () => {
    const kid = await newKid(F, 'Abe', 60);
    const bike = await newGoal(F, 'Abe bike', 100);
    const s = (await save(F, kid.id, bike.id, 20)).json.event;
    const m = (await release(F, kid.id, bike.id, 5)).json.event;
    await undo(F, m.id);
    const feed = async (filter) => (await call(F, 'GET', `/api/activity-feed?child_id=${kid.id}&filter=${filter}`)).json;
    const all = await feed('all');
    expect(all.find((e) => e.id === s.id)).toMatchObject({ type: 'saving', points: 20, label: 'Abe bike', undone: false });
    expect(all.find((e) => e.id === m.id)).toMatchObject({ type: 'moved_back', points: 5, undone: true });
    expect(all.filter((e) => e.type === 'saving' || e.type === 'moved_back')).toHaveLength(2); // the undo row itself is not listed
    for (const f of ['earned', 'spent', 'goals']) {
      expect((await feed(f)).some((e) => e.type === 'saving' || e.type === 'moved_back'), f).toBe(false);
    }
    // The balance rows still add up to the total: savings rows are not counted.
    const balanceRows = all.filter((e) => !['saving', 'moved_back'].includes(e.type));
    const sum = balanceRows.reduce((n, e) => n + (e.type === 'spend' ? -Math.abs(e.points) : e.points), 0);
    expect(sum).toBe((await child(F, kid.id)).total_points);
    expect((await call(G, 'GET', `/api/activity-feed?child_id=${kid.id}`)).json).toEqual([]);
  });

  it('N2 (§20): un-marking records, per child, the amount and cause; nothing revives; no balance change', async () => {
    const a = await newKid(F, 'Nia', 100);
    const b = await newKid(F, 'Nob', 100);
    const c = await newKid(F, 'Nel', 100); // nothing saved: no record
    const bike = await newGoal(F, 'Nia bike', 300);
    await save(F, a.id, bike.id, 40);
    await save(F, b.id, bike.id, 25);
    const before = { a: await agree(F, a.id), b: await agree(F, b.id) };
    expect((await putConfirmed(F, bike.id, { is_bigger_goal: false })).status).toBe(200);
    const { rows } = await ctx.pool.query("SELECT child_id, delta, ended_by, reward_title FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed' ORDER BY delta", [bike.id]);
    expect(rows).toEqual([
      { child_id: a.id, delta: -40, ended_by: 'unmarked', reward_title: 'Nia bike' },
      { child_id: b.id, delta: -25, ended_by: 'unmarked', reward_title: 'Nia bike' },
    ]);
    const after = { a: await agree(F, a.id), b: await agree(F, b.id) };
    expect(after.a.available_points).toBe(before.a.available_points + 40); // the read-time rule, unchanged
    expect(after.a.total_points).toBe(before.a.total_points); // no earning
    expect((await agree(F, c.id)).saved_total).toBe(0);
    // Re-marking starts at 0 (O6): the record keeps the old allocation ended.
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { is_bigger_goal: true });
    expect((await agree(F, a.id)).saved_total).toBe(0);
    // A cost edit or an unchanged save records nothing.
    await save(F, a.id, bike.id, 10);
    await call(F, 'PUT', `/api/rewards/${bike.id}`, { cost_points: 250, is_bigger_goal: true });
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed'", [bike.id])).rows[0].n).toBe(2);
  });

  it('§20.9: an edit that would end savings is refused (409, nothing changed) unless the parent confirmed it', async () => {
    const kid = await newKid(F, 'Cnf', 100);
    const g = await newGoal(F, 'Cnf goal', 100);
    await save(F, kid.id, g.id, 20);
    const r = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, title: 'Renamed' });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('ENDS_SAVINGS');
    const { rows: [row] } = await ctx.pool.query('SELECT title, is_bigger_goal FROM rewards WHERE id = $1', [g.id]);
    expect(row).toEqual({ title: 'Cnf goal', is_bigger_goal: true }); // nothing changed
    expect((await agree(F, kid.id)).saved_total).toBe(20);
    // An edit that ends nothing needs no confirmation.
    expect((await call(F, 'PUT', `/api/rewards/${g.id}`, { cost_points: 120 })).status).toBe(200);
    expect((await putConfirmed(F, g.id, { is_bigger_goal: false })).status).toBe(200);
  });

  it('§21.1: a confirmation is the snapshot shown; a save after the warning, or a new child, forces a new warning', async () => {
    const lara = await newKid(F, 'Snl', 200);
    const omar = await newKid(F, 'Sno', 200);
    const g = await newGoal(F, 'Snap goal', 300);
    await save(F, lara.id, g.id, 40);
    const shown = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false });
    expect(shown.status).toBe(409);
    expect(shown.json.ending).toEqual([{ child_id: lara.id, name: 'Snl', saved: 40 }]);
    const snapshot = shown.json.snapshot;
    // A boolean is not a confirmation.
    expect((await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: true })).status).toBe(409);
    // Another parent saves 30 more after the warning: the old snapshot is refused, nothing changes.
    await save(F, lara.id, g.id, 30);
    const stale = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: snapshot });
    expect(stale.status).toBe(409);
    expect(stale.json.ending).toEqual([{ child_id: lara.id, name: 'Snl', saved: 70 }]);
    expect((await agree(F, lara.id)).saved_total).toBe(70);
    // Another child becomes affected: refused again.
    await save(F, omar.id, g.id, 5);
    const stale2 = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: stale.json.snapshot });
    expect(stale2.status).toBe(409);
    expect(stale2.json.ending.map((e) => e.saved).sort()).toEqual([5, 70]);
    // Confirming exactly what is now shown goes through, once.
    const ok = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: stale2.json.snapshot });
    expect(ok.status).toBe(200);
    const { rows } = await ctx.pool.query("SELECT child_id, delta FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed' ORDER BY delta", [g.id]);
    expect(rows).toEqual([{ child_id: lara.id, delta: -70 }, { child_id: omar.id, delta: -5 }]);
  });

  it('§21.1: un-mark and re-mark by another parent between warning and confirmation (same amounts) is refused', async () => {
    const kid = await newKid(F, 'Epo', 200);
    const g = await newGoal(F, 'Epo goal', 300);
    await save(F, kid.id, g.id, 20);
    const shown = (await call(F, 'PUT', `/api/rewards/${g.id}`, { title: 'Epo goal 2', is_bigger_goal: false })).json;
    await putConfirmed(F, g.id, { is_bigger_goal: false }); // another parent ends it...
    await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: true }); // ...re-marks it...
    await save(F, kid.id, g.id, 20); // ...and the same amount is saved again
    const r = await call(F, 'PUT', `/api/rewards/${g.id}`, { title: 'Epo goal 2', is_bigger_goal: false, confirm_end_savings: shown.snapshot });
    expect(r.status).toBe(409); // a different allocation, though the amount matches
    expect((await agree(F, kid.id)).saved_total).toBe(20);
  });

  it('§21.1: a child reassigned away and back between warning and confirmation (same amount) is refused', async () => {
    const kid = await newKid(F, 'Cep', 200);
    const sib = await newKid(F, 'Ces', 200);
    const g = await newGoal(F, 'Cep goal', 300);
    await save(F, kid.id, g.id, 25);
    const shown = (await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false })).json;
    await putConfirmed(F, g.id, { assigned_child_ids: [sib.id] }); // another parent: away from kid...
    await call(F, 'PUT', `/api/rewards/${g.id}`, { assigned_child_ids: [] }); // ...and back (a new child generation)
    await save(F, kid.id, g.id, 25); // the same amount again
    const r = await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: shown.snapshot });
    expect(r.status).toBe(409);
    expect((await agree(F, kid.id)).saved_total).toBe(25);
  });

  it('§21.1: two concurrent confirmed edits write one record per child', async () => {
    const kid = await newKid(F, 'Cc', 200);
    const g = await newGoal(F, 'Cc goal', 300);
    await save(F, kid.id, g.id, 15);
    const snap = (await call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false })).json.snapshot;
    const both = await Promise.all([1, 2].map(() => call(F, 'PUT', `/api/rewards/${g.id}`, { is_bigger_goal: false, confirm_end_savings: snap })));
    expect(both.map((r) => r.status)).toEqual([200, 200]); // the second finds nothing left to end
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed'", [g.id])).rows[0].n).toBe(1);
  });

  it('§21.2: deleting a goal with savings needs the snapshot (stale client, direct API); without savings it does not', async () => {
    const a = await newKid(F, 'Dela', 200);
    const b = await newKid(F, 'Delb', 200);
    const g = await newGoal(F, 'Del goal', 300);
    await save(F, a.id, g.id, 10);
    await save(F, b.id, g.id, 12);
    const r1 = await call(F, 'DELETE', `/api/rewards/${g.id}`);
    expect(r1.status).toBe(409);
    expect(r1.json.ending.map((e) => e.saved).sort()).toEqual([10, 12]);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM rewards WHERE id = $1', [g.id])).rows[0].n).toBe(1); // kept
    await save(F, a.id, g.id, 1); // stale snapshot
    expect((await call(F, 'DELETE', `/api/rewards/${g.id}`, { confirm_end_savings: r1.json.snapshot })).status).toBe(409);
    expect((await call(F, 'DELETE', `/api/rewards/${g.id}`, { confirm_end_savings: true })).status).toBe(409);
    expect((await delConfirmed(F, g.id)).status).toBe(200);
    const { rows } = await ctx.pool.query("SELECT delta, ended_by FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed' ORDER BY delta", [g.id]);
    expect(rows).toEqual([{ delta: -12, ended_by: 'deleted' }, { delta: -11, ended_by: 'deleted' }]);
    const plain = await newGoal(F, 'Del plain', 50);
    expect((await call(F, 'DELETE', `/api/rewards/${plain.id}`)).status).toBe(200); // nothing saved
  });

  it('N2: reassigning away from one child records "reassigned" for that child only; deleting records "deleted"', async () => {
    const a = await newKid(F, 'Ran', 100);
    const b = await newKid(F, 'Rob', 100);
    const tent = await newGoal(F, 'Ran tent', 200);
    await save(F, a.id, tent.id, 30);
    await save(F, b.id, tent.id, 20);
    await putConfirmed(F, tent.id, { assigned_child_ids: [b.id.toUpperCase()] }); // a loses it
    let rows = (await ctx.pool.query("SELECT child_id, delta, ended_by FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed'", [tent.id])).rows;
    expect(rows).toEqual([{ child_id: a.id, delta: -30, ended_by: 'reassigned' }]);
    expect((await agree(F, b.id)).saved_total).toBe(20);
    expect((await delConfirmed(F, tent.id)).status).toBe(200);
    rows = (await ctx.pool.query("SELECT child_id, delta, ended_by FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed' ORDER BY ended_by", [tent.id])).rows;
    expect(rows).toEqual([{ child_id: b.id, delta: -20, ended_by: 'deleted' }, { child_id: a.id, delta: -30, ended_by: 'reassigned' }]);
    await agree(F, a.id);
    await agree(F, b.id);
    // Activity: under All, with child, goal, amount and cause; not in the other filters.
    const feed = (await call(F, 'GET', `/api/activity-feed?child_id=${b.id}`)).json;
    expect(feed.find((e) => e.type === 'savings_ended')).toMatchObject({ points: 20, label: 'Ran tent', note: 'deleted', child_name: 'Rob' });
    for (const f of ['earned', 'spent', 'goals']) {
      expect((await call(F, 'GET', `/api/activity-feed?child_id=${b.id}&filter=${f}`)).json.some((e) => e.type === 'savings_ended'), f).toBe(false);
    }
    // Export carries the cause.
    expect((await call(F, 'GET', '/api/family/export')).json.savingsEvents.some((e) => e.ended_by === 'deleted')).toBe(true);
  });

  it('017: the scratch rollback refuses once an ended-savings record exists (never lose why savings ended)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const down = fs.readFileSync(path.resolve(__dirname, '../rollbacks/017_savings_ended_by_down.sql'), 'utf8');
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE kind = 'reward_removed'")).rows[0].n).toBeGreaterThan(0);
    await expect(ctx.pool.query(down)).rejects.toThrow(/ended-savings records exist/);
  });

  it('017: a cause only on an ended-savings row, and only the three causes', async () => {
    const kid = await newKid(F, 'Sha', 50);
    const bike = await newGoal(F, 'Sha bike', 100);
    const ev = (await save(F, kid.id, bike.id, 5)).json.event;
    const ins = (kind, ended) => ctx.pool.query(
      'INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, generation, delta, kind, ended_by) VALUES ($1, $2, $3, $4, $5, -1, $6, $7)',
      [F.code, kid.id, bike.id, 'x', ev.generation, kind, ended]);
    await expect(ins('reward_removed', null)).rejects.toThrow(/ended_shape/);
    await expect(ins('spend', 'unmarked')).rejects.toThrow(/ended_shape/);
    await expect(ins('reward_removed', 'forgotten')).rejects.toThrow(/ended_by_check/);
  });

  it('§20.8 B1: an award racing an un-mark with two saved children never deadlocks (probabilistic, 20 rounds)', async () => {
    const a = await newKid(F, 'Dla', 500);
    const b = await newKid(F, 'Dlb', 500);
    for (let round = 0; round < 20; round++) {
      const g = await newGoal(F, `Dl goal ${round}`, 100);
      await save(F, a.id, g.id, 2);
      await save(F, b.id, g.id, 2);
      const [edit, aw1, aw2] = await Promise.all([
        putConfirmed(F, g.id, { is_bigger_goal: false }),
        award(F, b.id, 1),
        award(F, a.id, 1),
      ]);
      expect([edit.status, aw1.status, aw2.status], `round ${round}: ${edit.text}`).toEqual([200, 200, 200]);
    }
    await agree(F, a.id);
    await agree(F, b.id);
  }, 120000);

  it('§20.8 B1 (deterministic): an award holding a saved child, then taking the family lock, does not deadlock with an un-mark', async () => {
    const { recordStreak } = await import('../routes.js');
    const a = await newKid(F, 'Dda', 100);
    const b = await newKid(F, 'Ddb', 100);
    const g = await newGoal(F, 'Dd goal', 100);
    await save(F, a.id, g.id, 5);
    await save(F, b.id, g.id, 5);
    const conn = await ctx.pool.connect();
    try {
      await conn.query('BEGIN');
      // As the award path does: the child FOR UPDATE first...
      await conn.query('SELECT 1 FROM children WHERE id = $1 FOR UPDATE', [b.id]);
      const edit = putConfirmed(F, g.id, { is_bigger_goal: false });
      // ...wait until the edit is blocked on that child...
      for (let i = 0; i < 50; i++) {
        const { rows } = await ctx.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%FOR KEY SHARE%'");
        if (rows[0].n > 0) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      // ...then the family lock (recordStreak), as an award does next.
      await recordStreak(conn, F.code);
      await conn.query('COMMIT');
      const r = await edit;
      expect(r.status, r.text).toBe(200);
    } finally {
      conn.release();
    }
    expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed'", [g.id])).rows[0].n).toBe(2);
  });

  it('N2: an already-ended generation (savings ended before 017, or by direct SQL) is never recorded again or misattributed', async () => {
    const kid = await newKid(F, 'Old', 100);
    const g = await newGoal(F, 'Old goal', 100);
    await save(F, kid.id, g.id, 30);
    // Ended outside the app: the trigger moves the generation, no record is written.
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = false WHERE id = $1', [g.id]);
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [g.id]);
    await save(F, kid.id, g.id, 10); // the current generation
    await putConfirmed(F, g.id, { is_bigger_goal: false });
    const { rows } = await ctx.pool.query("SELECT delta, ended_by FROM savings_events WHERE reward_id = $1 AND kind = 'reward_removed'", [g.id]);
    expect(rows).toEqual([{ delta: -10, ended_by: 'unmarked' }]); // only what this edit ended
  });

  it('§20.8 S1: a child deleted while a goal is un-marked does not fail the edit', async () => {
    for (let round = 0; round < 5; round++) {
      const kid = await newKid(F, `Gone${round}`, 50);
      const other = await newKid(F, `Stay${round}`, 50);
      const g = await newGoal(F, `Gone goal ${round}`, 100);
      await save(F, kid.id, g.id, 5);
      await save(F, other.id, g.id, 5);
      const [first, del] = await Promise.all([
        putConfirmed(F, g.id, { is_bigger_goal: false }),
        call(F, 'DELETE', `/api/children/${kid.id}`),
      ]);
      expect(del.status).toBe(200);
      // §21: if the delete landed between the warning and the confirmation, the
      // affected set changed, so the server asks again (409, nothing changed);
      // confirming the refreshed warning then goes through. Never a 500.
      const edit = first.status === 409 ? await putConfirmed(F, g.id, { is_bigger_goal: false }) : first;
      expect([200, 409]).toContain(first.status);
      expect(edit.status, edit.text).toBe(200);
      expect((await ctx.pool.query("SELECT count(*)::int n FROM savings_events WHERE child_id = $1 AND kind = 'reward_removed'", [other.id])).rows[0].n).toBe(1);
    }
  }, 120000);

  it('every child read costs one savings query for the whole family', async () => {
    const seen = [];
    const orig = ctx.pool.query.bind(ctx.pool);
    ctx.pool.query = (...a) => { if (typeof a[0] === 'string' && a[0].includes('FROM savings_events')) seen.push(a[0]); return orig(...a); };
    try {
      expect((await call(F, 'GET', '/api/children')).status).toBe(200);
    } finally { ctx.pool.query = orig; }
    expect(seen).toHaveLength(1);
  });

  it('the family export includes the savings ledger', async () => {
    const r = await call(F, 'GET', '/api/family/export');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.savingsEvents)).toBe(true);
    expect(r.json.savingsEvents.length).toBeGreaterThan(0);
    expect(r.json.savingsEvents[0]).toHaveProperty('kind');
    expect(r.json.savingsEvents[0]).not.toHaveProperty('request_id');
    expect(r.json.rewards.some((x) => x.is_bigger_goal)).toBe(true);
    const theirs = await call(G, 'GET', '/api/family/export');
    expect(theirs.json.savingsEvents).toEqual([]);
  });
});
