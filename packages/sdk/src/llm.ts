import { redactCapture, type SpanCapture } from '@agenttrace/shared';
import { getConfig } from './config.js';
import { finalizeSpan, getRunContext, newSpanId, nextOrdinal, type ActiveSpan } from './context.js';
import { endOtelSpan } from './otel.js';
import { withActiveOtelSpanAsync } from './otel-context.js';

export interface LlmMeta {
  model: string;
  provider?: string;
  messages: unknown[];
}

export async function withLlm<T>(
  meta: LlmMeta,
  fn: () => Promise<{ response: unknown; usage?: { input: number; output: number } } & T>,
): Promise<{ response: unknown; usage?: { input: number; output: number } } & T> {
  const ctx = getRunContext();
  if (!ctx) {
    throw new Error('withLlm must be called inside agenttrace.run()');
  }

  const parent = ctx.activeSpan;
  const spanId = newSpanId();
  const startedAt = new Date();
  const active: ActiveSpan = {
    spanId,
    parentSpanId: parent?.spanId ?? null,
    kind: 'llm',
    name: `chat ${meta.model}`,
    startedAt,
    ordinal: nextOrdinal(ctx, parent?.spanId ?? null),
    attributes: {
      'gen_ai.request.model': meta.model,
      ...(meta.provider ? { 'gen_ai.provider.name': meta.provider } : {}),
      'gen_ai.operation.name': 'chat',
    },
    status: 'ok',
  };

  const previousActive = ctx.activeSpan;
  const previousOtel = ctx.activeOtelSpan;
  ctx.activeSpan = active;

  const otelName = `chat ${meta.model}`;

  return withActiveOtelSpanAsync(previousOtel, otelName, async (otelSpan) => {
    otelSpan.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': meta.model,
    });
    ctx.activeOtelSpan = otelSpan;

    try {
      const outcome = await fn();
      const capture: SpanCapture = {
        llm: {
          messages: meta.messages,
          response: outcome.response,
          model: meta.model,
          usage: outcome.usage,
        },
      };
      if (getConfig().capture !== 'never') {
        active.capture = getConfig().redact ? (redactCapture(capture) as SpanCapture) : capture;
      }
      if (outcome.usage) {
        active.attributes['gen_ai.usage.input_tokens'] = outcome.usage.input;
        active.attributes['gen_ai.usage.output_tokens'] = outcome.usage.output;
      }
      ctx.spans.push(finalizeSpan(active));
      endOtelSpan(otelSpan, 'ok');
      return outcome;
    } catch (error) {
      active.status = 'error';
      if (getConfig().capture !== 'never') {
        active.capture = {
          llm: {
            messages: meta.messages,
            model: meta.model,
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
