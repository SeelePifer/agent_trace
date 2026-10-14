import { context, trace, type Span } from '@opentelemetry/api';
import { getTracer } from './otel.js';

/** Runs fn with a child OTel span; caller must end the span (e.g. via endOtelSpan). */
export async function withActiveOtelSpanAsync<T>(
  parent: Span | null,
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const parentContext = parent ? trace.setSpan(context.active(), parent) : context.active();
  const span = tracer.startSpan(name, {}, parentContext);
  return context.with(trace.setSpan(context.active(), span), () => fn(span));
}
