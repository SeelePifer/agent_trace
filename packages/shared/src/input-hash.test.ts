import { describe, expect, it } from 'vitest';
import { hashInput } from './input-hash.js';

describe('hashInput', () => {
  it('is stable regardless of key order', () => {
    const a = hashInput({ b: 2, a: 1 });
    const b = hashInput({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('differs for different payloads', () => {
    expect(hashInput({ q: 'hello' })).not.toBe(hashInput({ q: 'world' }));
  });
});
