-- Batch C: reversible seven-day family deletion.
-- Add only nullable metadata and a session generation number. Existing families,
-- balances, children, history and reward records are not rewritten.
ALTER TABLE families ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE families ADD COLUMN IF NOT EXISTS deletion_due_at TIMESTAMPTZ;
ALTER TABLE families ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS families_deletion_due_idx
  ON families(deletion_due_at) WHERE deletion_due_at IS NOT NULL;
ALTER TABLE families ADD CONSTRAINT families_deletion_consistency
  CHECK (
    (deletion_requested_at IS NULL AND deletion_due_at IS NULL)
    OR
    (deletion_requested_at IS NOT NULL AND deletion_due_at IS NOT NULL
     AND deletion_due_at > deletion_requested_at)
  );
