import type { SpanRow } from './runs.js';

export interface PlaybackStep {
  span_id: string;
  kind: string;
  name: string;
  status: string;
  capture: unknown | null;
}

export function buildPlayback(
  spans: SpanRow[],
  fromSpanId?: string,
): { steps: PlaybackStep[]; started_from: string | null } {
  const ordered = [...spans].sort((a, b) => {
    const ta = new Date(a.started_at).getTime();
    const tb = new Date(b.started_at).getTime();
    return ta - tb;
  });

  let slice = ordered;
  if (fromSpanId) {
    const startIndex = ordered.findIndex((s) => s.span_id === fromSpanId);
    if (startIndex >= 0) {
      slice = ordered.slice(startIndex);
    }
  }

  const steps: PlaybackStep[] = slice.map((span) => ({
    span_id: span.span_id,
    kind: span.kind,
    name: span.name,
    status: span.status,
    capture: span.capture,
  }));

  return {
    steps,
    started_from: fromSpanId ?? null,
  };
}
