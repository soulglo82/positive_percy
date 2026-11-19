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
import { fingerprint, differences, legacyFamilyGoals } from '../reconcile.js';
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
    expect(before.tables.savings_events).toBeUndefined();
    expect(before.tables.rewards.cols).not.toContain('is_bigger_goal');
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
    expect(await one("SELECT count(*)::int n FROM children WHERE jsonb_array_length(reward_stack) >= 3")).toBe(1);
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
    expect(differences(before, after)).toEqual([]);
    expect(after.added).toEqual(['savings_events']);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM savings_events')).rows[0].n).toBe(0);
    expect((await ctx.pool.query('SELECT count(*)::int n FROM rewards WHERE is_bigger_goal')).rows[0].n).toBe(0);
  });

  it('the app reports the same balances after 016 (total and available, every child)', async () => {
    for (const F of [seed.A, seed.B]) {
      const kids = (await api(ctx.base, 'GET', '/api/children', { token: F.token })).json;
      for (const k of kids) {
        expect(k.total_points, k.name).toBe(before.children[k.id].total_points);
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

  it('rollback restores the exact pre-016 state; 016 then applies again cleanly', async () => {
    await rollback();
    const rolledBack = await fingerprint(ctx.pool, before);
    expect(differences(before, rolledBack)).toEqual([]);
    expect(rolledBack.added).toEqual([]);
    await runMigrations(ctx.pool, { log: () => {} });
    expect(differences(before, await fingerprint(ctx.pool, before))).toEqual([]);
    await runMigrations(ctx.pool, { log: () => {} }); // a second boot does nothing
    expect(differences(before, await fingerprint(ctx.pool, before))).toEqual([]);
  });

  it('the key rule: 50 points into a bigger goal lower available by 50 and nothing else', async () => {
    const { B } = seed;
    const sam = seed.children.sam;
    const bike = seed.rewards.mountainBike;
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = true WHERE id = $1', [bike.id]); // a parent marks it (D7)
    const get = async () => (await api(ctx.base, 'GET', '/api/children', { token: B.token })).json.find((c) => c.id === sam.id);
    const was = await get();
    const factsWas = (await fingerprint(ctx.pool)).children[sam.id];
    expect(was.available_points).toBeGreaterThanOrEqual(50);
    // The save itself (its endpoint comes with the feature; the ledger row is what it writes).
    await ctx.pool.query(
      "INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, delta, kind, request_id) VALUES ($1, $2, $3, 'Mountain bike', 50, 'save', $4)",
      [B.code, sam.id, bike.id, crypto.randomUUID()]);
    const now = await get();
    const facts = (await fingerprint(ctx.pool)).children[sam.id];
    expect(now.available_points).toBe(was.available_points - 50);
    expect(now.total_points).toBe(was.total_points);
    expect(now.saved_total).toBe(50);
    expect(now.goals).toEqual([expect.objectContaining({ rewardId: bike.id, saved: 50, cost: 300, to_go: 250 })]);
    // The database view agrees, and history and spent are untouched.
    expect(facts).toMatchObject({ total_points: factsWas.total_points, history: factsWas.history, points_spent: factsWas.points_spent, saved: 50, available: factsWas.available - 50 });
    // Un-designating the goal returns the points to available (read-time filter).
    await ctx.pool.query('UPDATE rewards SET is_bigger_goal = false WHERE id = $1', [bike.id]);
    expect((await get()).available_points).toBe(was.available_points);
  });

  it('the schema refuses ledger rows of the wrong shape', async () => {
    const { A } = seed;
    const kid = seed.children.lara.id;
    const ins = (delta, kind, requestId) => ctx.pool.query(
      'INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, delta, kind, request_id) VALUES ($1, $2, gen_random_uuid(), $3, $4, $5, $6)',
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
    ['points auto-allocated to a goal', "INSERT INTO savings_events (family_code, child_id, reward_id, reward_title, delta, kind, request_id) SELECT family_code, id, gen_random_uuid(), 'x', 10, 'save', gen_random_uuid() FROM children WHERE name = 'Omar'", /saved 0 -> 10/],
    ['a legacy family goal contribution reset', 'UPDATE family_goals SET current_points = 0', /table family_goals: row contents changed/],
    ['a history row removed', "DELETE FROM point_events WHERE family_code IS NULL", /table point_events/],
    ['a request dropped', "UPDATE children SET reward_stack = '[]' WHERE name = 'Lara'", /stack/],
    ['a redemption status rewritten', "UPDATE redemptions SET status = 'Completed' WHERE status = 'Pending'", /table redemptions: row contents changed/],
  ])('the check catches: %s', async (_label, damage, expected) => {
    const client = await ctx.pool.connect();
    try {
      await client.query('BEGIN');
      // Only what this damage adds counts (earlier tests saved 50 for Sam).
      const base = new Set(differences(before, await fingerprint(client, before)));
      await client.query(damage);
      const fresh = differences(before, await fingerprint(client, before)).filter((d) => !base.has(d));
      expect(fresh.join('\n')).toMatch(expected);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
