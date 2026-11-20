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

describe.skipIf(!hasDb)('d1-reconcile CLI on a copy at migration 012', () => {
  let ctx;
  beforeAll(async () => {
    ctx = await startApp();
    // A database exactly as production is: base schema and migrations 001-012.
    const dir = fs.mkdtempSync(path.resolve(__dirname, '../.migrations-to-012-'));
    try {
      const src = path.resolve(__dirname, '../migrations');
      for (const f of fs.readdirSync(src)) if (Number(f.slice(0, 3)) <= 12) fs.copyFileSync(path.join(src, f), path.join(dir, f));
      await ctx.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      const { initDb } = await import('../db.js');
      await initDb({ migrationOptions: { dir, log: () => {} } });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // Family data as production holds it at 012.
    const q = (sql, p) => ctx.pool.query(sql, p);
    await q("INSERT INTO families (family_code, family_name, timezone) VALUES ('CLI012', 'The Copy Family', 'Asia/Singapore')");
    const { rows: [kid] } = await q("INSERT INTO children (name, family_code, total_points, weekly_target) VALUES ('Lara', 'CLI012', 30, 25) RETURNING id");
    await q("INSERT INTO point_events (child_id, child_name, points, category, family_code, kind) VALUES ($1, 'Lara', 35, 'Kindness', 'CLI012', 'award')", [kid.id]);
    const { rows: [rw] } = await q("INSERT INTO rewards (title, cost_points, family_code, emoji, assigned_child_ids) VALUES ('Movie night', 5, 'CLI012', '🎬', ARRAY[upper($1::text)]) RETURNING id", [kid.id]);
    await q("INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code) VALUES ($1, 'Lara', $2, 'Movie night', 5, 'Completed', 'CLI012')", [kid.id, rw.id]);
    await q('CREATE TABLE percy_restore_marker (token text NOT NULL, restored_from text, restored_at timestamptz DEFAULT now())');
    await q("INSERT INTO percy_restore_marker (token, restored_from) VALUES ('cli-test-token', 'test fixture at 012')");
    const names = (await q('SELECT name FROM schema_migrations')).rows.map((r) => r.name);
    expect(names.some((n) => n.startsWith('012'))).toBe(true);
    expect(names.some((n) => /^01[456]/.test(n))).toBe(false);
  }, 120000);
  afterAll(async () => { if (ctx) await stopApp(ctx); });

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

  it('applies 014 and 015 first, then proves 016, with nothing families have changed', async () => {
    const { r, report } = run();
    expect(report.error, r.stdout + r.stderr).toBeUndefined();
    expect(report.pending).toEqual(['014_todays_goals.sql', '015_reward_icon_key.sql', '016_savings_ledger.sql']);
    expect(report.steps.map((s) => s.name)).toEqual(['apply 014 and 015 (V1 prerequisites)', 'apply 016', 'roll 016 back', 'apply 016 again']);
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
