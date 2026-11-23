-- write-freeze-off.sql
--
-- WHAT IT DOES
--   Turns the write freeze OFF (docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md §3):
--   drops the triggers percy_write_freeze and percy_write_freeze_truncate from
--   every table that has them, then the function percy_write_freeze().
--   It changes no row and no other object.
--
-- WHO RUNS IT
--   The owner only, and only as step 6 of a rollback (design §4): after the
--   fixed V1 is serving and savings-check.sql has said PASS. The freeze is
--   never lifted while the old app (498e798) is serving.
--
-- SAFE TO RUN TWICE
--   Yes. Run when not frozen it does nothing and gives no error.
--   It is one transaction: if it stops with "canceling statement due to lock
--   timeout", nothing was changed (still frozen): run it again.
--
-- HOW TO CHECK THE RESULT
--   The last result is one row: tables_still_frozen must be 0 and
--   function_present must be false.
--   Then run write-freeze-status.sql: its last row must say NOT FROZEN.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $percy$
DECLARE
  t RECORD;
  n INTEGER := 0;
BEGIN
  FOR t IN
    SELECT DISTINCT s.nspname, c.relname
    FROM pg_catalog.pg_trigger g
    JOIN pg_catalog.pg_class c ON c.oid = g.tgrelid
    JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
    WHERE NOT g.tgisinternal
      AND g.tgname IN ('percy_write_freeze', 'percy_write_freeze_truncate')
    ORDER BY s.nspname, c.relname
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS percy_write_freeze ON %I.%I', t.nspname, t.relname);
    EXECUTE format('DROP TRIGGER IF EXISTS percy_write_freeze_truncate ON %I.%I', t.nspname, t.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'write freeze OFF: triggers dropped from % table(s)', n;
END
$percy$;

DROP FUNCTION IF EXISTS public.percy_write_freeze();

COMMIT;

-- The result row, read back from the catalog after the commit.
SELECT
  (SELECT count(DISTINCT g.tgrelid)::int FROM pg_catalog.pg_trigger g
    WHERE NOT g.tgisinternal
      AND g.tgname IN ('percy_write_freeze', 'percy_write_freeze_truncate')) AS tables_still_frozen,
  EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace s ON s.oid = p.pronamespace
          WHERE s.nspname = 'public' AND p.proname = 'percy_write_freeze') AS function_present;
