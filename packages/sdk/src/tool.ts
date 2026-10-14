import { redactCapture, type SpanCapture } from '@agenttrace/shared';
import { getConfig } from './config.js';
import { finalizeSpan, getRunContext, newSpanId, nextOrdinal, type ActiveSpan } from './context.js';
import { endOtelSpan } from './otel.js';
import { withActiveOtelSpanAsync } from './otel-context.js';

export async function withTool<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T> {
  const ctx = getRunContext();
  if (!ctx) {
    throw new Error('withTool must be called inside agenttrace.run()');
  }

  const parent = ctx.activeSpan;
  const spanId = newSpanId();
  const startedAt = new Date();
  const active: ActiveSpan = {
    spanId,
    parentSpanId: parent?.spanId ?? null,
    kind: 'tool',
    name: `execute_tool ${name}`,
    startedAt,
    ordinal: nextOrdinal(ctx, parent?.spanId ?? null),
    attributes: {
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': name,
    },
    status: 'ok',
  };

  const previousActive = ctx.activeSpan;
  const previousOtel = ctx.activeOtelSpan;
  ctx.activeSpan = active;

  const otelName = `execute_tool ${name}`;

  return withActiveOtelSpanAsync(previousOtel, otelName, async (otelSpan) => {
    otelSpan.setAttributes({
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': name,
    });
    ctx.activeOtelSpan = otelSpan;

    try {
      const result = await fn();
      const capture: SpanCapture = {
        tool: {
          name,
          arguments: args,
          result,
        },
      };
      if (getConfig().capture !== 'never') {
        active.capture = getConfig().redact ? (redactCapture(capture) as SpanCapture) : capture;
      }
      ctx.spans.push(finalizeSpan(active));
      endOtelSpan(otelSpan, 'ok');
      return result;
    } catch (error) {
      active.status = 'error';
      const message = error instanceof Error ? error.message : String(error);
      if (getConfig().capture !== 'never') {
        active.capture = {
          tool: {
            name,
            arguments: args,
            error: message,
          },
        };
      }
      ctx.spans.push(finalizeSpan(active));
      endOtelSpan(otelSpan, 'error', error);
      throw error;
    } finally {
      ctx.activeSpan = previousActive;
      ctx.activeOtelSpan = previousOtel;
    }
  });
}
