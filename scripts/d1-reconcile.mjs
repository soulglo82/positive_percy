#!/usr/bin/env node
// D1 data-preservation run against a RESTORED COPY of real family data
// (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §11). Never point this at
// production: it applies migration 016 and then rolls it back.
//
//   node scripts/d1-reconcile.mjs --database-url postgres://...copy... --i-confirm-this-is-a-copy --copy-token <token>
//
// Proving the target is a copy (owner review 2026-11-19: a URL check alone
// cannot): after restoring the backup, the operator writes a one-time token
// into the COPY, which production never has:
//   CREATE TABLE percy_restore_marker (token text NOT NULL, restored_from text, restored_at timestamptz DEFAULT now());
//   INSERT INTO percy_restore_marker (token, restored_from) VALUES ('<token>', '<backup id>');
// and passes the same token here. No marker, or a different token: refused.
//
// Steps: fingerprint -> apply the V1 prerequisites still pending (014
// Today's Goals, 015 reward icons; production is at 012) -> compare ->
// fingerprint -> apply 016 -> compare -> roll 016 back -> compare -> apply
// 016 again -> compare. Prints a report and exits 1 if anything families had
// changed at any step.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runMigrations } from '../server/migrate.js';
import { fingerprint, differences, addedSchema, legacyFamilyGoals } from '../server/reconcile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const url = arg('--database-url');
const token = arg('--copy-token');
if (!url || !token || !process.argv.includes('--i-confirm-this-is-a-copy')) {
  console.error('Usage: node scripts/d1-reconcile.mjs --database-url <URL of a restored copy> --i-confirm-this-is-a-copy --copy-token <token written into the copy>');
  process.exit(2);
}

// Belt and braces against pointing this at the live database.
if (/railway|rlwy/i.test(url)) { console.error('Refusing a Railway URL: run this on a restored copy only.'); process.exit(2); }
if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) { console.error('Refusing the app\'s own DATABASE_URL: run this on a restored copy only.'); process.exit(2); }

const pool = new pg.Pool({ connectionString: url });
// The V1 release's migrations, in order. 014 and 015 are prerequisites of
// 016 (production is at 012); each is additive.
const V1_MIGRATIONS = ['014_todays_goals.sql', '015_reward_icon_key.sql', '016_savings_ledger.sql'];
// What 014 and 015 add: the Today's Goals tables, their indexes and checks,
// and the nullable rewards.icon_key with its approved-set CHECK.
const PREREQ_SCHEMA = /today_goal|public\.rewards\.icon_key|rewards_icon_key_approved/;
const DOWN = fs.readFileSync(path.join(ROOT, 'server/rollbacks/016_savings_ledger_down.sql'), 'utf8');
const report = { steps: [] };
const step = (name, diffs, extra = {}) => { report.steps.push({ name, changed: diffs, ...extra }); console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${name}${diffs.length ? '\n  ' + diffs.join('\n  ') : ''}`); };

try {
  const marker = await pool.query('SELECT token, restored_from, restored_at FROM percy_restore_marker').catch(() => ({ rows: [] }));
  if (!marker.rows.some((r) => r.token === token)) throw new Error('No matching percy_restore_marker token in this database: it is not a marked restored copy. Refusing.');
  report.restored_from = marker.rows.find((r) => r.token === token).restored_from;
  const applied = (await pool.query("SELECT name FROM schema_migrations WHERE name = '016_savings_ledger.sql'").catch(() => ({ rows: [] }))).rows.length > 0;
  if (applied) throw new Error('This copy already has migration 016. Restore a copy taken before 016.');
  // Only the V1 migrations may be pending: 014 and 015 (each optional, in
  // order) and 016, last. Anything else pending is refused, so the run
  // proves exactly these and nothing else.
  const files = fs.readdirSync(path.join(ROOT, 'server/migrations')).filter((f) => /^\d{3}_.+\.(sql|js)$/.test(f)).sort();
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const pending = files.filter((f) => !done.has(f));
  const unexpected = pending.filter((f) => !V1_MIGRATIONS.includes(f));
  if (unexpected.length || pending[pending.length - 1] !== '016_savings_ledger.sql') {
    throw new Error(`Expected only the V1 migrations (${V1_MIGRATIONS.join(', ')}) pending, ending with 016; found: ${pending.join(', ') || 'none'}`);
  }
  report.pending = pending;
  const original = await fingerprint(pool);
  report.families = (await pool.query('SELECT count(*)::int n FROM families')).rows[0].n;
  report.children = Object.keys(original.children).length;
  report.history_drift_before = Object.values(original.children).filter((c) => c.history !== c.total_points).length;

  // The V1 prerequisites first (each in its own transaction, recorded),
  // proved to change nothing families have.
  const prereq = pending.filter((f) => f !== '016_savings_ledger.sql');
  if (prereq.length) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'percy-v1-prereq-'));
    for (const f of prereq) fs.copyFileSync(path.join(ROOT, 'server/migrations', f), path.join(tmp, f));
    await runMigrations(pool, { dir: tmp, log: () => {} });
    fs.rmSync(tmp, { recursive: true, force: true });
    const afterPrereq = await fingerprint(pool, original);
    const stray = addedSchema(original, afterPrereq).filter((o) => !PREREQ_SCHEMA.test(o));
    step(`apply ${prereq.map((f) => f.slice(0, 3)).join(' and ')} (V1 prerequisites)`,
      [...differences(original, afterPrereq, { allowMigrations: prereq }), ...stray.map((o) => `unexpected new schema object: ${o}`)],
      { added: afterPrereq.added });
  }

  const before = await fingerprint(pool);
  report.legacy_family_goals = await legacyFamilyGoals(pool);
  // Pre-flight (code review of 3722728): assignments stored with capitals
  // before the app lower-cased them. Compared case-insensitively everywhere;
  // counted so the owner sees how many exist.
  report.rewards_with_mixed_case_assignments = (await pool.query(
    "SELECT count(*)::int n FROM rewards WHERE EXISTS (SELECT 1 FROM unnest(assigned_child_ids) x WHERE x <> lower(x))")).rows[0].n;

  await runMigrations(pool, { log: () => {} });
  const after = await fingerprint(pool, before);
  const saved = (await pool.query('SELECT count(*)::int n FROM savings_events')).rows[0].n;
  const goals = (await pool.query('SELECT count(*)::int n FROM rewards WHERE is_bigger_goal')).rows[0].n;
  const allow = { allowMigrations: ['016_savings_ledger.sql'] };
  const strayAdded = addedSchema(before, after).filter((o) => !/savings_events|public\.rewards\.(is_bigger_goal|goal_epoch|goal_child_epochs|rewards_goal_generation)/.test(o));
  step('apply 016', [...differences(before, after, allow), ...strayAdded.map((o) => `unexpected new schema object: ${o}`)],
    { added: after.added, savings_rows: saved, goals_designated: goals });
  if (saved || goals) step('016 created savings or goals', [`savings rows ${saved}, goals ${goals}`]);

  // Rollback and its record removal succeed or fail together.
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(DOWN);
    await c.query("DELETE FROM schema_migrations WHERE name = '016_savings_ledger.sql'");
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  const rolled = await fingerprint(pool, before);
  const leftover = addedSchema(before, rolled);
  step('roll 016 back', [...differences(before, rolled), ...leftover.map((o) => `left behind: ${o}`)]);

  await runMigrations(pool, { log: () => {} });
  const again = await fingerprint(pool, before);
  const present = (await pool.query("SELECT to_regclass('public.savings_events') IS NOT NULL AS t, (SELECT count(*) FROM information_schema.columns WHERE table_name = 'rewards' AND column_name IN ('is_bigger_goal', 'goal_epoch', 'goal_child_epochs')) = 3 AS c")).rows[0];
  step('apply 016 again', [...differences(before, again, allow), ...(present.t && present.c ? [] : ['016 objects missing after re-apply'])]);
} catch (err) {
  report.error = err.message;
  console.error('ERROR', err.message);
} finally {
  await pool.end();
}
fs.writeFileSync(path.join(process.cwd(), 'd1-reconcile-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ families: report.families, children: report.children, legacy_family_goals: report.legacy_family_goals, history_drift_before: report.history_drift_before }, null, 2));
const failed = report.error || report.steps.some((s) => s.changed.length);
process.exit(failed ? 1 : 0);
