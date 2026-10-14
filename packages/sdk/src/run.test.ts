import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, resetConfig } from './config.js';
import { flush } from './export.js';
import { run } from './run.js';

afterEach(() => {
  resetConfig();
  vi.restoreAllMocks();
});

describe('run', () => {
  it('records llm and tool spans', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    configure({
      apiUrl: 'http://localhost:3001',
      apiKey: 'test',
      capture: 'always',
    });

    await run(
      { name: 'test-agent', version: '1.0.0', input: { q: 'hi' } },
      async ({ withLlm, withTool }) => {
        await withLlm({ model: 'mock', messages: [{ role: 'user', content: 'hi' }] }, async () => ({
          response: { role: 'assistant', content: 'use tool' },
          usage: { input: 10, output: 5 },
        }));
        await withTool('search', { q: 'hi' }, async () => ({ hits: 1 }));
        return { ok: true };
      },
    );

    await flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.spans.length).toBeGreaterThanOrEqual(3);
    expect(body.status).toBe('ok');
    expect(body.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('nests child spans under the active parent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    configure({
      apiUrl: 'http://localhost:3001',
      apiKey: 'test',
      capture: 'always',
    });

    await run(
      { name: 'nested-agent', version: '1.0.0', input: { q: 'nested' } },
      async ({ withLlm, withTool }) => {
        await withLlm({ model: 'mock', messages: [{ role: 'user', content: 'go' }] }, async () => {
          await withTool('lookup', { id: 1 }, async () => ({ found: true }));
          return { response: { role: 'assistant', content: 'done' } };
        });
      },
    );

    await flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const llmSpan = body.spans.find((s: { kind: string }) => s.kind === 'llm');
    const nestedTool = body.spans.find(
      (s: { kind: string; name: string }) => s.kind === 'tool' && s.name === 'execute_tool lookup',
    );
    expect(llmSpan).toBeDefined();
    expect(nestedTool).toBeDefined();
    expect(nestedTool.parent_span_id).toBe(llmSpan.span_id);
    expect(llmSpan.parent_span_id).toBe(
      body.spans.find((s: { kind: string }) => s.kind === 'agent').span_id,
    );
  });

  it("strips captures on success when capture is 'on_error'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    configure({
      apiUrl: 'http://localhost:3001',
      apiKey: 'test',
      capture: 'on_error',
    });

    await run({ name: 'ok-agent', version: '1.0.0', input: { q: 'ok' } }, async ({ withLlm }) => {
      await withLlm({ model: 'mock', messages: [] }, async () => ({
        response: { role: 'assistant', content: 'hi' },
      }));
    });

    await flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.status).toBe('ok');
    for (const span of body.spans) {
      expect(span.capture).toBeUndefined();
    }
  });

  it("keeps captures on failure when capture is 'on_error'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    configure({
      apiUrl: 'http://localhost:3001',
      apiKey: 'test',
      capture: 'on_error',
    });

    await expect(
      run({ name: 'fail-agent', version: '1.0.0', input: { q: 'fail' } }, async ({ withTool }) => {
        await withTool('boom', {}, async () => {
          throw new Error('tool failed');
        });
      }),
    ).rejects.toThrow('tool failed');

    await flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.status).toBe('error');
    const toolSpan = body.spans.find(
      (s: { kind: string; name: string }) => s.kind === 'tool' && s.name === 'execute_tool boom',
    );
    expect(toolSpan?.capture?.tool).toBeDefined();
  });
});
