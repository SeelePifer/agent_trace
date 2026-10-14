import { describe, expect, it } from 'vitest';
import { hashInput } from './input-hash.js';
import { ingestRunSchema } from './schemas.js';

describe('ingestRunSchema', () => {
  it('rejects invalid input_hash format', () => {
    const input = { q: 'hi' };
    const result = ingestRunSchema.safeParse({
      trace_id: 'abc',
      agent: { name: 'a', version: '1' },
      input,
      input_hash: hashInput(input).slice(0, 10),
      status: 'ok',
      started_at: new Date().toISOString(),
      duration_ms: 1,
      spans: [
        {
          span_id: 's1',
          parent_span_id: null,
          ordinal: 0,
          kind: 'agent',
          name: 'run',
          status: 'ok',
          started_at: new Date().toISOString(),
          duration_ms: 1,
          attributes: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched input_hash', () => {
    const result = ingestRunSchema.safeParse({
      trace_id: 'abc',
      agent: { name: 'a', version: '1' },
      input: { q: 'hi' },
      input_hash: 'a'.repeat(64),
      status: 'ok',
      started_at: new Date().toISOString(),
      duration_ms: 1,
      spans: [
        {
          span_id: 's1',
          parent_span_id: null,
          ordinal: 0,
          kind: 'agent',
          name: 'run',
          status: 'ok',
          started_at: new Date().toISOString(),
          duration_ms: 1,
          attributes: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts correct input_hash', () => {
    const input = { q: 'hi' };
    const result = ingestRunSchema.safeParse({
      trace_id: 'abc',
      agent: { name: 'a', version: '1' },
      input,
      input_hash: hashInput(input),
      status: 'ok',
      started_at: new Date().toISOString(),
      duration_ms: 1,
      spans: [
        {
          span_id: 's1',
          parent_span_id: null,
          ordinal: 0,
          kind: 'agent',
          name: 'run',
          status: 'ok',
          started_at: new Date().toISOString(),
          duration_ms: 1,
          attributes: {},
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
