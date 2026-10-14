ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS ingest_state TEXT NOT NULL DEFAULT 'complete';

CREATE INDEX IF NOT EXISTS runs_retention_idx ON runs (created_at);
