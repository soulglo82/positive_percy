-- write-freeze-status.sql
--
-- WHAT IT DOES
--   Reports whether the write freeze is on
--   (docs/engineering/V1-ROLLBACK-FREEZE-DESIGN.md §3). READ-ONLY: two SELECTs
--   on the catalog and one count; it changes nothing and takes no lock that
--   blocks the app.
--
-- WHO RUNS IT
--   The owner only. It may be run at any time (it is read-only): after
--   write-freeze-on.sql, after write-freeze-off.sql, and once before a release
--   to confirm the owner's access to the production database.
--
-- HOW TO CHECK THE RESULT
--   First result: one row per ordinary table in schema "public" except
--   schema_migrations:
--     row_trigger_on       the trigger percy_write_freeze (BEFORE INSERT OR
--                          UPDATE OR DELETE, FOR EACH ROW) is there AND enabled
--     truncate_trigger_on  the trigger percy_write_freeze_truncate (BEFORE
--                          TRUNCATE) is there AND enabled
--   A disabled trigger counts as not on.
--   Last result: one row, the verdict:
--     FROZEN         every table has both triggers, enabled
--     NOT FROZEN     no table has either trigger
--     PARTLY FROZEN  anything else (a mix, a table added after the freeze, or
--                    any disabled trigger). Treat it as an error: run
--                    write-freeze-on.sql again, then this script again.
--   families_without_user_row: families that would be signed out under the
--   freeze (signing in creates that row on first use).

SELECT
  c.relname AS table_name,
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g
          WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
            AND g.tgname = 'percy_write_freeze' AND g.tgtype = 31 AND g.tgenabled IN ('O', 'A')
            AND g.tgfoid = to_regproc('public.percy_write_freeze')) AS row_trigger_on,
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g
          WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
            AND g.tgname = 'percy_write_freeze_truncate' AND g.tgtype = 34 AND g.tgenabled IN ('O', 'A')
            AND g.tgfoid = to_regproc('public.percy_write_freeze')) AS truncate_trigger_on
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
ORDER BY c.relname;

SELECT
  CASE
    WHEN count(*) > 0 AND bool_and(row_on AND truncate_on) THEN 'FROZEN'
    WHEN NOT COALESCE(bool_or(any_trigger), false) THEN 'NOT FROZEN'
    ELSE 'PARTLY FROZEN'
  END AS write_freeze,
  count(*)::int AS tables_total,
  count(*) FILTER (WHERE row_on AND truncate_on)::int AS tables_frozen,
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
            AND g.tgfoid = to_regproc('public.percy_write_freeze')) AS truncate_on,
    -- Any trigger with either name, enabled or not, of any shape: its presence
    -- means the state is not a clean "not frozen".
    EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g
            WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
              AND g.tgname IN ('percy_write_freeze', 'percy_write_freeze_truncate')) AS any_trigger
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
) x;
