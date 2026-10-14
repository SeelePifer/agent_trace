const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const apiKey = import.meta.env.VITE_API_KEY ?? 'dev-secret-change-me';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export interface RunSummary {
  id: string;
  trace_id: string;
  agent_name: string;
  agent_version: string;
  input_hash: string;
  status: string;
  error_summary: string | null;
  started_at: string;
  duration_ms: number;
}

export interface SpanNode {
  span_id: string;
  parent_span_id: string | null;
  ordinal: number;
  kind: string;
  name: string;
  status: string;
  started_at?: string;
  duration_ms: number;
  attributes?: Record<string, string | number | boolean>;
  capture: unknown;
}

export function listRuns(params?: { status?: string; agent_version?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.agent_version) search.set('agent_version', params.agent_version);
  const qs = search.toString();
  return request<{ runs: RunSummary[] }>(`/v1/runs${qs ? `?${qs}` : ''}`);
}

export function getRun(runId: string) {
  return request<{ run: RunSummary; spans: SpanNode[]; tree: unknown }>(`/v1/runs/${runId}`);
}

export function replayRun(runId: string, fromSpanId?: string) {
  return request<{
    mode: string;
    steps: Array<{ span_id: string; name: string; capture: unknown }>;
  }>(`/v1/replay/${runId}`, {
    method: 'POST',
    body: JSON.stringify({ from_span_id: fromSpanId }),
  });
}

export function compareVersions(body: {
  input_hash: string;
  version_a: string;
  version_b: string;
  agent_name?: string;
}) {
  return request<{
    diffs: Array<{
      path: string;
      type: string;
      message: string;
      capture_a?: unknown;
      capture_b?: unknown;
    }>;
    tree_a: unknown;
    tree_b: unknown;
  }>('/v1/compare', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
