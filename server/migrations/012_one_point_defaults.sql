-- Batch C: one-point defaults for newly created behaviours and quick awards.
-- Existing family choices and historical awards are deliberately untouched.
-- initDb creates the column with DEFAULT 1 in new databases, but this
-- migration also updates the stored default in existing databases.
ALTER TABLE behavior_categories ALTER COLUMN points SET DEFAULT 1;
ALTER TABLE quick_actions ALTER COLUMN points SET DEFAULT 1;
