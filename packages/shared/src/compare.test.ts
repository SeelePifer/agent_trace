import { describe, expect, it } from 'vitest';
import { buildCompareSpanTree, compareSpanTrees, type CompareSpanRow } from './compare.js';

function span(partial: Partial<CompareSpanRow> & Pick<CompareSpanRow, 'span_id'>): CompareSpanRow {
  return {
    parent_span_id: null,
    ordinal: 0,
    kind: 'tool',
    name: 'execute_tool x',
    status: 'ok',
    duration_ms: 1,
    capture: null,
    ...partial,
  };
}

describe('compareSpanTrees', () => {
  it('detects structural divergence', () => {
    const rows: CompareSpanRow[] = [
      span({ span_id: 'a', kind: 'agent', name: 'run', ordinal: 0 }),
      span({ span_id: 'b', parent_span_id: 'a', name: 'execute_tool search', ordinal: 0 }),
      span({ span_id: 'c', parent_span_id: 'a', name: 'execute_tool email', ordinal: 1 }),
    ];
    const tree = buildCompareSpanTree(rows);
    const diffs = compareSpanTrees(tree, buildCompareSpanTree([rows[0], rows[1]]), rows, [
      rows[0],
      rows[1],
    ]);
    expect(diffs.some((d) => d.type === 'missing' || d.type === 'structure')).toBe(true);
  });

  it('detects capture differences with structured payload', () => {
    const rowsA: CompareSpanRow[] = [
      span({ span_id: 'a', kind: 'agent', name: 'run', ordinal: 0 }),
      span({
        span_id: 'b',
        parent_span_id: 'a',
        name: 'execute_tool search',
        ordinal: 0,
        capture: { tool: { name: 'search', arguments: { q: 'a' }, result: { ok: true } } },
      }),
    ];
    const rowsB: CompareSpanRow[] = [
      span({ span_id: 'a2', kind: 'agent', name: 'run', ordinal: 0 }),
      span({
        span_id: 'b2',
        parent_span_id: 'a2',
        name: 'execute_tool search',
        ordinal: 0,
        capture: { tool: { name: 'search', arguments: { q: 'b' }, result: { ok: true } } },
      }),
    ];
    const diffs = compareSpanTrees(
      buildCompareSpanTree(rowsA),
      buildCompareSpanTree(rowsB),
      rowsA,
      rowsB,
    );
    const captureDiff = diffs.find((d) => d.type === 'capture');
    expect(captureDiff).toBeDefined();
    expect(captureDiff?.capture_a).toBeTruthy();
    expect(captureDiff?.capture_b).toBeTruthy();
  });
});
