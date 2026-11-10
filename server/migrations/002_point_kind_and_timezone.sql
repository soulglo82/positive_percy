-- A2 W1, W2: what each history row is, and each family's timezone.

-- kind: 'award' (earned or deducted by a parent), 'starting' (points a child
-- was created with), 'correction' (aligns history to the balance), 'undo'
-- (reverses an award; PR2). Defaults to 'award' so an older server still
-- running during a deploy writes valid rows.
ALTER TABLE point_events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'award';
ALTER TABLE point_events DROP CONSTRAINT IF EXISTS point_events_kind_check;
ALTER TABLE point_events ADD CONSTRAINT point_events_kind_check
  CHECK (kind IN ('award', 'starting', 'correction', 'undo'));

-- Starting points were written by createChild, which never set request_id;
-- every award since Batch A does. Case-insensitive, matching the checks run
-- against production.
UPDATE point_events SET kind = 'starting'
WHERE lower(trim(category)) = 'starting points' AND request_id IS NULL AND kind = 'award';

-- Earned points, for every total: awards only. Reserved category names are
-- excluded too, so a row an older server wrote during the deploy (kind left
-- at the default) still counts correctly. Category names are reserved from
-- this release (W5).
CREATE OR REPLACE VIEW effective_point_events AS
SELECT * FROM point_events
WHERE kind = 'award'
  AND lower(trim(category)) NOT IN ('starting points', 'balance correction', 'undo');

-- NULL means "not set yet". Readers use COALESCE(timezone, 'UTC').
ALTER TABLE families ADD COLUMN IF NOT EXISTS timezone TEXT;
-- Every existing family is in Singapore (Nael and Singapore test families,
-- production check 2026-11-10). New families take the browser's zone.
UPDATE families SET timezone = 'Asia/Singapore' WHERE timezone IS NULL;
