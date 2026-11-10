// One-time data and schema changes (A2 M0). Each file in server/migrations
// runs once, in name order, in its own transaction, and is recorded in
// schema_migrations. A failure throws, so startup stops and the healthcheck
// never goes green. Boot itself never changes existing rows (C3).
//
// .sql files run as written. .js files export `default async (client) => {}`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK_KEY = 728_001; // pg_advisory_lock key reserved for migrations

export async function runMigrations(pool, { dir = DIR, log = console.log } = {}) {
  const client = await pool.connect();
  let broken = false;
  try {
    // Two instances booting together: one applies, the other waits, then
    // re-reads what is applied and finds nothing left to do.
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      const { rows } = await client.query('SELECT name FROM schema_migrations');
      const done = new Set(rows.map((r) => r.name));
      const files = fs.readdirSync(dir).filter((f) => /^\d{3}_.+\.(sql|js)$/.test(f)).sort();
      for (const file of files) {
        if (done.has(file)) continue;
        await client.query('BEGIN');
        try {
          if (file.endsWith('.sql')) {
            await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
          } else {
            const mod = await import(pathToFileURL(path.join(dir, file)).href);
            await mod.default(client, { log });
          }
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          log(`Migration applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          err.message = `Migration ${file} failed: ${err.message}`;
          throw err;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => { broken = true; });
    }
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    client.release(broken);
  }
}
