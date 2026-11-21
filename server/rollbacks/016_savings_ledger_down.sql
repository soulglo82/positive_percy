-- Reverses migration 016 exactly: drops only what 016 added. No existing row
-- changes. Savings moves made after 016 are lost; no points are lost, because
-- savings never changed any child's total_points (design §8, §10 N11).
-- Run the server code that predates 016 first. To apply in production, copy
-- this into the next free forward migration number. It leaves the
-- schema_migrations record of 016 in place, so 016 does not run again.
-- SCRATCH / PRE-LAUNCH ONLY (owner review 2026-11-19): this destroys the
-- savings ledger, so it refuses to run once any savings exist. Reversing D1
-- after launch needs a separately approved archived or compensated reversal
-- with audit evidence (design §13), never this file.
DO $$
BEGIN
  IF to_regclass('public.savings_events') IS NOT NULL AND (SELECT count(*) FROM savings_events) > 0 THEN
    RAISE EXCEPTION 'savings exist: this rollback would destroy them. Use the approved archived reversal instead.';
  END IF;
END $$;
DROP TRIGGER IF EXISTS rewards_goal_generation_insert ON rewards;
DROP FUNCTION IF EXISTS rewards_goal_generation_insert();
DROP TRIGGER IF EXISTS rewards_goal_generation ON rewards;
DROP FUNCTION IF EXISTS rewards_goal_generation();
DROP TABLE IF EXISTS savings_events;
ALTER TABLE rewards DROP COLUMN IF EXISTS goal_child_epochs;
ALTER TABLE rewards DROP COLUMN IF EXISTS goal_epoch;
ALTER TABLE rewards DROP COLUMN IF EXISTS is_bigger_goal;
