import { flattenSpanTree, type SpanTreeNode } from '@agenttrace/shared/span-tree';
import type { SpanNode } from '../api';

type WaterfallNode = SpanTreeNode<SpanNode>;

const KIND_COLORS: Record<string, string> = {
  agent: '#3b82f6',
  llm: '#a855f7',
  tool: '#f59e0b',
  custom: '#6b7280',
};

interface RunWaterfallProps {
  roots: WaterfallNode[];
  runDurationMs: number;
  selectedId: string | null;
  onSelect: (spanId: string) => void;
}

export function RunWaterfall({ roots, runDurationMs, selectedId, onSelect }: RunWaterfallProps) {
  const spans = flattenSpanTree(roots);
  const total = Math.max(runDurationMs, 1);

  if (spans.length === 0) return null;

  const minStart = spans.reduce((min, s) => {
    const t = s.started_at ? new Date(s.started_at).getTime() : min;
    return Math.min(min, t);
  }, Number.POSITIVE_INFINITY);

  const base = Number.isFinite(minStart) ? minStart : 0;

  return (
    <div className="waterfall">
      <div className="waterfall__label">Timeline (relative to run)</div>
      <div className="waterfall__track">
        {spans.map((span) => {
          const offsetMs = span.started_at
            ? Math.max(0, new Date(span.started_at).getTime() - base)
            : 0;
          const leftPct = (offsetMs / total) * 100;
          const widthPct = Math.max(0.8, (span.duration_ms / total) * 100);
          const color = KIND_COLORS[span.kind] ?? KIND_COLORS.custom;

          return (
            <button
              key={span.span_id}
              type="button"
              className={`waterfall__bar ${selectedId === span.span_id ? 'waterfall__bar--selected' : ''}`}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                background: color,
              }}
              title={`${span.name} (${span.duration_ms} ms)`}
              onClick={() => onSelect(span.span_id)}
            />
          );
        })}
      </div>
    </div>
  );
}
