// @vitest-environment node
// A2 M0, M1, M2: one-time changes run once, boot changes no existing rows,
// and reconciliation makes every balance equal its history.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startApp, stopApp, api, makeFamily } from './harness.js';

const runDb = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runDb)('A2 step 1: migrations, boot, reconciliation', () => {
  let ctx, runMigrations, initDb;
  beforeAll(async () => {
    ctx = await startApp();
    ({ runMigrations } = await import('../migrate.js'));
    ({ initDb } = await import('../db.js'));
  });
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  const tmpDir = (files) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(d, name), body);
    return d;
  };
  const quiet = () => {};

  it('M0: every migration file is applied once, including 001, and a second boot applies none', async () => {
    const files = fs.readdirSync(path.join(import.meta.dirname, '..', 'migrations')).filter((f) => /^\d{3}_/.test(f)).sort();
    const { rows } = await ctx.pool.query('SELECT name FROM schema_migrations ORDER BY name');
    expect(rows.map((r) => r.name)).toEqual(files);
    expect(files[0]).toBe('001_add_child_age.sql');
    const logs = [];
    await runMigrations(ctx.pool, { log: (m) => logs.push(m) });
    expect(logs).toEqual([]);
  });

  it('M0: a failing migration throws, is not recorded, and leaves nothing half-done', async () => {
    await ctx.pool.query('CREATE TABLE IF NOT EXISTS mig_probe (n INT)');
    const dir = tmpDir({
      '901_ok.sql': 'INSERT INTO mig_probe VALUES (1);',
      '902_bad.sql': 'INSERT INTO mig_probe VALUES (2); SELECT no_such_column FROM mig_probe;',
    });
    await expect(runMigrations(ctx.pool, { dir, log: quiet })).rejects.toThrow(/902_bad\.sql/);
    const { rows } = await ctx.pool.query('SELECT n FROM mig_probe ORDER BY n');
    expect(rows.map((r) => r.n)).toEqual([1]);
    const m = await ctx.pool.query("SELECT name FROM schema_migrations WHERE name LIKE '90%'");
    expect(m.rows.map((r) => r.name)).toEqual(['901_ok.sql']);
  });

  it('M0: two runners at once apply a migration once', async () => {
    await ctx.pool.query('CREATE TABLE IF NOT EXISTS mig_once (n INT)');
    const dir = tmpDir({ '911_once.sql': 'SELECT pg_sleep(0.3); INSERT INTO mig_once VALUES (1);' });
    await Promise.all([runMigrations(ctx.pool, { dir, log: quiet }), runMigrations(ctx.pool, { dir, log: quiet })]);
    const { rows } = await ctx.pool.query('SELECT count(*)::int AS n FROM mig_once');
    expect(rows[0].n).toBe(1);
  });

  it('M1: booting again leaves edited categories and points_spent as they were', async () => {
    const F = await makeFamily(ctx.base, 'Boot family');
    await ctx.pool.query("UPDATE behavior_categories SET points = 7, is_quick_action = false, icon = 'x' WHERE family_code = $1 AND name = 'Kindness'", [F.code]);
    const c = await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Kid' } });
    await ctx.pool.query('UPDATE children SET points_spent = 0 WHERE id = $1', [c.json.id]);
    await ctx.pool.query("INSERT INTO redemptions (child_id, reward_id, child_name, reward_title, reward_cost, status, family_code) VALUES ($1, gen_random_uuid(), 'Kid', 'x', 9, 'Completed', $2)", [c.json.id, F.code]);
    await initDb();
    await initDb();
    const cat = (await ctx.pool.query("SELECT points, is_quick_action, icon FROM behavior_categories WHERE family_code = $1 AND name = 'Kindness'", [F.code])).rows[0];
    expect(cat).toEqual({ points: 7, is_quick_action: false, icon: 'x' });
    const spent = (await ctx.pool.query('SELECT points_spent FROM children WHERE id = $1', [c.json.id])).rows[0].points_spent;
    expect(spent).toBe(0);
  });

  it('healthcheck answers JSON from the database, not the app page', async () => {
    const r = await api(ctx.base, 'GET', '/api/health');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
  });

  it('M2: reconciliation on the production pattern writes the expected corrections and leaves no drift', async () => {
    const F = await makeFamily(ctx.base, 'Recon family');
    const kid = async (name) => (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name } })).json.id;
    // Balance / history (Completed) / Approved, as found in production.
    const cases = [[1103, 1253, 105], [170, 308, 105], [298, 465, 150], [5, 0, 0]];
    await ctx.pool.query('ALTER TABLE children DROP CONSTRAINT IF EXISTS total_points_nonneg');
    const ids = [];
    for (const [balance, history, approved] of cases) {
      const id = await kid('C' + balance);
      ids.push(id);
      if (history) await ctx.pool.query("INSERT INTO point_events (child_id, points, category, family_code) VALUES ($1, $2, 'Kindness', $3)", [id, history, F.code]);
      if (approved) await ctx.pool.query("INSERT INTO redemptions (child_id, reward_id, child_name, reward_title, reward_cost, status, family_code) VALUES ($1, gen_random_uuid(), 'Kid', 'old', $2, 'Approved', $3)", [id, approved, F.code]);
      await ctx.pool.query('UPDATE children SET total_points = $1 WHERE id = $2', [balance, id]);
    }
    // A legacy history row with no family, and a negative balance.
    const legacy = await kid('Legacy');
    await ctx.pool.query("INSERT INTO point_events (child_id, points, category, family_code) VALUES ($1, 20, 'Kindness', NULL)", [legacy]);
    await ctx.pool.query('UPDATE children SET total_points = 20 WHERE id = $1', [legacy]);
    const neg = await kid('Negative');
    await ctx.pool.query('UPDATE children SET total_points = -3 WHERE id = $1', [neg]);

    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '003_reconcile_balances.sql'");
    await runMigrations(ctx.pool, { log: quiet });

    const corr = async (id) => (await ctx.pool.query("SELECT points FROM point_events WHERE child_id = $1 AND kind = 'correction'", [id])).rows.map((r) => r.points);
    expect(await corr(ids[0])).toEqual([-45]);
    expect(await corr(ids[1])).toEqual([-33]);
    expect(await corr(ids[2])).toEqual([-17]);
    expect(await corr(ids[3])).toEqual([5]);
    expect(await corr(legacy)).toEqual([]);
    expect((await ctx.pool.query('SELECT total_points FROM children WHERE id = $1', [neg])).rows[0].total_points).toBe(0);
    // Balances did not move.
    const bal = (await ctx.pool.query('SELECT total_points FROM children WHERE id = ANY($1) ORDER BY total_points', [ids])).rows.map((r) => r.total_points);
    expect(bal).toEqual([5, 170, 298, 1103]);
    expect((await ctx.pool.query("SELECT count(*)::int n FROM redemptions WHERE status = 'Approved'")).rows[0].n).toBe(0);
    // Balances can no longer go below zero.
    await expect(ctx.pool.query('UPDATE children SET total_points = -1 WHERE id = $1', [neg])).rejects.toThrow(/total_points_nonneg/);
  });

  it('test sessions run with production\'s clock settings', async () => {
    const { rows } = await ctx.pool.query("SELECT current_setting('TimeZone') AS tz, current_setting('DateStyle') AS ds");
    expect(rows[0]).toEqual({ tz: 'Etc/UTC', ds: 'ISO, MDY' });
  });

  it('002 on existing rows: legacy starting points are tagged; an award with a request id is not', async () => {
    const F = await makeFamily(ctx.base, 'Tag family');
    const id = (await api(ctx.base, 'POST', '/api/children', { token: F.token, body: { name: 'Tag' } })).json.id;
    const legacy = (await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code, kind) VALUES ($1, 10, ' starting POINTS', $2, 'award') RETURNING id", [id, F.code])).rows[0].id;
    const awarded = (await ctx.pool.query(
      "INSERT INTO point_events (child_id, points, category, family_code, kind, request_id) VALUES ($1, 3, 'Starting points', $2, 'award', gen_random_uuid()) RETURNING id", [id, F.code])).rows[0].id;
    // A row an older server wrote with the default kind still never counts as earned.
    const inView = (await ctx.pool.query('SELECT count(*)::int n FROM effective_point_events WHERE id = ANY($1)', [[legacy, awarded]])).rows[0].n;
    expect(inView).toBe(0);
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '002_point_kind_and_timezone.sql'");
    await runMigrations(ctx.pool, { log: quiet });
    const kinds = Object.fromEntries((await ctx.pool.query('SELECT id, kind FROM point_events WHERE id = ANY($1)', [[legacy, awarded]])).rows.map((r) => [r.id, r.kind]));
    expect(kinds[legacy]).toBe('starting');
    expect(kinds[awarded]).toBe('award');
  });

  it('006 on existing rows: a family with 6 quick points keeps its first 4 by sort order', async () => {
    const F = await makeFamily(ctx.base, 'Cap family');
    await ctx.pool.query('UPDATE behavior_categories SET is_quick_action = true WHERE family_code = $1 AND sort_order < 6', [F.code]);
    await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '006_quick_action_cap.sql'");
    await runMigrations(ctx.pool, { log: quiet });
    const { rows } = await ctx.pool.query('SELECT sort_order FROM behavior_categories WHERE family_code = $1 AND is_quick_action ORDER BY sort_order', [F.code]);
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2, 3]);
  });
});
