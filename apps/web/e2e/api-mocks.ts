import type { Page, Route } from '@playwright/test';

const mockRun = {
  id: 'run-smoke-1',
  trace_id: 'a'.repeat(32),
  agent_name: 'smoke-agent',
  agent_version: '1.0.0',
  input_hash: 'b'.repeat(64),
  status: 'ok',
  error_summary: null,
  started_at: '2026-01-01T12:00:00.000Z',
  duration_ms: 42,
};

const mockSpans = [
  {
    span_id: 'span-root',
    parent_span_id: null,
    ordinal: 0,
    kind: 'agent',
    name: 'smoke-agent',
    status: 'ok',
    started_at: '2026-01-01T12:00:00.000Z',
    duration_ms: 42,
    attributes: {},
    capture: null,
  },
  {
    span_id: 'span-llm',
    parent_span_id: 'span-root',
    ordinal: 0,
    kind: 'llm',
    name: 'chat mock',
    status: 'ok',
    duration_ms: 10,
    attributes: {},
    capture: { llm: { messages: [], model: 'mock' } },
  },
];

export async function installApiMocks(page: Page): Promise<void> {
  await page.route('**/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/v1/runs' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [mockRun] }),
      });
    }

    if (path === `/v1/runs/${mockRun.id}` && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ run: mockRun, spans: mockSpans, tree: [] }),
      });
    }

    if (path === `/v1/replay/${mockRun.id}` && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'playback',
          steps: [{ span_id: 'span-llm', name: 'chat mock', capture: mockSpans[1].capture }],
        }),
      });
    }

    if (path === '/v1/compare' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          diffs: [
            {
              path: 'spans[1].capture',
              type: 'capture',
              message: 'Capture differs',
            },
          ],
          tree_a: [{ span_id: 'a', name: 'root', kind: 'agent', status: 'ok', children: [] }],
          tree_b: [{ span_id: 'b', name: 'root', kind: 'agent', status: 'ok', children: [] }],
        }),
      });
    }

    return route.fulfill({ status: 404, body: `unmocked ${method} ${path}` });
  });
}
