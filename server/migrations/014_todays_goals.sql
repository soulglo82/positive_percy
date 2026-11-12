-- Batch E: Today's Goals. 013 is reserved for Batch C deletion (unmerged).
-- Forward-only, non-backfilling. Existing families/children/points unchanged.
CREATE TABLE IF NOT EXISTS today_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category_id UUID REFERENCES behavior_categories(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('one_off','weekly')),
  scheduled_date DATE,
  weekdays SMALLINT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT today_goals_schedule_shape CHECK (
    (schedule_kind = 'one_off' AND scheduled_date IS NOT NULL AND
      cardinality(weekdays) = 0 AND start_date = scheduled_date)
    OR
    (schedule_kind = 'weekly' AND scheduled_date IS NULL AND
      cardinality(weekdays) BETWEEN 1 AND 7 AND
      weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[] )
  )
);
CREATE INDEX IF NOT EXISTS today_goals_child_idx
 ON today_goals(family_code, child_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS today_goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL REFERENCES families(family_code) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES today_goals(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  point_event_id UUID REFERENCES point_events(id) ON DELETE SET NULL,
  awarded_points INTEGER NOT NULL CHECK (awarded_points BETWEEN 1 AND 1000),
  category_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS today_goal_once_per_day
 ON today_goal_completions(goal_id, scheduled_for) WHERE undone_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS today_goal_event_link
 ON today_goal_completions(point_event_id) WHERE point_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS today_goal_completions_family_idx
 ON today_goal_completions(family_code, child_id, scheduled_for);
