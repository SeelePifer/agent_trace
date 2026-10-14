import { describe, expect, it } from 'vitest';
import { getPgError, isUniqueViolation } from './errors.js';

describe('isUniqueViolation', () => {
  it('detects postgres 23505', () => {
    expect(isUniqueViolation({ code: '23505', constraint: 'runs_trace_id_key' })).toBe(true);
  });

  it('rejects other codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('unique'))).toBe(false);
  });

  it('parses pg error shape', () => {
    expect(getPgError({ code: '23505' })?.code).toBe('23505');
  });
});
