import type { IngestRunRequest } from '@agenttrace/shared';
import { getConfig } from './config.js';

const pendingRuns: IngestRunRequest[] = [];

export function enqueueRun(run: IngestRunRequest): void {
  pendingRuns.push(run);
}

export function getPendingRunCount(): number {
  return pendingRuns.length;
}

async function postRun(run: IngestRunRequest): Promise<void> {
  const { apiUrl, apiKey } = getConfig();
  if (!apiUrl) {
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(run),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AgentTrace ingest failed (${response.status}): ${body}`);
  }
}

/** Sends all queued runs in order. Safe to call multiple times. */
export async function flush(): Promise<void> {
  if (pendingRuns.length === 0) {
    return;
  }

  const batch = pendingRuns.splice(0, pendingRuns.length);
  for (const run of batch) {
    await postRun(run);
  }
}
