-- A2 R1: last_active_date was a UTC date. Recompute it as the family's local
-- date of its latest earned award, so the first award after this release
-- neither resets nor double-counts a streak. current_streak is unchanged.
-- Families with no earned award keep what they have.
UPDATE families f
SET last_active_date = to_char(a.latest AT TIME ZONE COALESCE(f.timezone, 'UTC'), 'YYYY-MM-DD')
FROM (
  SELECT family_code, max(created_date) AS latest
  FROM effective_point_events WHERE points > 0
  GROUP BY family_code
) a
WHERE a.family_code = f.family_code;
