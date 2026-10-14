import { AsyncLocalStorage } from 'node:async_hooks';
import type { Span } from '@opentelemetry/api';
import type { IngestSpan, SpanCapture } from '@agenttrace/shared';
import { randomBytes } from 'node:crypto';

export interface ActiveSpan {
  spanId: string;
  parentSpanId: string | null;
  kind: IngestSpan['kind'];
  name: string;
  startedAt: Date;
  ordinal: number;
  attributes: Record<string, string | number | boolean>;
  capture?: SpanCapture;
  status: 'ok' | 'error';
  errorMessage?: string;
}

export interface RunContext {
  traceId: string;
  spans: IngestSpan[];
  siblingOrdinals: Map<string | null, number>;
  activeSpan: ActiveSpan | null;
  activeOtelSpan: Span | null;
}

const storage = new AsyncLocalStorage<RunContext>();

export function getRunContext(): RunContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(ctx: RunContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function nextOrdinal(ctx: RunContext, parentSpanId: string | null): number {
  const current = ctx.siblingOrdinals.get(parentSpanId) ?? 0;
  ctx.siblingOrdinals.set(parentSpanId, current + 1);
  return current;
}

/** OpenTelemetry-compatible 16-byte hex span id */
export function newSpanId(): string {
  return randomBytes(8).toString('hex');
}

/** OpenTelemetry-compatible 32-byte hex trace id */
export function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function finalizeSpan(active: ActiveSpan): IngestSpan {
  const endedAt = Date.now();
  const durationMs = Math.max(0, endedAt - active.startedAt.getTime());
  return {
    span_id: active.spanId,
    parent_span_id: active.parentSpanId,
    ordinal: active.ordinal,
    kind: active.kind,
    name: active.name,
    status: active.status,
    started_at: active.startedAt.toISOString(),
    duration_ms: durationMs,
    attributes: active.attributes,
    capture: active.capture,
  };
}
