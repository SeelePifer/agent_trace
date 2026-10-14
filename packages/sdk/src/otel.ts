import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { getConfig } from './config.js';

let provider: BasicTracerProvider | null = null;

export function ensureOtelProvider(): void {
  const { otlpEndpoint } = getConfig();
  if (!otlpEndpoint || provider) {
    return;
  }
  provider = new BasicTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'agenttrace-sdk',
    }),
  });
  const exporter = new OTLPTraceExporter({ url: otlpEndpoint });
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  trace.setGlobalTracerProvider(provider);
}

export function getTracer() {
  ensureOtelProvider();
  return trace.getTracer('agenttrace-sdk');
}

export function endOtelSpan(span: Span, status: 'ok' | 'error', error?: unknown): void {
  if (status === 'error') {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  span.end();
}

export async function shutdownOtel(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
  }
}
