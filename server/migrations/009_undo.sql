-- A2 PR2 U1, U2: undo an award or a spend within 10 minutes.

-- An undo row points at the award it reverses. One undo per award: a second
-- one, whatever its request id, hits this index.
ALTER TABLE point_events ADD COLUMN IF NOT EXISTS reverses_id UUID REFERENCES point_events(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS point_events_reverses_once
  ON point_events (reverses_id) WHERE reverses_id IS NOT NULL;

-- A spend that was undone keeps its row, marked 'Reversed', with the time.
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- Earned points (C7): awards only, and not ones that were undone.
CREATE OR REPLACE VIEW effective_point_events AS
SELECT * FROM point_events p
WHERE p.kind = 'award'
  AND lower(trim(p.category)) NOT IN ('starting points', 'balance correction', 'undo')
  AND NOT EXISTS (SELECT 1 FROM point_events u WHERE u.reverses_id = p.id);

-- Starting-points rows an older server wrote during the A2 deploy carry the
-- default kind. Same rule as 002, run again once.
UPDATE point_events SET kind = 'starting'
WHERE lower(trim(category)) = 'starting points' AND request_id IS NULL AND kind = 'award';
