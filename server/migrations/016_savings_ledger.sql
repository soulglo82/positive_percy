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

-- Allocation generations (owner review 2026-11-19, O6): savings never come
-- back to life. A goal's generation for a child is "goal_epoch:child_epoch".
-- The trigger below moves it forward whenever the goal is marked or
-- un-marked (goal_epoch) or the reward stops being for a child (that child's
-- epoch). Savings rows carry the generation they were made in, and only rows
-- of the current generation count. Old rows stay as history.
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS goal_epoch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS goal_child_epochs JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION rewards_goal_generation() RETURNS trigger AS $$
DECLARE
  kid RECORD;
  epochs JSONB := COALESCE(OLD.goal_child_epochs, '{}'::jsonb);
BEGIN
  -- Generations only ever move forward, and only here: whatever an UPDATE
  -- writes to these columns is replaced.
  NEW.goal_epoch := OLD.goal_epoch + CASE WHEN NEW.is_bigger_goal IS DISTINCT FROM OLD.is_bigger_goal THEN 1 ELSE 0 END;
  IF NEW.assigned_child_ids IS DISTINCT FROM OLD.assigned_child_ids THEN
    FOR kid IN SELECT id FROM children WHERE family_code IS NOT DISTINCT FROM NEW.family_code LOOP
      IF (COALESCE(cardinality(OLD.assigned_child_ids), 0) = 0 OR kid.id::text = ANY (OLD.assigned_child_ids))
         AND NOT (COALESCE(cardinality(NEW.assigned_child_ids), 0) = 0 OR kid.id::text = ANY (NEW.assigned_child_ids)) THEN
        epochs := jsonb_set(epochs, ARRAY[kid.id::text], to_jsonb(COALESCE((epochs->>kid.id::text)::int, 0) + 1));
      END IF;
    END LOOP;
  END IF;
  NEW.goal_child_epochs := epochs;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rewards_goal_generation ON rewards;
CREATE TRIGGER rewards_goal_generation BEFORE UPDATE ON rewards
  FOR EACH ROW EXECUTE FUNCTION rewards_goal_generation();

CREATE TABLE IF NOT EXISTS savings_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  child_id      UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id     UUID NOT NULL,          -- no FK: history outlives a deleted reward; family scope is enforced in code
  reward_title  TEXT NOT NULL,          -- as it was, for history
  generation    TEXT NOT NULL,          -- the goal's generation for this child when written (O6)
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
CREATE INDEX IF NOT EXISTS savings_events_child ON savings_events (family_code, child_id) INCLUDE (reward_id, generation, delta);

-- Post-check: this migration created no savings and designated no goals.
DO $$
BEGIN
  IF (SELECT count(*) FROM savings_events) > 0 THEN RAISE EXCEPTION 'migration 016 must not create savings'; END IF;
  IF (SELECT count(*) FROM rewards WHERE is_bigger_goal) > 0 THEN RAISE EXCEPTION 'migration 016 must not designate goals'; END IF;
  IF (SELECT count(*) FROM rewards WHERE goal_epoch <> 0 OR goal_child_epochs <> '{}'::jsonb) > 0 THEN RAISE EXCEPTION 'migration 016 must start every generation at 0'; END IF;
END $$;
