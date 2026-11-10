// Photo ownership and clean-up (P-1). One rule for what counts as "our upload
// URL", one list of the columns that may hold one, used by the boot backfill,
// the write guard and the delete. Design: claude/p1-photo-cleanup-design.md.

// Optional origin, then /api/uploads/<uuid>, nothing after. Case-insensitive.
// The same source string is passed to Postgres as an ARE with flag 'i'.
export const UPLOAD_URL_PATTERN =
  '^(?:https?://[^/]+)?/api/uploads/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$';
const UPLOAD_URL_RE = new RegExp(UPLOAD_URL_PATTERN, 'i');

// Every column that can point at an upload. Adding one here covers the
// backfill, the write guard and the reference count together.
export const UPLOAD_REF_COLUMNS = { children: 'avatar_url', rewards: 'image_url' };

export function uploadIdOf(value) {
  if (typeof value !== 'string') return null;
  const m = UPLOAD_URL_RE.exec(value);
  return m ? m[1].toLowerCase() : null;
}

// SQL for "this upload id is still referenced by any row, in any family".
function referencedSql(idParam, patternParam) {
  return Object.entries(UPLOAD_REF_COLUMNS)
    .map(([table, col]) =>
      `EXISTS (SELECT 1 FROM ${table} WHERE lower((regexp_match(${col}, ${patternParam}, 'i'))[1]) = ${idParam}::text)`)
    .join(' OR ');
}

// A write may point a row at an upload only if the upload belongs to the
// caller's family. A value that is unchanged from the stored row always
// passes, so editing a name never fails because of an older photo.
export async function uploadsAreOwned(db, data, familyCode, stored = null) {
  for (const col of Object.values(UPLOAD_REF_COLUMNS)) {
    if (!(col in data)) continue;
    const id = uploadIdOf(data[col]);
    if (!id) continue;
    if (stored && uploadIdOf(stored[col]) === id) continue;
    const { rowCount } = await db.query(
      'SELECT 1 FROM uploads WHERE id = $1::uuid AND family_code = $2',
      [id, familyCode]
    );
    if (rowCount === 0) return false;
  }
  return true;
}

// Delete an upload once nothing references it. Runs on the caller's
// transaction client after the row change, so a rollback keeps the photo.
// Only the caller's own uploads can go; a NULL-owner upload never does.
export async function releaseUpload(db, uploadId, familyCode) {
  if (!uploadId) return false;
  const { rowCount } = await db.query(
    `DELETE FROM uploads WHERE id = $1::uuid AND family_code = $2 AND NOT (${referencedSql('$1', '$3')})`,
    [uploadId, familyCode, UPLOAD_URL_PATTERN]
  );
  return rowCount > 0;
}

// Boot: add the owner column and stamp it on legacy uploads that exactly one
// family references. Only NULL rows are touched, so it is safe on every boot.
// Not swallowed: a failure here stops startup.
export async function backfillUploadOwners(client) {
  await client.query('ALTER TABLE uploads ADD COLUMN IF NOT EXISTS family_code TEXT');
  const refs = Object.entries(UPLOAD_REF_COLUMNS)
    .map(([table, col]) =>
      `SELECT lower((regexp_match(${col}, $1, 'i'))[1]) AS uid, family_code FROM ${table} WHERE ${col} ~* $1`)
    .join(' UNION ALL ');
  const { rowCount } = await client.query(
    `WITH refs AS (${refs}),
     owners AS (
       SELECT uid, min(family_code) AS fc FROM refs GROUP BY uid
       HAVING count(DISTINCT family_code) = 1 AND bool_and(family_code IS NOT NULL)
     )
     UPDATE uploads u SET family_code = o.fc FROM owners o
     WHERE u.id::text = o.uid AND u.family_code IS NULL`,
    [UPLOAD_URL_PATTERN]
  );
  // Uploads shared across families (or with a family-less row) stay unowned
  // and are never deleted. Logged for review; counts only, no ids.
  const { rows } = await client.query(
    `WITH refs AS (${refs})
     SELECT count(*)::int AS n FROM (
       SELECT uid FROM refs GROUP BY uid
       HAVING count(DISTINCT family_code) > 1 OR bool_or(family_code IS NULL)
     ) s`,
    [UPLOAD_URL_PATTERN]
  );
  if (rowCount > 0 || rows[0].n > 0) {
    console.log(`Upload owners: ${rowCount} stamped, ${rows[0].n} shared or family-less left unowned`);
  }
}
