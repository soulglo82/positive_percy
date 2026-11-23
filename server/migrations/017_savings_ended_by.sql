-- D1 savings: a durable, attributable record when a goal's savings end
-- (owner review of #64, N2; docs/engineering/D1-SAVINGS-LEDGER-DESIGN.md §20).
-- ADDITIVE ONLY: one nullable column and two checks; no row is read into,
-- changed or deleted. A 'reward_removed' row records, for one child, that
-- un-marking, reassigning or deleting a goal ended what was saved towards it
-- (child, goal, amount and cause). No such row has ever been written.
-- Reversal: server/rollbacks/017_savings_ended_by_down.sql.

ALTER TABLE savings_events ADD COLUMN IF NOT EXISTS ended_by TEXT NULL;

ALTER TABLE savings_events DROP CONSTRAINT IF EXISTS savings_events_ended_by_check;
ALTER TABLE savings_events ADD CONSTRAINT savings_events_ended_by_check
  CHECK (ended_by IS NULL OR ended_by IN ('unmarked', 'reassigned', 'deleted'));

-- A cause on, and only on, an ended-savings row.
ALTER TABLE savings_events DROP CONSTRAINT IF EXISTS savings_events_ended_shape;
ALTER TABLE savings_events ADD CONSTRAINT savings_events_ended_shape
  CHECK ((kind = 'reward_removed') = (ended_by IS NOT NULL));

-- Post-check: nothing was written or changed.
DO $$
BEGIN
  IF (SELECT count(*) FROM savings_events WHERE ended_by IS NOT NULL OR kind = 'reward_removed') > 0 THEN
    RAISE EXCEPTION 'migration 017 must not create ended-savings rows';
  END IF;
END $$;
