-- A2 I0: one place for request ids, so a retried spend applies once and the
-- same id can't be reused for a different action.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  family_code TEXT NOT NULL,
  request_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  args JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_code, request_id)
);
