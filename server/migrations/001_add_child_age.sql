-- Migration 001: persist a child's age captured on the Add Child form.
--
-- The live schema runner is server/db.js (idempotent CREATE TABLE / ALTER
-- TABLE ... ADD COLUMN IF NOT EXISTS on boot). This file mirrors that change
-- as an explicit up/down pair so it can be applied and reverted on a scratch
-- database:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/001_add_child_age.sql   # UP (default)
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE children DROP COLUMN IF EXISTS age"  # DOWN
--
-- age is nullable: existing rows keep NULL (age unknown), which is the sensible
-- default. weekly_target / total_points / weekly_points already exist and are
-- untouched here.

-- UP
ALTER TABLE children ADD COLUMN IF NOT EXISTS age INTEGER;

-- DOWN
-- ALTER TABLE children DROP COLUMN IF EXISTS age;
