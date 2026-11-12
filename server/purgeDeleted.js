// Permanent family deletion, deliberately not scheduled or enabled by default.
// A 7-day pending state is reversible. The destructive sweep must be enabled
// only after a documented isolated restore drill, verified R2 retention,
// privacy policy approval and an independently reviewed runbook.
//
// Run with: npm run maintenance:purge-families
// Dry-run is the default, even if the script is accidentally launched.
// The destructive mode additionally requires two operator controls.
import pool from './db.js';
import { uploadIdOf } from './uploads.js';

const MAX_PER_SWEEP = 25;

export function purgeIsEnabled(env = process.env) {
  return env.PERCY_FAMILY_PURGE_ENABLED === 'true' &&
    env.PERCY_RESTORE_DRILL_VERIFIED === 'true';
}

export async function purgeExpiredFamilies(db, { execute = false, limit = MAX_PER_SWEEP } = {}) {
  const cap = Math.max(0, Math.min(MAX_PER_SWEEP, Number(limit) || 0));
  const stats = { eligible: 0, purged: 0, children: 0, photos: 0 };
  const client = await db.connect();
  try {
    for (let i = 0; i < cap; i++) {
      await client.query('BEGIN');
      try {
        // Locks only one due family. A recovery under another connection cannot
        // race this operation. A second sweeper skips locked families.
        const { rows } = await client.query(`
          SELECT family_code
          FROM families
          WHERE deletion_due_at IS NOT NULL AND deletion_due_at <= NOW()
          ORDER BY deletion_due_at ASC
          LIMIT 1 FOR UPDATE SKIP LOCKED
        `);
        if (!rows.length) {
          await client.query('ROLLBACK');
          break;
        }
        const familyCode = rows[0].family_code;
        stats.eligible++;

        if (!execute) {
          await client.query('ROLLBACK');
          break;
        }

        const kids = await client.query(
          'SELECT id, avatar_url FROM children WHERE family_code = $1', [familyCode]
        );
        const rewards = await client.query(
          'SELECT image_url FROM rewards WHERE family_code = $1', [familyCode]
        );
        const legacyPhotoIds = [...new Set([
          ...kids.rows.map(c => uploadIdOf(c.avatar_url)),
          ...rewards.rows.map(r => uploadIdOf(r.image_url)),
        ].filter(Boolean))];
        stats.children += kids.rowCount;

        // Remove both modern family-owned history and older rows with a NULL
        // family_code, identified through their belonging child's ID.
        await client.query(`
          DELETE FROM point_events WHERE family_code = $1 OR
            child_id IN (SELECT id FROM children WHERE family_code = $1)
        `, [familyCode]);
        await client.query(`
          DELETE FROM redemptions WHERE family_code = $1 OR
            child_id IN (SELECT id FROM children WHERE family_code = $1)
        `, [familyCode]);

        for (const table of [
          'idempotency_keys', 'quick_actions', 'behavior_categories',
          'family_goals', 'rewards', 'users',
        ]) {
          // Table names are a fixed audited allowlist, never user input.
          await client.query('DELETE FROM ' + table + ' WHERE family_code = $1', [familyCode]);
        }
        await client.query('DELETE FROM children WHERE family_code = $1', [familyCode]);

        const deletedPhotos = await client.query(
          'DELETE FROM uploads WHERE family_code = $1', [familyCode]
        );
        let legacyPhotosDeleted = 0;
        if (legacyPhotoIds.length) {
          // Legacy uploads could have no family_code. Delete them only when
          // no OTHER family refers to them; never erase a shared/other image.
          const legacy = await client.query(`
            DELETE FROM uploads u
            WHERE u.family_code IS NULL AND u.id = ANY($2::uuid[])
              AND NOT EXISTS (
                SELECT 1 FROM children c
                WHERE c.family_code <> $1
                  AND c.avatar_url = '/api/uploads/' || u.id::text
              )
              AND NOT EXISTS (
                SELECT 1 FROM rewards r
                WHERE r.family_code <> $1
                  AND r.image_url = '/api/uploads/' || u.id::text
              )
          `, [familyCode, legacyPhotoIds]);
          legacyPhotosDeleted = legacy.rowCount;
        }
        stats.photos += deletedPhotos.rowCount + legacyPhotosDeleted;
        const deletion = await client.query(
          'DELETE FROM families WHERE family_code = $1 AND deletion_due_at <= NOW()', [familyCode]
        );
        if (deletion.rowCount !== 1) throw new Error('Family deletion lock invariant failed');
        await client.query('COMMIT');
        stats.purged++;

        // Log counts only. Never log the secret code or child identities.
        console.info('Family deletion purge completed', {
          children: kids.rowCount, photos: deletedPhotos.rowCount + legacyPhotosDeleted,
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }
    return stats;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('/purgeDeleted.js')) {
  if (!purgeIsEnabled()) {
    console.log('Permanent deletion disabled. Requires both purge and restore-drill gates.');
    process.exit(0);
  }
  purgeExpiredFamilies(pool, { execute: true }).then((result) => {
    console.log('Purge job finished', result);
    return pool.end();
  }).catch((err) => {
    console.error('Purge job failed', err);
    process.exitCode = 1;
    return pool.end();
  });
}
