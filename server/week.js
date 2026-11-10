// The family's week and day (A2 C1, W1, R2). "This week" is never stored:
// it is the sum of effective (earned) history since Monday 00:00 in the
// family's own timezone. Dates are worked out in Postgres as text with
// to_char, never via a JS Date or a DateStyle-dependent cast.

// SQL for the start of the current week in the timezone expression `tz`.
export const weekStartSql = (tz) => `(date_trunc('week', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;
const FAMILY_TZ = `COALESCE((SELECT timezone FROM families WHERE family_code = $1), 'UTC')`;

// Map child id -> points earned this week, floored at 0.
export async function weekPointsFor(db, familyCode, childIds) {
  const out = new Map(childIds.map((id) => [id, 0]));
  if (childIds.length === 0) return out;
  const { rows } = await db.query(
    `SELECT child_id, GREATEST(0, SUM(points))::int AS week_points
     FROM effective_point_events
     WHERE family_code = $1 AND child_id = ANY($2::uuid[])
       AND created_date >= ${weekStartSql(FAMILY_TZ)}
     GROUP BY child_id`,
    [familyCode, childIds]
  );
  for (const r of rows) out.set(r.child_id, r.week_points);
  return out;
}

// Adds week_points to child rows (one query for the whole list).
export async function withWeekPoints(db, familyCode, rows) {
  if (!rows || rows.length === 0) return rows;
  const map = await weekPointsFor(db, familyCode, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, week_points: map.get(r.id) ?? 0 }));
}

// Today and yesterday as 'YYYY-MM-DD' in a timezone, at the given instant.
export async function localDays(db, timezone, at = new Date()) {
  const { rows } = await db.query(
    `SELECT to_char(($1::timestamptz AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS today,
            to_char(($1::timestamptz AT TIME ZONE $2)::date - 1, 'YYYY-MM-DD') AS yesterday`,
    [at.toISOString(), timezone || 'UTC']
  );
  return rows[0];
}

// A timezone is accepted only if both Postgres and the JS runtime know it.
// Anything else is treated as not set (NULL), never as an error.
export async function validTimezone(db, name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 64) return null;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: name }); } catch { return null; }
  const { rowCount } = await db.query('SELECT 1 FROM pg_timezone_names WHERE name = $1', [name]);
  return rowCount > 0 ? name : null;
}

// Browsers in privacy modes report UTC; never auto-set from these.
export const isGenericZone = (name) => /^(UTC|Etc\/.*|GMT|Universal|Zulu)$/i.test(name || '');

// last_active_date is the family's local date of its latest earned award.
// Rerun whenever the timezone changes (same rule as migration 004).
export async function recomputeLastActive(db, familyCode) {
  await db.query(
    `UPDATE families f
     SET last_active_date = to_char(a.latest AT TIME ZONE COALESCE(f.timezone, 'UTC'), 'YYYY-MM-DD')
     FROM (SELECT max(created_date) AS latest FROM effective_point_events
           WHERE family_code = $1 AND points > 0) a
     WHERE f.family_code = $1 AND a.latest IS NOT NULL`,
    [familyCode]
  );
}
