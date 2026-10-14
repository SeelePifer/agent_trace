import { hashInput, type IngestRunRequest } from '@agenttrace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closePool, getPool } from '../db.js';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const apiKey = process.env.AGENTTRACE_API_KEY ?? 'test-integration-key';

describe.skipIf(!hasDatabase)('API integration', () => {
  const app = createApp();

  beforeAll(() => {
    process.env.AGENTTRACE_API_KEY = apiKey;
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    execSync('pnpm exec tsx src/migrate.ts', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(async () => {
    await closePool();
  });

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  function buildRun(version: string, input: { q: string }): IngestRunRequest {
    const started = new Date().toISOString();
    return {
      trace_id: `e2e-${version}-${Date.now()}`,
      agent: { name: 'e2e-agent', version },
      input,
      input_hash: hashInput(input),
      status: 'ok',
      started_at: started,
      duration_ms: 12,
      spans: [
        {
          span_id: `root-${version}`,
          parent_span_id: null,
          ordinal: 0,
          kind: 'agent',
          name: 'e2e-agent',
          status: 'ok',
          started_at: started,
          duration_ms: 12,
          attributes: {},
          capture: { tool: { name: 'search', arguments: { q: input.q }, result: { ok: true } } },
        },
      ],
    };
  }

  it('ingests runs and compares versions', async () => {
    const input = { q: 'integration-fixture' };
    const runA = buildRun('1.0.0', input);
    const runB = {
      ...buildRun('1.1.0', input),
      spans: [
        {
          ...buildRun('1.1.0', input).spans[0],
          capture: {
            tool: { name: 'search', arguments: { q: input.q }, result: { ok: false } },
          },
        },
      ],
    };

    const ingestA = await app.request('/v1/runs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(runA),
    });
    expect(ingestA.status).toBe(201);

    const ingestB = await app.request('/v1/runs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(runB),
    });
    expect(ingestB.status).toBe(201);

    const compare = await app.request('/v1/compare', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        input_hash: hashInput(input),
        version_a: '1.0.0',
        version_b: '1.1.0',
        agent_name: 'e2e-agent',
      }),
    });
    expect(compare.status).toBe(200);
    const compareBody = await compare.json();
    expect(compareBody.diffs.length).toBeGreaterThan(0);
  });

  it('accepts streaming span batches', async () => {
    const input = { q: 'stream-fixture' };
    const started = new Date().toISOString();
    const traceId = `e2e-stream-${Date.now()}`;

    const chunk = {
      trace_id: traceId,
      agent: { name: 'e2e-agent', version: '2.0.0' },
      input,
      input_hash: hashInput(input),
      status: 'ok',
      started_at: started,
      duration_ms: 5,
      final: false,
      spans: [
        {
          span_id: 'stream-root',
          parent_span_id: null,
          ordinal: 0,
          kind: 'agent',
          name: 'e2e-agent',
          status: 'ok',
          started_at: started,
          duration_ms: 5,
          attributes: {},
        },
      ],
    };

    const first = await app.request('/v1/runs/stream', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(chunk),
    });
    expect(first.status).toBe(201);

    const finalChunk = {
      ...chunk,
      final: true,
      duration_ms: 20,
      spans: [
        {
          span_id: 'stream-tool',
          parent_span_id: 'stream-root',
          ordinal: 0,
          kind: 'tool',
          name: 'execute_tool search',
          status: 'ok',
          started_at: started,
          duration_ms: 10,
          attributes: {},
        },
      ],
    };

    const second = await app.request('/v1/runs/stream', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(finalChunk),
    });
    expect(second.status).toBe(200);

    const pool = getPool();
    const run = await pool.query('SELECT ingest_state FROM runs WHERE trace_id = $1', [traceId]);
    expect(run.rows[0]?.ingest_state).toBe('complete');
  });
});
