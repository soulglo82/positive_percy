-- write-freeze-on.sql
--
-- WHAT IT DOES
--   Turns the write freeze ON (docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md §3).
--   While it is on, no row in any application table can be inserted, changed,
--   deleted or truncated, by either app version or by hand. Reads work and the
--   app starts. It covers every ordinary table in schema "public" except
--   schema_migrations, found from the catalog, not from a list.
--
-- WHO RUNS IT
--   The owner only, and only during a rollback (design §4, step 1). Paste the
--   whole file into the database console for the Postgres service, or run it
--   with psql. Nothing here is run by the app or by CI.
--
-- SAFE TO RUN TWICE
--   Yes. Each trigger is dropped if it exists and created again (which also
--   re-enables a trigger someone disabled, and covers a table added since).
--   It is one transaction: it either freezes every table or changes nothing.
--   If it stops with "canceling statement due to lock timeout" a change was in
--   flight: nothing was changed, run it again.
--
-- HOW TO CHECK THE RESULT
--   The last result is one row:
--     tables_frozen = tables_total            (every table is frozen)
--     families_without_user_row               (families that would be signed
--                                              out under the freeze: signing in
--                                              creates that row on first use)
--   Then run write-freeze-status.sql: its last row must say FROZEN.
--
-- HOW TO UNDO IT
--   write-freeze-off.sql.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Error code 25006 (read_only_sql_transaction): not a unique-violation or a
-- deadlock code, which the apps retry on.
CREATE OR REPLACE FUNCTION public.percy_write_freeze() RETURNS trigger AS $percy$
BEGIN
  RAISE EXCEPTION 'Positive Percy is paused for maintenance: no changes are being saved'
    USING ERRCODE = '25006';
END
$percy$ LANGUAGE plpgsql;

DO $percy$
DECLARE
  t RECORD;
  n INTEGER := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> 'schema_migrations'
    ORDER BY c.relname
  LOOP
    -- Row-level, so a statement that touches no row still succeeds (both apps
    -- run one at start-up).
    EXECUTE format('DROP TRIGGER IF EXISTS percy_write_freeze ON public.%I', t.relname);
    EXECUTE format(
      'CREATE TRIGGER percy_write_freeze BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.percy_write_freeze()', t.relname);
    EXECUTE format('DROP TRIGGER IF EXISTS percy_write_freeze_truncate ON public.%I', t.relname);
    EXECUTE format(
      'CREATE TRIGGER percy_write_freeze_truncate BEFORE TRUNCATE ON public.%I '
      || 'FOR EACH STATEMENT EXECUTE FUNCTION public.percy_write_freeze()', t.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'write freeze ON: % table(s) frozen', n;
END
$percy$;

COMMIT;

-- The result row, read back from the catalog after the commit (so it shows
-- what is really there, also if the transaction above was rolled back).
SELECT
  count(*) FILTER (WHERE row_on AND truncate_on)::int AS tables_frozen,
  count(*)::int AS tables_total,
  (SELECT count(*)::int FROM public.families f
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.family_code = f.family_code)
  ) AS families_without_user_row
FROM (
  SELECT
    EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g
            WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
              AND g.tgname = 'percy_write_freeze' AND g.tgtype = 31 AND g.tgenabled IN ('O', 'A')
            AND g.tgfoid = to_regproc('public.percy_write_freeze')) AS row_on,
    EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g
            WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
              AND g.tgname = 'percy_write_freeze_truncate' AND g.tgtype = 34 AND g.tgenabled IN ('O', 'A')
            AND g.tgfoid = to_regproc('public.percy_write_freeze')) AS truncate_on
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
) x;
