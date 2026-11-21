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
import { fingerprint, differences, addedSchema, legacyFamilyGoals, PREREQ_SCHEMA, SAVINGS_SCHEMA } from '../server/reconcile.js';

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
// 016 and 017 (the savings ledger and its ended-savings record, design §20)
// are proved together: applied, rolled back (017 first) and applied again.
const SAVINGS = ['016_savings_ledger.sql', '017_savings_ended_by.sql'];
const V1_MIGRATIONS = ['014_todays_goals.sql', '015_reward_icon_key.sql', ...SAVINGS];
const DOWN = ['017_savings_ended_by_down.sql', '016_savings_ledger_down.sql']
  .map((f) => fs.readFileSync(path.join(ROOT, 'server/rollbacks', f), 'utf8'));
const report = { steps: [] };
const step = (name, diffs, extra = {}) => { report.steps.push({ name, changed: diffs, ...extra }); console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${name}${diffs.length ? '\n  ' + diffs.join('\n  ') : ''}`); };

try {
  const marker = await pool.query('SELECT token, restored_from, restored_at FROM percy_restore_marker').catch(() => ({ rows: [] }));
  if (!marker.rows.some((r) => r.token === token)) throw new Error('No matching percy_restore_marker token in this database: it is not a marked restored copy. Refusing.');
  report.restored_from = marker.rows.find((r) => r.token === token).restored_from;
  const applied = (await pool.query('SELECT name FROM schema_migrations WHERE name = ANY($1)', [SAVINGS]).catch(() => ({ rows: [] }))).rows.map((r) => r.name);
  if (applied.length) throw new Error(`This copy already has migration ${applied.map((n) => n.slice(0, 3)).join(' and ')}. Restore a copy taken before 016.`);
  // The copy must be at a point on production's line before 016: every
  // applied record has a file on this branch (no 013 from another branch),
  // and what is pending is exactly a tail of the V1 migrations, always
  // including 016 and 017 (proved together). Anything else is refused, so the run
  // proves exactly these and nothing else (code review of 8fa4d35).
  const files = fs.readdirSync(path.join(ROOT, 'server/migrations')).filter((f) => /^\d{3}_.+\.(sql|js)$/.test(f)).sort();
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const unknown = [...done].filter((n) => !files.includes(n));
  if (unknown.length) throw new Error(`This copy has migrations this branch does not know: ${unknown.join(', ')}. Refusing.`);
  const pending = files.filter((f) => !done.has(f));
  if (!pending.length || pending.join() !== V1_MIGRATIONS.slice(-pending.length).join()) {
    throw new Error(`Expected a tail of the V1 migrations (${V1_MIGRATIONS.join(', ')}) pending; found: ${pending.join(', ') || 'none'}`);
  }
  report.pending = pending;
  const original = await fingerprint(pool);
  report.families = (await pool.query('SELECT count(*)::int n FROM families')).rows[0].n;
  report.children = Object.keys(original.children).length;
  report.history_drift_before = Object.values(original.children).filter((c) => c.history !== c.total_points).length;

  // The V1 prerequisites first (each in its own transaction, recorded),
  // proved to change nothing families have.
  const prereq = pending.filter((f) => !SAVINGS.includes(f)); // never 017 before 016 (§20.8 B2)
  if (prereq.length) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'percy-v1-prereq-'));
    try {
      for (const f of prereq) fs.copyFileSync(path.join(ROOT, 'server/migrations', f), path.join(tmp, f));
      await runMigrations(pool, { dir: tmp, log: () => {} });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
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
  const allow = { allowMigrations: SAVINGS };
  const strayAdded = addedSchema(before, after).filter((o) => !SAVINGS_SCHEMA.test(o));
  step('apply 016 and 017', [...differences(before, after, allow), ...strayAdded.map((o) => `unexpected new schema object: ${o}`)],
    { added: after.added, savings_rows: saved, goals_designated: goals });
  if (saved || goals) step('016 and 017 created savings or goals', [`savings rows ${saved}, goals ${goals}`]);

  // Rollback and its record removal succeed or fail together.
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const sql of DOWN) await c.query(sql); // 017, then 016
    await c.query('DELETE FROM schema_migrations WHERE name = ANY($1)', [SAVINGS]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  const rolled = await fingerprint(pool, before);
  const leftover = addedSchema(before, rolled);
  step('roll 017 and 016 back', [...differences(before, rolled), ...leftover.map((o) => `left behind: ${o}`)]);

  await runMigrations(pool, { log: () => {} });
  const again = await fingerprint(pool, before);
  const present = (await pool.query("SELECT to_regclass('public.savings_events') IS NOT NULL AS t, (SELECT count(*) FROM information_schema.columns WHERE table_name = 'rewards' AND column_name IN ('is_bigger_goal', 'goal_epoch', 'goal_child_epochs')) = 3 AS c, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'savings_events' AND column_name = 'ended_by') AS e")).rows[0];
  step('apply 016 and 017 again', [...differences(before, again, allow), ...(present.t && present.c && present.e ? [] : ['016 or 017 objects missing after re-apply'])]);
} catch (err) {
  report.error = err.message;
  console.error('ERROR', err.message);
  // A failed run can leave the copy part-way (a prerequisite applied, 016
  // rolled back or not). Do not rerun on it: restore a fresh copy.
  console.error('Restore a fresh copy before running again.');
} finally {
  await pool.end();
}
fs.writeFileSync(path.join(process.cwd(), 'd1-reconcile-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ families: report.families, children: report.children, legacy_family_goals: report.legacy_family_goals, history_drift_before: report.history_drift_before }, null, 2));
const failed = report.error || report.steps.some((s) => s.changed.length);
process.exit(failed ? 1 : 0);
