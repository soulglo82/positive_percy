// @vitest-environment node
// The owner's restored-backup run (D1 design §13.4, §15): production is at
// migration 012, so on a restored copy 014 and 015 are pending as well as 016.
// The CLI must apply those V1 prerequisites, prove they change nothing
// families have, then run the 016 apply / roll back / re-apply cycle.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startApp, stopApp } from './harness.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const ROOT = path.resolve(__dirname, '../..');

// A database exactly as production is at migration `upTo` (base schema and
// migrations 001..upTo), holding family data as production does.
async function buildCopy(ctx, upTo) {
  const dir = fs.mkdtempSync(path.resolve(__dirname, '../.migrations-to-' + upTo + '-'));
  try {
    const src = path.resolve(__dirname, '../migrations');
    for (const f of fs.readdirSync(src)) if (Number(f.slice(0, 3)) <= upTo) fs.copyFileSync(path.join(src, f), path.join(dir, f));
    await ctx.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const { initDb } = await import('../db.js');
    await initDb({ migrationOptions: { dir, log: () => {} } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const q = (sql, p) => ctx.pool.query(sql, p);
  await q("INSERT INTO families (family_code, family_name, timezone) VALUES ('CLI012', 'The Copy Family', 'Asia/Singapore')");
  const { rows: [kid] } = await q("INSERT INTO children (name, family_code, total_points, weekly_target) VALUES ('Lara', 'CLI012', 30, 25) RETURNING id");
  await q("INSERT INTO point_events (child_id, child_name, points, category, family_code, kind) VALUES ($1, 'Lara', 35, 'Kindness', 'CLI012', 'award')", [kid.id]);
  const { rows: [rw] } = await q("INSERT INTO rewards (title, cost_points, family_code, emoji, assigned_child_ids) VALUES ('Movie night', 5, 'CLI012', '🎬', ARRAY[upper($1::text)]) RETURNING id", [kid.id]);
  await q("INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code) VALUES ($1, 'Lara', $2, 'Movie night', 5, 'Completed', 'CLI012')", [kid.id, rw.id]);
  await q('CREATE TABLE percy_restore_marker (token text NOT NULL, restored_from text, restored_at timestamptz DEFAULT now())');
  await q("INSERT INTO percy_restore_marker (token, restored_from) VALUES ('cli-test-token', 'test fixture')");
  const names = (await q('SELECT name FROM schema_migrations')).rows.map((r) => r.name);
  expect(names.some((n) => Number(n.slice(0, 3)) === upTo)).toBe(true);
  expect(names.some((n) => Number(n.slice(0, 3)) > upTo)).toBe(false);
}

const run = () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'percy-cli-'));
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/d1-reconcile.mjs'), '--database-url', process.env.TEST_DATABASE_URL,
    '--i-confirm-this-is-a-copy', '--copy-token', 'cli-test-token'], { cwd, env, encoding: 'utf8', timeout: 120000 });
  const report = JSON.parse(fs.readFileSync(path.join(cwd, 'd1-reconcile-report.json'), 'utf8'));
  fs.rmSync(cwd, { recursive: true, force: true });
  return { r, report };
};

describe.skipIf(!hasDb)('d1-reconcile CLI on a copy at migration 012', () => {
  let ctx;
  beforeAll(async () => { ctx = await startApp(); await buildCopy(ctx, 12); }, 120000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  // Refusals first; each leaves the copy as it found it (nothing is applied
  // before these checks).
  it('refuses a copy with an applied migration this branch does not have (e.g. a 013 from another branch)', async () => {
    await ctx.pool.query("INSERT INTO schema_migrations (name) VALUES ('013_recoverable_account_deletion.sql')");
    try {
      const { r, report } = run();
      expect(report.error).toMatch(/does not know: 013_recoverable_account_deletion\.sql/);
      expect(report.steps).toEqual([]);
      expect(r.status).toBe(1);
    } finally {
      await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '013_recoverable_account_deletion.sql'");
    }
  }, 180000);

  it('refuses when a non-V1 migration is pending', async () => {
    const [{ name }] = (await ctx.pool.query("SELECT name FROM schema_migrations WHERE name LIKE '011%'")).rows;
    await ctx.pool.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
    try {
      const { r, report } = run();
      expect(report.error).toMatch(/Expected a tail of the V1 migrations.*found: 011/);
      expect(report.steps).toEqual([]);
      expect(r.status).toBe(1);
    } finally {
      await ctx.pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
  }, 180000);

  it('refuses a gap in the V1 migrations (015 recorded, 014 not)', async () => {
    await ctx.pool.query("INSERT INTO schema_migrations (name) VALUES ('015_reward_icon_key.sql')");
    try {
      const { r, report } = run();
      expect(report.error).toMatch(/found: 014_todays_goals\.sql, 016_savings_ledger\.sql/);
      expect(report.steps).toEqual([]);
      expect(r.status).toBe(1);
    } finally {
      await ctx.pool.query("DELETE FROM schema_migrations WHERE name = '015_reward_icon_key.sql'");
    }
  }, 180000);

  it('applies 014 and 015 first, then proves 016, with nothing families have changed', async () => {
    const { r, report } = run();
    expect(report.error, r.stdout + r.stderr).toBeUndefined();
    expect(report.pending).toEqual(['014_todays_goals.sql', '015_reward_icon_key.sql', '016_savings_ledger.sql', '017_savings_ended_by.sql']);
    expect(report.steps.map((s) => s.name)).toEqual(['apply 014 and 015 (V1 prerequisites)', 'apply 016 and 017', 'roll 017 and 016 back', 'apply 016 and 017 again']);
    for (const s of report.steps) expect(s.changed, s.name).toEqual([]);
    expect(report.families).toBe(1);
    expect(report.rewards_with_mixed_case_assignments).toBe(1);
    expect(r.status).toBe(0);
  }, 180000);

  it('a second run is refused: the copy already has 016', () => {
    const { r, report } = run();
    expect(report.error).toMatch(/already has migration 016/);
    expect(r.status).toBe(1);
  }, 180000);
});

describe.skipIf(!hasDb)('d1-reconcile CLI on a copy already at migration 014', () => {
  let ctx;
  beforeAll(async () => { ctx = await startApp(); await buildCopy(ctx, 14); }, 120000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

  it('applies only 015 as the prerequisite, then proves 016', () => {
    const { r, report } = run();
    expect(report.error, r.stdout + r.stderr).toBeUndefined();
    expect(report.pending).toEqual(['015_reward_icon_key.sql', '016_savings_ledger.sql', '017_savings_ended_by.sql']);
    expect(report.steps.map((s) => s.name)).toEqual(['apply 015 (V1 prerequisites)', 'apply 016 and 017', 'roll 017 and 016 back', 'apply 016 and 017 again']);
    for (const s of report.steps) expect(s.changed, s.name).toEqual([]);
    expect(r.status).toBe(0);
  }, 180000);
});
