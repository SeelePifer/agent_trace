import { describe, expect, it } from 'vitest';
import { buildSpanTree, compareTrees, toCompareSpanRows } from './compare.js';
import type { SpanRow } from './runs.js';

function span(partial: Partial<SpanRow> & Pick<SpanRow, 'span_id'>): SpanRow {
  return {
    parent_span_id: null,
    ordinal: 0,
    kind: 'tool',
    name: 'execute_tool x',
    status: 'ok',
    started_at: new Date(),
    duration_ms: 1,
    attributes: {},
    capture: null,
    ...partial,
  };
}

describe('compare adapter', () => {
  it('maps db rows to shared compare trees', () => {
    const rows = [
      span({ span_id: 'a', kind: 'agent', name: 'run' }),
      span({ span_id: 'b', parent_span_id: 'a', name: 'execute_tool x' }),
    ];
    const compareRows = toCompareSpanRows(rows);
    const tree = buildSpanTree(compareRows);
    expect(tree.length).toBe(1);
    expect(compareTrees(tree, tree, compareRows, compareRows).length).toBe(0);
  });
});
