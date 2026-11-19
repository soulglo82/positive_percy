// @vitest-environment node
// D1 data-preservation proof (owner requirement 2026-11-19, issue #56;
// docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §11). On a realistic copy of
// existing family data:
//   1. migration 016 changes nothing families already have: every existing
//      table (every row, every pre-existing column), every child's balance,
//      spent total, requests, history total, set-aside and available points;
//   2. it creates no savings and designates no goals;
//   3. the rollback restores the exact pre-016 state, and 016 re-applies
//      cleanly on top;
//   4. the key rule: moving 50 points into a bigger goal lowers available
//      points by 50 and changes nothing else (total, history, spent).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { startApp, stopApp, api } from './harness.js';
import { runMigrations } from '../migrate.js';
import { fingerprint, differences, addedSchema, legacyFamilyGoals, overCommitted } from '../reconcile.js';
import { seedLegacyFamilies } from './fixtures/legacyFamilies.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const DOWN = fs.readFileSync(path.resolve(__dirname, '../rollbacks/016_savings_ledger_down.sql'), 'utf8');

describe.skipIf(!hasDb)('D1: migration 016 preserves existing family data', () => {
  let ctx, seed, before;
  const rollback = async () => {
    await ctx.pool.query(DOWN);
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '016_savings_ledger.sql'"); // test only: lets 016 run again
  };

  beforeAll(async () => {
    ctx = await startApp();
    // Fill the database like a real one (through today's API, which needs
    // the current schema), then take it back to its pre-016 shape. 016 holds
    // no data yet, so this leaves exactly a pre-016 database with families in it.
    seed = await seedLegacyFamilies(ctx);
    await rollback();
    before = await fingerprint(ctx.pool);
    expect(before.tables['public.savings_events']).toBeUndefined();
    expect(before.tables['public.rewards'].cols).not.toContain('is_bigger_goal');
    expect(before.migrations).not.toContain('016_savings_ledger.sql');
  }, 60000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('the fixture is realistic: the awkward shapes are really there', async () => {
    const one = async (sql) => (await ctx.pool.query(sql)).rows[0].n;
    expect(await one("SELECT count(*)::int n FROM point_events WHERE family_code IS NULL")).toBeGreaterThan(0);
    expect(await one("SELECT count(*)::int n FROM point_events WHERE kind = 'undo' OR reverses_id IS NOT NULL")).toBeGreaterThan(0);
    for (const s of ['Completed', 'Reversed', 'Pending', 'Denied']) {
      expect(await one(`SELECT count(*)::int n FROM redemptions WHERE status = '${s}'`), s).toBeGreaterThan(0);
    }
    expect(await one('SELECT count(*)::int n FROM today_goal_completions')).toBeGreaterThan(0);
    expect(await one("SELECT count(*)::int n FROM children WHERE CASE WHEN jsonb_typeof(reward_stack) = 'array' THEN jsonb_array_length(reward_stack) >= 3 ELSE false END")).toBe(2);
    expect(await one("SELECT count(*)::int n FROM children WHERE reward_stack IS NULL")).toBe(1);
    expect(await one("SELECT count(*)::int n FROM children WHERE jsonb_typeof(reward_stack) = 'object'")).toBe(1);
    expect(await one("SELECT count(*)::int n FROM rewards WHERE family_code IS NULL")).toBe(1);
    expect(await one('SELECT count(*)::int n FROM uploads')).toBe(1);
    expect(await one('SELECT count(*)::int n FROM users')).toBe(1);
    expect(await one('SELECT count(*)::int n FROM family_goals WHERE current_points > 0')).toBe(3);
    // A stacked request whose reward was deleted, and one reassigned away.
    const lara = before.children[seed.children.lara.id];
    expect(lara.reserved).toBe(25); // only Movie night still counts
    expect(JSON.parse(lara.stack)).toHaveLength(3);
    // Every child's history adds up to its balance (the A2 C4 rule).
    for (const c of Object.values(before.children)) expect(c.history).toBe(c.total_points);
  });

  it('016 changes nothing families have, creates no savings and designates no goals', async () => {
    await runMigrations(ctx.pool, { log: () => {} });
    const after = await fingerprint(ctx.pool, before);
    expect(differences(before, after, { allowMigrations: ['016_savings_ledger.sql'] })).toEqual([]);
    expect(after.added).toEqual(['savings_events']);
    // What 016 added to the structure: the goal column, the ledger and its
    // constraints and indexes - nothing else.
    const added = addedSchema(before, after);
    expect(added.every((o) => /savings_events|public\.rewards\.(is_bigger_goal|goal_epoch|goal_child_epochs|rewards_goal_generation)/.test(o)), added.join('\n')).toBe(true);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM savings_events')).rows[0].n).toBe(0);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM rewards WHERE is_bigger_goal')).rows[0].n).toBe(0);
  });

  it('the app reports the same balances after 016 (total and available, every child)', async () => {
    for (const F of [seed.A, seed.B]) {
      const kids = (await api(ctx.base, 'GET', '/api/children', { token: F.token })).json;
      for (const k of kids) {
        expect(k.total_points, k.name).toBe(before.children[k.id].total_points);
        // The app (JavaScript) and the reconciliation (SQL) agree, child by child.
        expect(k.available_points, k.name).toBe(before.children[k.id].available);
        expect(k.saved_total, k.name).toBe(0);
        expect(k.goals, k.name).toEqual([]);
      }
    }
  });

  it('legacy family goals are left exactly as they were, and are not child savings', async () => {
    expect(await legacyFamilyGoals(ctx.pool)).toEqual({ goals: 3, with_contributions: 3, contributed_total: 230, families: 2 });
    // (120 + 50 capped at its target + 60.) No savings row refers to them.
    const ids = (await ctx.pool.query('SELECT id FROM family_goals')).rows.map((r) => r.id);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM savings_events WHERE reward_id = ANY($1::uuid[])', [ids])).rows[0].n).toBe(0);
  });

  let rolledBackSchema;
  it('rollback restores the exact pre-016 state; 016 then applies again cleanly', async () => {
    await rollback();
    const rolledBack = await fingerprint(ctx.pool, before);
    expect(differences(before, rolledBack)).toEqual([]);
    expect(rolledBack.added).toEqual([]);
    expect([...rolledBack.schema].sort()).toEqual([...before.schema].sort()); // nothing left behind
    rolledBackSchema = rolledBack.schema;
    await runMigrations(ctx.pool, { log: () => {} });
    const again = await fingerprint(ctx.pool, before);
    expect(differences(before, again, { allowMigrations: ['016_savings_ledger.sql'] })).toEqual([]);
    expect(again.added).toEqual(['savings_events']);
    await runMigrations(ctx.pool, { log: () => {} }); // a second boot does nothing
    expect(differences(before, await fingerprint(ctx.pool, before), { allowMigrations: ['016_savings_ledger.sql'] })).toEqual([]);
  });

  // Ledger helpers for the tests below (the save endpoints come with the
  // feature; these are the rows they will write).
  // Written in the goal's CURRENT generation for the child, as the save
  // endpoint will (read from the reward row, the trigger's output).
  const generationOf = async (rewardId, childId) => (await ctx.pool.query(
    "SELECT goal_epoch::text || ':' || COALESCE(goal_child_epochs->>$2::text, '0') AS g FROM rewards WHERE id = $1", [rewardId, childId])).rows[0].g;
  const ledger = async (F, child, reward, delta, kind = delta > 0 ? 'save' : 'release', generation = null) => ctx.pool.query(
    'INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, generation, delta, kind, request_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [F.code, child.id, reward.id, reward.title, generation ?? await generationOf(reward.id, child.id), delta, kind, crypto.randomUUID()]);
  const appChild = async (F, id) => (await api(ctx.base, 'GET', '/api/children', { token: F.token })).json.find((c) => c.id === id);
  // After every ledger change the app and the SQL reconciliation must agree.
  const agree = async (F, id) => {
    const app = await appChild(F, id);
    const db = (await fingerprint(ctx.pool)).children[id];
    expect({ total: app.total_points, available: app.available_points, saved: app.saved_total })
      .toEqual({ total: db.total_points, available: db.available, saved: db.saved });
    expect(db.committed).toBeLessThanOrEqual(db.total_points); // available is clamped: check what it hides (O6 review #4)
    return app;
  };

  it('the key rule: 50 points into a bigger goal lower available by 50 and nothing else', async () => {
    const { B } = seed;
    const sam = seed.children.sam;
    const bike = seed.rewards.mountainBike;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]); // a parent marks it (D7)
    const was = await agree(B, sam.id);
    const factsWas = (await fingerprint(ctx.pool)).children[sam.id];
    expect(was.available_points).toBeGreaterThanOrEqual(50);
    await ledger(B, sam, bike, 50);
    const now = await agree(B, sam.id);
    expect(now.available_points).toBe(was.available_points - 50);
    expect(now.total_points).toBe(was.total_points);
    expect(now.saved_total).toBe(50);
    expect(now.goals).toEqual([expect.objectContaining({ rewardId: bike.id, saved: 50, cost: 300, to_go: 250 })]);
    const facts = (await fingerprint(ctx.pool)).children[sam.id];
    expect(facts).toMatchObject({ total_points: factsWas.total_points, history: factsWas.history, points_spent: factsWas.points_spent });
    // Un-marking the goal returns the points to available, in both views.
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = false WHERE id = $1', [bike.id]);
    expect((await agree(B, sam.id)).available_points).toBe(was.available_points);
    // O6: re-marking starts a NEW allocation period. The old 50 stay in the
    // history but never count again.
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]);
    const remarked = await agree(B, sam.id);
    expect(remarked.saved_total).toBe(0);
    expect(remarked.available_points).toBe(was.available_points);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM savings_events WHERE child_id = $1', [sam.id])).rows[0].n).toBe(1); // history kept
    // The tests below start from 50 saved in the current generation.
    await ledger(B, sam, bike, 50);
    expect((await agree(B, sam.id)).available_points).toBe(was.available_points - 50);
  });

  it('the scratch rollback refuses to run once savings exist (owner review: never destroy the ledger)', async () => {
    expect((await ctx.pool.query('SELECT count(*)::int n FROM savings_events')).rows[0].n).toBeGreaterThan(0);
    await expect(ctx.pool.query(DOWN)).rejects.toThrow(/savings exist/);
    expect((await ctx.pool.query("SELECT to_regclass('public.savings_events') IS NOT NULL AS t")).rows[0].t).toBe(true);
  });

  it("O6, the owner's example: un-mark, spend 80, re-mark never over-commits", async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const kid = (await call('POST', '/api/children', { name: 'Ollie' })).json;
    await call('POST', `/api/children/${kid.id}/award`, { points: 100, category: 'Kindness', request_id: crypto.randomUUID() });
    const bike = (await call('POST', '/api/rewards', { title: 'Ollie bike', cost_points: 300 })).json;
    const sweets = (await call('POST', '/api/rewards', { title: 'Sweets', cost_points: 80 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]);
    await ledger(B, kid, bike, 100);
    expect((await agree(B, kid.id)).available_points).toBe(0);
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = false WHERE id = $1', [bike.id]); // un-mark
    expect((await agree(B, kid.id)).available_points).toBe(100);
    expect((await call('POST', `/api/children/${kid.id}/redeem`, { reward_id: sweets.id, request_id: crypto.randomUUID() })).status).toBe(200); // spend 80
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]); // re-mark
    const after = await agree(B, kid.id);
    expect(after).toMatchObject({ total_points: 20, saved_total: 0, available_points: 20 });
    const db = (await fingerprint(ctx.pool)).children[kid.id];
    expect(db.committed).toBeLessThanOrEqual(db.total_points); // no hidden over-commit behind the clamp
  });

  it('O6: reassigning away and back, and delete/recreate, never revive savings; a sibling keeps theirs', async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const ann = (await call('POST', '/api/children', { name: 'Ann' })).json;
    const ben = (await call('POST', '/api/children', { name: 'Ben' })).json;
    for (const k of [ann, ben]) await call('POST', `/api/children/${k.id}/award`, { points: 60, category: 'Kindness', request_id: crypto.randomUUID() });
    const kite = (await call('POST', '/api/rewards', { title: 'Big kite', cost_points: 100 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [kite.id]);
    await ledger(B, ann, kite, 30);
    await ledger(B, ben, kite, 40);
    expect((await call('PUT', `/api/rewards/${kite.id}`, { assigned_child_ids: [ben.id] })).status).toBe(200); // away from Ann
    expect((await agree(B, ann.id)).saved_total).toBe(0);
    expect((await call('PUT', `/api/rewards/${kite.id}`, { assigned_child_ids: [] })).status).toBe(200); // back to everyone
    expect((await agree(B, ann.id)).saved_total).toBe(0); // not revived
    expect((await agree(B, ben.id)).saved_total).toBe(40); // Ben never lost access
    // A direct write cannot move a generation back (the trigger owns it).
    await ctx.pool.query("UPDATE rewards SET goal_epoch = 0, goal_child_epochs = '{}'::jsonb WHERE id = $1", [kite.id]);
    expect((await agree(B, ann.id)).saved_total).toBe(0);
    // Delete and recreate with the same title: a different reward; nothing carries over.
    await call('DELETE', `/api/rewards/${kite.id}`);
    const kite2 = (await call('POST', '/api/rewards', { title: 'Big kite', cost_points: 100 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [kite2.id]);
    expect((await agree(B, ben.id)).saved_total).toBe(0);
    expect((await agree(B, ben.id)).available_points).toBe(60);
  });

  it('O6: concurrent goal edits and saves never over-commit (a stale generation only under-counts)', async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const kid = (await call('POST', '/api/children', { name: 'Racer' })).json;
    await call('POST', `/api/children/${kid.id}/award`, { points: 50, category: 'Kindness', request_id: crypto.randomUUID() });
    const goal = (await call('POST', '/api/rewards', { title: 'Race goal', cost_points: 500 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [goal.id]);
    for (let round = 0; round < 10; round++) {
      const gen = await generationOf(goal.id, kid.id); // read, then race a toggle against the write
      await Promise.all([
        ctx.pool.query('UPDATE rewards SET is_bigger_goal = NOT is_bigger_goal WHERE id = $1', [goal.id]),
        ledger(B, kid, goal, 5, 'save', gen),
      ]);
      const app = await agree(B, kid.id);
      const db = (await fingerprint(ctx.pool)).children[kid.id];
      expect(db.committed).toBeLessThanOrEqual(db.total_points);
      expect(app.saved_total).toBeLessThanOrEqual(5); // only a write in the live generation can count
    }
  });

  it('review: a goal that is also requested is counted once, and a negative sum never adds points', async () => {
    const { B } = seed;
    const sam = seed.children.sam;
    const bike = seed.rewards.mountainBike;
    const base = await agree(B, sam.id); // 50 saved towards the bike from the test above
    // Requested before it became a goal (stored directly: stack/add now refuses goals).
    await ctx.pool.query("UPDATE children SET reward_stack = reward_stack || $2::jsonb WHERE id = $1",
      [sam.id, JSON.stringify([{ rewardId: bike.id, name: 'Mountain bike', cost: 300 }])]);
    const both = await agree(B, sam.id);
    // 300 requested and 50 saved for the same reward commit 300 (the larger), not 350.
    expect(both.available_points).toBe(base.available_points + 50 - 300);
    // Over-release: the sum goes negative (no endpoint can write this); it must not create points.
    await ledger(B, sam, bike, -80, 'release');
    const neg = await agree(B, sam.id);
    expect(neg.saved_total).toBe(0);
    expect(neg.available_points).toBe(base.available_points + 50 - 300);
    // Put Sam back: drop the bike request and the two test rows.
    await ctx.pool.query("UPDATE children SET reward_stack = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(reward_stack) e WHERE e->>'rewardId' <> $2) WHERE id = $1", [sam.id, bike.id]);
    await ctx.pool.query('DELETE FROM savings_events WHERE child_id = $1 AND delta = -80', [sam.id]);
    expect((await agree(B, sam.id)).available_points).toBe(base.available_points);
  });

  it('review: every write path respects savings (no saved point is spent twice)', async () => {
    const { B } = seed;
    const sam = seed.children.sam;
    const bike = seed.rewards.mountainBike;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    // A bigger goal cannot be requested through the stack.
    expect((await call('POST', `/api/children/${sam.id}/stack/add`, { reward_id: bike.id })).status).toBe(409);
    // A reward with savings is not spent directly (it is redeemed through its goal).
    expect((await call('POST', `/api/children/${sam.id}/redeem`, { reward_id: bike.id, request_id: crypto.randomUUID() })).status).toBe(409);
    // Save almost everything that is available, then try to spend or undo past it.
    const kid = (await call('POST', '/api/children', { name: 'Saver' })).json;
    const award = (await call('POST', `/api/children/${kid.id}/award`, { points: 30, category: 'Kindness', request_id: crypto.randomUUID() })).json;
    const toy = (await call('POST', '/api/rewards', { title: 'Toy', cost_points: 10 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]);
    await ledger(B, kid, bike, 25);
    const k1 = await agree(B, kid.id);
    expect(k1.available_points).toBe(5);
    expect((await call('POST', `/api/children/${kid.id}/redeem`, { reward_id: toy.id, request_id: crypto.randomUUID() })).status).toBe(400);
    expect((await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: toy.id })).status).toBe(400);
    expect((await call('POST', `/api/point-events/${award.event.id}/undo`, { request_id: crypto.randomUUID() })).status).toBe(409);
    expect((await agree(B, kid.id)).total_points).toBe(30); // nothing was spent or undone
  });

  it('O6 review #1: a child id in capitals reaches the same savings (redeem, stack/add, stack/confirm)', async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const kid = (await call('POST', '/api/children', { name: 'Caps' })).json;
    const ID = kid.id.toUpperCase();
    expect(ID).not.toBe(kid.id);
    await call('POST', `/api/children/${kid.id}/award`, { points: 100, category: 'Kindness', request_id: crypto.randomUUID() });
    const bike = (await call('POST', '/api/rewards', { title: 'Caps bike', cost_points: 300 })).json;
    const toy = (await call('POST', '/api/rewards', { title: 'Caps toy', cost_points: 80 })).json;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]);
    await ledger(B, kid, bike, 100);
    expect((await call('POST', `/api/children/${ID}/redeem`, { reward_id: toy.id, request_id: crypto.randomUUID() })).status).toBe(400);
    expect((await call('POST', `/api/children/${ID}/stack/add`, { reward_id: toy.id })).status).toBe(400);
    // Release the savings: the request now fits, and confirm in capitals still sees the savings again once re-saved.
    await ledger(B, kid, bike, -100);
    expect((await call('POST', `/api/children/${ID}/stack/add`, { reward_id: toy.id })).status).toBe(200);
    await ledger(B, kid, bike, 30); // 80 requested + 30 saved > 100
    const confirm = await call('POST', `/api/children/${ID}/stack/confirm`, {
      request_id: crypto.randomUUID(), expected: [{ reward_id: toy.id, stack_index: 0, cost: 80 }] });
    expect(confirm.status).toBe(400);
    await ledger(B, kid, bike, -30); // the direct ledger row above bypassed the save checks; undo it before checking agreement
    const after = await agree(B, kid.id);
    expect(after.total_points).toBe(100);
    // Assignments are stored in the one spelling too (O6 review #6).
    const only = (await call('POST', '/api/rewards', { title: 'Caps only', cost_points: 5, assigned_child_ids: [ID] })).json;
    expect(only.assigned_child_ids).toEqual([kid.id]);
  });

  it('O6 review #2: an inserted reward always starts at generation 0:0', async () => {
    const { B } = seed;
    const { rows } = await ctx.pool.query(
      "INSERT INTO rewards (family_code, title, cost_points, is_bigger_goal, goal_epoch, goal_child_epochs) VALUES ($1, 'Reinserted', 10, true, 7, '{\"x\": 3}') RETURNING goal_epoch, goal_child_epochs",
      [B.code]);
    expect(rows[0]).toEqual({ goal_epoch: 0, goal_child_epochs: {} });
  });

  it('O6 review #4: the reconciliation reports a child newly promised more than they have', async () => {
    const base = { total_points: 100, committed: 60 };
    expect(overCommitted(base)).toBe(false);
    expect(overCommitted({ total_points: 100, committed: 100 })).toBe(false); // exact boundary is fine
    expect(overCommitted({ total_points: 100, committed: 101 })).toBe(true);
    expect(overCommitted({ total_points: null, committed: 5 })).toBe(false);
    const before = { tables: {}, schema: [], migrations: [], children: { c: { ...base, available: 40 } } };
    const after = { tables: {}, schema: [], migrations: [], children: { c: { ...base, committed: 180, available: 0 } } };
    expect(differences(before, after).some((d) => /committed 180 is more than total 100/.test(d))).toBe(true);
    // Already over-committed before (legacy) is not a new finding by itself.
    expect(differences(after, after)).toEqual([]);
  });

  it('code review of 3722728: a legacy assignment in capitals is the same child everywhere; reassigning still expires savings', async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const kid = (await call('POST', '/api/children', { name: 'Legacy' })).json;
    const sib = (await call('POST', '/api/children', { name: 'Sibling' })).json;
    await call('POST', `/api/children/${kid.id}/award`, { points: 100, category: 'Kindness', request_id: crypto.randomUUID() });
    // Written before the app lower-cased assignments: capitals, straight into the table.
    const { rows: [bike] } = await ctx.pool.query(
      "INSERT INTO rewards (family_code, title, cost_points, assigned_child_ids, is_bigger_goal) VALUES ($1, 'Legacy bike', 300, $2, false) RETURNING id, title",
      [B.code, [kid.id.toUpperCase()]]);
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]);
    await ledger(B, kid, bike, 60);
    expect((await agree(B, kid.id))).toMatchObject({ saved_total: 60, available_points: 40 }); // app and reconciliation agree
    // Away to the sibling and back: the savings stay expired (O6).
    await ctx.pool.query('UPDATE rewards SET assigned_child_ids = $2 WHERE id = $1', [bike.id, [sib.id]]);
    await ctx.pool.query('UPDATE rewards SET assigned_child_ids = $2 WHERE id = $1', [bike.id, [kid.id.toUpperCase()]]);
    expect((await agree(B, kid.id))).toMatchObject({ saved_total: 0, available_points: 100 });
    // Reward ids in capitals reach the same reward (body and query).
    const toy = (await call('POST', '/api/rewards', { title: 'Legacy toy', cost_points: 5 })).json;
    expect((await call('POST', `/api/children/${kid.id}/stack/add`, { reward_id: toy.id.toUpperCase() })).status).toBe(200);
    const confirm = await call('POST', `/api/children/${kid.id}/stack/confirm`, {
      request_id: crypto.randomUUID(), expected: [{ reward_id: toy.id.toUpperCase(), stack_index: 0, cost: 5 }] });
    expect(confirm.status).toBe(200);
  });

  it('code review of 3722728: a data-only restore keeps generations when the restore flag is set', async () => {
    const { B } = seed;
    const client = await ctx.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL percy.restoring = 'on'");
      const { rows } = await client.query(
        "INSERT INTO rewards (family_code, title, cost_points, is_bigger_goal, goal_epoch, goal_child_epochs) VALUES ($1, 'Restored', 10, true, 3, '{\"a\": 1}') RETURNING goal_epoch, goal_child_epochs",
        [B.code]);
      expect(rows[0]).toEqual({ goal_epoch: 3, goal_child_epochs: { a: 1 } });
      await client.query('ROLLBACK');
    } finally { client.release(); }
  });

  it("code review of 3722728: Today's Goals routes see the id in lower case too", async () => {
    const { B } = seed;
    const call = (method, path, body) => api(ctx.base, method, path, { token: B.token, body: body ?? undefined });
    const kid = (await call('POST', '/api/children', { name: 'Goalie' })).json;
    const cat = (await call('GET', '/api/behavior-categories')).json[0];
    const today = (await call('GET', '/api/todays-goals')).json.date;
    const goal = (await call('POST', '/api/todays-goals', { title: 'Tidy', child_id: kid.id, category_id: cat.id, schedule_kind: 'one_off', scheduled_date: today })).json;
    const id = (goal.goal || goal).id;
    const rq = crypto.randomUUID();
    const first = await call('POST', `/api/todays-goals/${id.toUpperCase()}/complete`, { request_id: rq });
    expect(first.status).toBe(200);
    const again = await call('POST', `/api/todays-goals/${id}/complete`, { request_id: rq });
    expect(again.status).toBe(200); // the same request replays, whatever the spelling
  });

  it('the schema refuses ledger rows of the wrong shape', async () => {
    const { A } = seed;
    const kid = seed.children.lara.id;
    const ins = (delta, kind, requestId) => ctx.pool.query(
      "INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, generation, delta, kind, request_id) VALUES ($1, $2, gen_random_uuid(), $3, '0:0', $4, $5, $6)",
      [A.code, kid, 'x', delta, kind, requestId]);
    await expect(ins(0, 'save', crypto.randomUUID())).rejects.toThrow(/delta/);
    await expect(ins(5, 'save', null)).rejects.toThrow(/savings_events_derived_shape/);
    await expect(ins(5, 'gift', crypto.randomUUID())).rejects.toThrow(/check constraint/);
    const same = crypto.randomUUID();
    await ins(5, 'save', same);
    await expect(ins(5, 'save', same)).rejects.toThrow(/savings_events_request/);
  });

  // The check must be able to fail: each kind of damage a bad migration could
  // do is caught. Each runs inside a transaction that is rolled back.
  it.each([
    ['a balance changed', "UPDATE children SET total_points = total_points + 1 WHERE name = 'Sam'", /total_points/],
    ['points auto-allocated to a goal', "INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, generation, delta, kind, request_id) SELECT c.family_code, c.id, r.id, r.title, r.goal_epoch::text || ':' || COALESCE(r.goal_child_epochs->>c.id::text, '0'), 10, 'save', gen_random_uuid() FROM children c JOIN rewards r ON r.family_code = c.family_code AND r.title = 'Mountain bike' WHERE c.name = 'Sam'", /saved 50 -> 60/],
    ['a legacy family goal contribution reset', 'UPDATE family_goals SET current_points = 0', /table public\.family_goals: row contents changed/],
    ['a history row removed', "DELETE FROM point_events WHERE family_code IS NULL", /table public\.point_events/],
    ['a request dropped', "UPDATE children SET reward_stack = '[]' WHERE name = 'Lara'", /stack/],
    ['a redemption status rewritten', "UPDATE redemptions SET status = 'Completed' WHERE status = 'Pending'", /table public\.redemptions: row contents changed/],
  ])('the check catches: %s', async (_label, damage, expected) => {
    const client = await ctx.pool.connect();
    try {
      await client.query('BEGIN');
      // Compared with the state just before the damage, in the same transaction.
      const base = await fingerprint(client);
      await client.query(damage);
      const found = differences(base, await fingerprint(client, base));
      expect(found.join('\n')).toMatch(expected);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('the rolled-back schema equals a database that never had 016 (built from 001-015 only)', async () => {
    // Next to the real folder, so a .js migration's relative imports resolve.
    const dir = fs.mkdtempSync(path.resolve(__dirname, '../.migrations-without-016-'));
    let fresh;
    try {
      const src = path.resolve(__dirname, '../migrations');
      for (const f of fs.readdirSync(src)) if (!f.startsWith('016')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
      await ctx.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      const { initDb } = await import('../db.js');
      await initDb({ migrationOptions: { dir, log: () => {} } });
      expect((await ctx.pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)).not.toContain('016_savings_ledger.sql');
      fresh = (await fingerprint(ctx.pool)).schema;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect([...fresh].sort()).toEqual([...rolledBackSchema].sort());
  });
});
