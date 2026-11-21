-- Scratch, pre-launch only (as 016's rollback, §13.3): refuses once any
-- ended-savings row exists, so the record of why savings ended is never lost.
DO $$
BEGIN
  IF to_regclass('public.savings_events') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'savings_events' AND column_name = 'ended_by')
     AND (SELECT count(*) FROM savings_events WHERE ended_by IS NOT NULL) > 0 THEN
    RAISE EXCEPTION 'ended-savings records exist: refusing to roll back 017';
  END IF;
END $$;
ALTER TABLE IF EXISTS savings_events DROP CONSTRAINT IF EXISTS savings_events_ended_shape;
ALTER TABLE IF EXISTS savings_events DROP CONSTRAINT IF EXISTS savings_events_ended_by_check;
ALTER TABLE IF EXISTS savings_events DROP COLUMN IF EXISTS ended_by;
