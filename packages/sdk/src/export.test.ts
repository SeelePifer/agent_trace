import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, resetConfig } from './config.js';
import { flush, getPendingRunCount } from './export.js';
import { run } from './run.js';

afterEach(() => {
  resetConfig();
  vi.restoreAllMocks();
});

describe('flush queue', () => {
  it('sends multiple runs in one flush', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    configure({
      apiUrl: 'http://localhost:3001',
      apiKey: 'test',
      capture: 'never',
    });

    await run({ name: 'a', version: '1', input: { n: 1 } }, async () => ({}));
    await run({ name: 'b', version: '1', input: { n: 2 } }, async () => ({}));

    expect(getPendingRunCount()).toBe(2);

    await flush();

    expect(getPendingRunCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
