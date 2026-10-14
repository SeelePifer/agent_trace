import type { IngestRunRequest, IngestSpan, StreamIngestRequest } from '@agenttrace/shared';
import type { Pool, PoolClient } from 'pg';
import { serializeCapture } from './capture.js';

export interface RunRow {
  id: string;
  trace_id: string;
  agent_name: string;
  agent_version: string;
  input_hash: string;
  input: unknown;
  status: string;
  error_summary: string | null;
  started_at: Date;
  duration_ms: number;
  tags: string[];
  environment: string | null;
  created_at: Date;
}

export interface SpanRow {
  span_id: string;
  parent_span_id: string | null;
  ordinal: number;
  kind: string;
  name: string;
  status: string;
  started_at: Date;
  duration_ms: number;
  attributes: Record<string, unknown>;
  capture: unknown | null;
}

export async function insertRun(client: PoolClient, body: IngestRunRequest): Promise<string> {
  const runResult = await client.query<{ id: string }>(
    `INSERT INTO runs (
      trace_id, agent_name, agent_version, input_hash, input, status,
      error_summary, started_at, duration_ms, tags, environment
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id`,
    [
      body.trace_id,
      body.agent.name,
      body.agent.version,
      body.input_hash,
      JSON.stringify(body.input),
      body.status,
      body.error_summary ?? null,
      body.started_at,
      body.duration_ms,
      body.tags ?? [],
      body.environment ?? null,
    ],
  );

  const runId = runResult.rows[0].id;

  await upsertSpans(client, runId, body.spans);
  return runId;
}

async function upsertSpans(client: PoolClient, runId: string, spans: IngestSpan[]): Promise<void> {
  for (const span of spans) {
    await client.query(
      `INSERT INTO span_nodes (
        run_id, span_id, parent_span_id, ordinal, kind, name, status,
        started_at, duration_ms, attributes, capture
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (run_id, span_id) DO UPDATE SET
        parent_span_id = EXCLUDED.parent_span_id,
        ordinal = EXCLUDED.ordinal,
        kind = EXCLUDED.kind,
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        duration_ms = EXCLUDED.duration_ms,
        attributes = EXCLUDED.attributes,
        capture = EXCLUDED.capture`,
      [
        runId,
        span.span_id,
        span.parent_span_id,
        span.ordinal,
        span.kind,
        span.name,
        span.status,
        span.started_at,
        span.duration_ms,
        JSON.stringify(span.attributes),
        serializeCapture(span.capture),
      ],
    );
  }
}

export async function upsertStreamIngest(
  client: PoolClient,
  body: StreamIngestRequest,
): Promise<{ id: string; ingest_state: string }> {
  const existing = await client.query<{ id: string; ingest_state: string }>(
    'SELECT id, ingest_state FROM runs WHERE trace_id = $1',
    [body.trace_id],
  );

  let runId: string;
  if (existing.rowCount === 0) {
    const runResult = await client.query<{ id: string }>(
      `INSERT INTO runs (
        trace_id, agent_name, agent_version, input_hash, input, status,
        error_summary, started_at, duration_ms, tags, environment, ingest_state
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`,
      [
        body.trace_id,
        body.agent.name,
        body.agent.version,
        body.input_hash,
        JSON.stringify(body.input),
        body.status,
        body.error_summary ?? null,
        body.started_at,
        body.duration_ms,
        body.tags ?? [],
        body.environment ?? null,
        body.final ? 'complete' : 'streaming',
      ],
    );
    runId = runResult.rows[0].id;
  } else {
    runId = existing.rows[0].id;
    await client.query(
      `UPDATE runs SET
        status = $2,
        error_summary = $3,
        duration_ms = $4,
        ingest_state = $5
       WHERE id = $1`,
      [
        runId,
        body.status,
        body.error_summary ?? null,
        body.duration_ms,
        body.final ? 'complete' : 'streaming',
      ],
    );
  }

  if (body.spans.length > 0) {
    await upsertSpans(client, runId, body.spans);
  }

  return { id: runId, ingest_state: body.final ? 'complete' : 'streaming' };
}

export async function deleteRunsOlderThan(pool: Pool, days: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `WITH deleted AS (
      DELETE FROM runs
      WHERE created_at < NOW() - make_interval(days => $1)
      RETURNING id
    )
    SELECT COUNT(*)::text AS count FROM deleted`,
    [days],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listRuns(
  pool: Pool,
  filters: { status?: string; agent_version?: string; limit: number },
): Promise<RunRow[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (filters.status) {
    clauses.push(`status = $${index++}`);
    values.push(filters.status);
  }
  if (filters.agent_version) {
    clauses.push(`agent_version = $${index++}`);
    values.push(filters.agent_version);
  }

  values.push(filters.limit);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await pool.query<RunRow>(
    `SELECT * FROM runs ${where} ORDER BY started_at DESC LIMIT $${index}`,
    values,
  );
  return result.rows;
}

export async function getRunById(pool: Pool, runId: string): Promise<RunRow | null> {
  const result = await pool.query<RunRow>('SELECT * FROM runs WHERE id = $1', [runId]);
  return result.rows[0] ?? null;
}

export async function getSpansForRun(pool: Pool, runId: string): Promise<SpanRow[]> {
  const result = await pool.query<SpanRow>(
    `SELECT span_id, parent_span_id, ordinal, kind, name, status,
            started_at, duration_ms, attributes, capture
     FROM span_nodes WHERE run_id = $1
     ORDER BY started_at ASC, ordinal ASC`,
    [runId],
  );
  return result.rows;
}

export async function findRunByInputHashAndVersion(
  pool: Pool,
  inputHash: string,
  version: string,
  agentName?: string,
): Promise<RunRow | null> {
  const values: unknown[] = [inputHash, version];
  let agentClause = '';
  if (agentName) {
    agentClause = ' AND agent_name = $3';
    values.push(agentName);
  }
  const result = await pool.query<RunRow>(
    `SELECT * FROM runs WHERE input_hash = $1 AND agent_version = $2${agentClause}
     ORDER BY started_at DESC LIMIT 1`,
    values,
  );
  return result.rows[0] ?? null;
}
