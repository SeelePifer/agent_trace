CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input JSONB NOT NULL,
  status TEXT NOT NULL,
  error_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  duration_ms INT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  environment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_list_idx ON runs (agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS runs_compare_idx ON runs (input_hash, agent_version);

CREATE TABLE IF NOT EXISTS span_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  ordinal INT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  duration_ms INT NOT NULL,
  attributes JSONB DEFAULT '{}',
  capture JSONB,
  UNIQUE (run_id, span_id)
);

CREATE INDEX IF NOT EXISTS span_tree_idx ON span_nodes (run_id, parent_span_id, ordinal);
