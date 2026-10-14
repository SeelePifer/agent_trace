import {
  compareRequestSchema,
  ingestRunSchema,
  replayRequestSchema,
  streamIngestSchema,
} from '@agenttrace/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requireApiKey } from './auth.js';
import { enforceBodyLimit } from './body-limit.js';
import { buildSpanTree, compareTrees, toCompareSpanRows } from './compare.js';
import { getCorsOrigins } from './cors.js';
import { getPool } from './db.js';
import { isUniqueViolation, logServerError, publicErrorBody } from './errors.js';
import { openApiDocument } from './openapi.js';
import { parseJsonBody, parseJsonBodyOptional } from './parse-json.js';
import { ingestRateLimit } from './rate-limit.js';
import { buildPlayback } from './replay.js';
import {
  findRunByInputHashAndVersion,
  getRunById,
  getSpansForRun,
  insertRun,
  listRuns,
  upsertStreamIngest,
} from './runs.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: getCorsOrigins(),
      allowHeaders: ['Authorization', 'Content-Type'],
    }),
  );

  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/openapi.json', (c) => c.json(openApiDocument));

  app.notFound((c) => c.json({ error: 'Not found', code: 'NOT_FOUND', path: c.req.path }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    logServerError(error, { method: c.req.method, path: c.req.path });

    if (isUniqueViolation(error)) {
      return c.json({ error: 'Trace already ingested', code: 'TRACE_ALREADY_INGESTED' }, 409);
    }

    const body = publicErrorBody(error);
    return c.json(body, 500);
  });

  app.use('/v1/*', requireApiKey);
  app.use('/v1/runs', enforceBodyLimit);
  app.use('/v1/runs/stream', enforceBodyLimit);

  app.post('/v1/runs', ingestRateLimit, async (c) => {
    const raw = await parseJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = ingestRunSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const runId = await insertRun(client, parsed.data);
      await client.query('COMMIT');
      return c.json({ id: runId, trace_id: parsed.data.trace_id }, 201);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (isUniqueViolation(error)) {
        return c.json({ error: 'Trace already ingested', code: 'TRACE_ALREADY_INGESTED' }, 409);
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/v1/runs/stream', ingestRateLimit, async (c) => {
    const raw = await parseJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = streamIngestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id FROM runs WHERE trace_id = $1', [
        parsed.data.trace_id,
      ]);
      const result = await upsertStreamIngest(client, parsed.data);
      await client.query('COMMIT');
      const status = existing.rowCount === 0 ? 201 : 200;
      return c.json(result, status);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (isUniqueViolation(error)) {
        return c.json({ error: 'Trace already ingested', code: 'TRACE_ALREADY_INGESTED' }, 409);
      }
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/v1/runs', async (c) => {
    const status = c.req.query('status');
    const agentVersion = c.req.query('agent_version');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);

    const pool = getPool();
    const runs = await listRuns(pool, {
      status: status ?? undefined,
      agent_version: agentVersion ?? undefined,
      limit,
    });
    return c.json({ runs });
  });

  app.get('/v1/runs/:runId', async (c) => {
    const runId = c.req.param('runId');
    const pool = getPool();
    const run = await getRunById(pool, runId);
    if (!run) {
      return c.json({ error: 'Run not found', code: 'RUN_NOT_FOUND' }, 404);
    }
    const spans = await getSpansForRun(pool, runId);
    const tree = buildSpanTree(toCompareSpanRows(spans));
    return c.json({ run, spans, tree });
  });

  app.post('/v1/compare', async (c) => {
    const raw = await parseJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = compareRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const pool = getPool();
    const { input_hash, version_a, version_b, agent_name } = parsed.data;

    const runA = await findRunByInputHashAndVersion(pool, input_hash, version_a, agent_name);
    const runB = await findRunByInputHashAndVersion(pool, input_hash, version_b, agent_name);

    if (!runA || !runB) {
      return c.json(
        {
          error: 'Missing run for comparison',
          code: 'COMPARE_RUNS_NOT_FOUND',
          found: { a: Boolean(runA), b: Boolean(runB) },
        },
        404,
      );
    }

    const spansA = await getSpansForRun(pool, runA.id);
    const spansB = await getSpansForRun(pool, runB.id);
    const rowsA = toCompareSpanRows(spansA);
    const rowsB = toCompareSpanRows(spansB);
    const treeA = buildSpanTree(rowsA);
    const treeB = buildSpanTree(rowsB);
    const diffs = compareTrees(treeA, treeB, rowsA, rowsB);

    return c.json({
      run_a: runA,
      run_b: runB,
      tree_a: treeA,
      tree_b: treeB,
      diffs,
    });
  });

  app.post('/v1/replay/:runId', async (c) => {
    const runId = c.req.param('runId');
    const raw = await parseJsonBodyOptional(c);
    if (raw instanceof Response) {
      return raw;
    }
    const parsed = replayRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const pool = getPool();
    const run = await getRunById(pool, runId);
    if (!run) {
      return c.json({ error: 'Run not found', code: 'RUN_NOT_FOUND' }, 404);
    }

    const spans = await getSpansForRun(pool, runId);
    const playback = buildPlayback(spans, parsed.data.from_span_id);

    return c.json({
      mode: 'playback',
      run_id: runId,
      ...playback,
    });
  });

  return app;
}
