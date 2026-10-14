import { context, trace } from '@opentelemetry/api';
import { hashInput, type IngestRunRequest } from '@agenttrace/shared';
import { getConfig } from './config.js';
import {
  finalizeSpan,
  getRunContext,
  nextOrdinal,
  runWithContext,
  type ActiveSpan,
} from './context.js';
import { enqueueRun } from './export.js';
import { endOtelSpan, getTracer } from './otel.js';
import { withLlm } from './llm.js';
import { withTool } from './tool.js';

export interface RunOptions {
  name: string;
  version: string;
  input: unknown;
  tags?: string[];
}

export interface RunHandle {
  withLlm: typeof withLlm;
  withTool: typeof withTool;
}

export async function run<T>(options: RunOptions, fn: (ctx: RunHandle) => Promise<T>): Promise<T> {
  const startedAt = new Date();

  const otelSpan = getTracer().startSpan(`agent.run ${options.name}`, {
    attributes: {
      'agent.name': options.name,
      'agent.version': options.version,
    },
  });

  const { traceId, spanId: rootSpanId } = otelSpan.spanContext();
  otelSpan.setAttribute('agenttrace.trace_id', traceId);

  const ctx = {
    traceId,
    spans: [] as IngestRunRequest['spans'],
    siblingOrdinals: new Map<string | null, number>(),
    activeSpan: null as ActiveSpan | null,
    activeOtelSpan: otelSpan,
  };

  const rootActive: ActiveSpan = {
    spanId: rootSpanId,
    parentSpanId: null,
    kind: 'agent',
    name: options.name,
    startedAt,
    ordinal: nextOrdinal(ctx, null),
    attributes: {
      'agent.version': options.version,
    },
    status: 'ok',
  };
  ctx.activeSpan = rootActive;

  let result: T;
  let runStatus: 'ok' | 'error' = 'ok';
  let errorSummary: string | undefined;

  try {
    result = await context.with(trace.setSpan(context.active(), otelSpan), async () =>
      runWithContext(ctx, async () =>
        fn({
          withLlm,
          withTool,
        }),
      ),
    );
  } catch (error) {
    runStatus = 'error';
    rootActive.status = 'error';
    rootActive.errorMessage = error instanceof Error ? error.message : String(error);
    errorSummary = rootActive.errorMessage;
    endOtelSpan(otelSpan, 'error', error);
    throw error;
  } finally {
    ctx.spans.push(finalizeSpan(rootActive));
    const durationMs = Math.max(0, Date.now() - startedAt.getTime());
    const { environment, capture } = getConfig();
    const shouldCapture = capture === 'always' || (capture === 'on_error' && runStatus === 'error');

    const ingestRun: IngestRunRequest = {
      trace_id: traceId,
      agent: { name: options.name, version: options.version },
      environment,
      tags: options.tags,
      input: options.input,
      input_hash: hashInput(options.input),
      status: runStatus,
      error_summary: errorSummary,
      started_at: startedAt.toISOString(),
      duration_ms: durationMs,
      spans: ctx.spans
        .map((span) => ({
          ...span,
          capture: shouldCapture ? span.capture : undefined,
        }))
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()),
    };
    enqueueRun(ingestRun);
    if (runStatus === 'ok') {
      endOtelSpan(otelSpan, 'ok');
    }
  }

  return result!;
}

export { getRunContext };
