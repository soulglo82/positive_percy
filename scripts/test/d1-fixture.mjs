// Builds a SYNTHETIC copy for scripts/test/d1-restore-reconcile.test.sh: the
// base schema plus migrations 001..N, and fixture family data. No real data.
//   DATABASE_URL=... node scripts/test/d1-fixture.mjs <N>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const upTo = Number(process.argv[2]);
if (!Number.isInteger(upTo)) { console.error('usage: d1-fixture.mjs <highest migration number>'); process.exit(2); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { initDb, default: pool } = await import(path.join(ROOT, 'server/db.js'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'percy-fixture-'));
const src = path.join(ROOT, 'server/migrations');
for (const f of fs.readdirSync(src)) if (Number(f.slice(0, 3)) <= upTo) fs.copyFileSync(path.join(src, f), path.join(dir, f));
await initDb({ migrationOptions: { dir, log: () => {} } });
const q = (sql, p) => pool.query(sql, p);
await q("INSERT INTO families (family_code, family_name) VALUES ('FIX001', 'The Fixture Family')");
const { rows: [kid] } = await q("INSERT INTO children (name, family_code, total_points, weekly_target) VALUES ('Sam', 'FIX001', 30, 25) RETURNING id");
await q("INSERT INTO point_events (child_id, child_name, points, category, family_code, kind) VALUES ($1, 'Sam', 35, 'Kindness', 'FIX001', 'award')", [kid.id]);
const { rows: [rw] } = await q("INSERT INTO rewards (title, cost_points, family_code, emoji, assigned_child_ids) VALUES ('Park trip', 5, 'FIX001', '🌳', ARRAY[$1::text]) RETURNING id", [kid.id]);
await q("INSERT INTO redemptions (child_id, child_name, reward_id, reward_title, reward_cost, status, family_code) VALUES ($1, 'Sam', $2, 'Park trip', 5, 'Completed', 'FIX001')", [kid.id, rw.id]);
await pool.end();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`fixture at ${String(upTo).padStart(3, '0')}`);
