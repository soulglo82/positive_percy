#!/usr/bin/env node
// D1 data-preservation run against a RESTORED COPY of real family data
// (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §11). Never point this at
// production: it applies migration 016 and then rolls it back.
//
//   node scripts/d1-reconcile.mjs --database-url postgres://...copy... --i-confirm-this-is-a-copy
//
// Steps: fingerprint -> apply pending migrations (016) -> compare -> roll
// 016 back -> compare -> apply 016 again -> compare. Prints a report and
// exits 1 if anything families had changed at any step.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runMigrations } from '../server/migrate.js';
import { fingerprint, differences, legacyFamilyGoals } from '../server/reconcile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const url = arg('--database-url');
if (!url || !process.argv.includes('--i-confirm-this-is-a-copy')) {
  console.error('Usage: node scripts/d1-reconcile.mjs --database-url <URL of a restored copy> --i-confirm-this-is-a-copy');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url });
const DOWN = fs.readFileSync(path.join(ROOT, 'server/rollbacks/016_savings_ledger_down.sql'), 'utf8');
const report = { steps: [] };
const step = (name, diffs, extra = {}) => { report.steps.push({ name, changed: diffs, ...extra }); console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${name}${diffs.length ? '\n  ' + diffs.join('\n  ') : ''}`); };

try {
  const applied = (await pool.query("SELECT name FROM schema_migrations WHERE name = '016_savings_ledger.sql'").catch(() => ({ rows: [] }))).rows.length > 0;
  if (applied) throw new Error('This copy already has migration 016. Restore a copy taken before 016.');
  const before = await fingerprint(pool);
  report.families = (await pool.query('SELECT count(*)::int n FROM families')).rows[0].n;
  report.children = Object.keys(before.children).length;
  report.legacy_family_goals = await legacyFamilyGoals(pool);
  report.history_drift_before = Object.values(before.children).filter((c) => c.history !== c.total_points).length;

  await runMigrations(pool, { log: () => {} });
  const after = await fingerprint(pool, before);
  const saved = (await pool.query('SELECT count(*)::int n FROM savings_events')).rows[0].n;
  const goals = (await pool.query('SELECT count(*)::int n FROM rewards WHERE is_bigger_goal')).rows[0].n;
  step('apply 016', differences(before, after), { added: after.added, savings_rows: saved, goals_designated: goals });
  if (saved || goals) step('016 created savings or goals', [`savings rows ${saved}, goals ${goals}`]);

  await pool.query(DOWN);
  await pool.query("DELETE FROM schema_migrations WHERE name = '016_savings_ledger.sql'");
  step('roll 016 back', differences(before, await fingerprint(pool, before)));

  await runMigrations(pool, { log: () => {} });
  step('apply 016 again', differences(before, await fingerprint(pool, before)));
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
