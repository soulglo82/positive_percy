-- Reverses migration 016 exactly: drops only what 016 added. No existing row
-- changes. Savings moves made after 016 are lost; no points are lost, because
-- savings never changed any child's total_points (design §8, §10 N11).
-- Run the server code that predates 016 first. To apply in production, copy
-- this into the next free forward migration number. It leaves the
-- schema_migrations record of 016 in place, so 016 does not run again.
DROP TABLE IF EXISTS savings_events;
ALTER TABLE rewards DROP COLUMN IF EXISTS is_bigger_goal;
