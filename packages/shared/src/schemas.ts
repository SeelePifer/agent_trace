import { z } from 'zod';
import { hashInput } from './input-hash.js';

export const spanKindSchema = z.enum(['agent', 'llm', 'tool', 'custom']);
export const runStatusSchema = z.enum(['ok', 'error']);
export const spanStatusSchema = z.enum(['ok', 'error']);

export const llmCaptureSchema = z.object({
  messages: z.array(z.unknown()),
  response: z.unknown().optional(),
  model: z.string().optional(),
  usage: z
    .object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    })
    .optional(),
});

export const toolCaptureSchema = z.object({
  name: z.string(),
  arguments: z.unknown(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const spanCaptureSchema = z.object({
  llm: llmCaptureSchema.optional(),
  tool: toolCaptureSchema.optional(),
});

export const ingestSpanSchema = z.object({
  span_id: z.string().min(1),
  parent_span_id: z.string().nullable(),
  ordinal: z.number().int().nonnegative(),
  kind: spanKindSchema,
  name: z.string().min(1),
  status: spanStatusSchema,
  started_at: z.string().datetime(),
  duration_ms: z.number().int().nonnegative(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  capture: spanCaptureSchema.optional(),
});

const ingestRunBaseSchema = z.object({
  trace_id: z.string().min(1),
  agent: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  input: z.unknown(),
  input_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'input_hash must be a 64-character lowercase sha256 hex string'),
  status: runStatusSchema,
  error_summary: z.string().optional(),
  started_at: z.string().datetime(),
  duration_ms: z.number().int().nonnegative(),
});

type IngestRunBase = z.infer<typeof ingestRunBaseSchema>;

function validateInputHash(data: IngestRunBase, ctx: z.RefinementCtx): void {
  const expected = hashInput(data.input);
  if (data.input_hash !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'input_hash does not match hashInput(input)',
      path: ['input_hash'],
    });
  }
}

export const ingestRunSchema = ingestRunBaseSchema
  .extend({
    spans: z.array(ingestSpanSchema).min(1),
  })
  .superRefine(validateInputHash);

export const streamIngestSchema = ingestRunBaseSchema
  .extend({
    spans: z.array(ingestSpanSchema),
    final: z.boolean(),
  })
  .superRefine(validateInputHash);

export const compareRequestSchema = z.object({
  input_hash: z.string().min(1),
  version_a: z.string().min(1),
  version_b: z.string().min(1),
  agent_name: z.string().min(1).optional(),
});

export const replayRequestSchema = z.object({
  from_span_id: z.string().optional(),
});

export type IngestRunRequest = z.infer<typeof ingestRunSchema>;
export type StreamIngestRequest = z.infer<typeof streamIngestSchema>;
export type IngestSpan = z.infer<typeof ingestSpanSchema>;
export type SpanCapture = z.infer<typeof spanCaptureSchema>;
export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type ReplayRequest = z.infer<typeof replayRequestSchema>;
