-- D1 savings ledger (docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md v1.2; owner
-- approval in principle 2026-11-19, issue #56). ADDITIVE ONLY: no existing row
-- is read into, changed or deleted by this file. In particular:
--   * no child's total_points, points_spent or reward_stack changes;
--   * no reward becomes a bigger goal (is_bigger_goal starts false for all);
--   * no savings are created: savings_events starts empty. Existing points are
--     never treated as saved, and the legacy family_goals counters are NOT
--     child savings (they never moved any child's points; section 11).
-- Reversal: server/rollbacks/016_savings_ledger_down.sql (run as a new
-- forward migration if ever needed; migrate.js only goes forward).

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS is_bigger_goal BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS savings_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  child_id      UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id     UUID NOT NULL,          -- no FK: history outlives a deleted reward; family scope is enforced in code
  reward_title  TEXT NOT NULL,          -- as it was, for history
  delta         INTEGER NOT NULL CHECK (delta <> 0),
  kind          TEXT NOT NULL CHECK (kind IN ('save', 'release', 'spend', 'reward_removed', 'undo')),
  request_id    UUID NULL,              -- set for parent actions (save, release, their undo); NULL for derived rows
  redemption_id UUID NULL REFERENCES redemptions(id) ON DELETE SET NULL,
  undoes        UUID NULL REFERENCES savings_events(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT savings_events_undoes_once UNIQUE (undoes),
  CONSTRAINT savings_events_derived_shape CHECK (
    (kind IN ('save', 'release') AND request_id IS NOT NULL AND undoes IS NULL)
    OR (kind = 'undo' AND undoes IS NOT NULL)
    OR (kind IN ('spend', 'reward_removed') AND request_id IS NULL AND undoes IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS savings_events_request ON savings_events (family_code, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS savings_events_child ON savings_events (family_code, child_id) INCLUDE (reward_id, delta);

-- Post-check: this migration created no savings and designated no goals.
DO $$
BEGIN
  IF (SELECT count(*) FROM savings_events) > 0 THEN RAISE EXCEPTION 'migration 016 must not create savings'; END IF;
  IF (SELECT count(*) FROM rewards WHERE is_bigger_goal) > 0 THEN RAISE EXCEPTION 'migration 016 must not designate goals'; END IF;
END $$;
