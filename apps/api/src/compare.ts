import type { CompareSpanRow } from '@agenttrace/shared';
import { buildCompareSpanTree, compareSpanTrees } from '@agenttrace/shared';
import type { SpanRow } from './runs.js';

export type { CompareDiffItem } from '@agenttrace/shared';
export { buildCompareSpanTree as buildSpanTree, compareSpanTrees as compareTrees };

export function toCompareSpanRows(spans: SpanRow[]): CompareSpanRow[] {
  return spans.map((span) => ({
    span_id: span.span_id,
    parent_span_id: span.parent_span_id,
    ordinal: span.ordinal,
    kind: span.kind,
    name: span.name,
    status: span.status,
    duration_ms: span.duration_ms,
    capture: span.capture,
  }));
}
