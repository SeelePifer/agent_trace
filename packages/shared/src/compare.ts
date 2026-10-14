import { buildSpanTree, type FlatSpanForTree, type SpanTreeNode } from './span-tree.js';

export interface CompareSpanRow extends FlatSpanForTree {
  kind: string;
  name: string;
  status: string;
  duration_ms: number;
  capture?: unknown | null;
}

export type CompareTreeNode = SpanTreeNode<CompareSpanRow>;

export function buildCompareSpanTree(spans: CompareSpanRow[]): CompareTreeNode[] {
  return buildSpanTree(spans);
}

export interface CompareDiffItem {
  path: string;
  type: 'structure' | 'status' | 'capture' | 'missing';
  message: string;
  capture_a?: unknown;
  capture_b?: unknown;
}

interface PathSpanRef {
  path: string;
  span_id: string;
}

function collectPathSpans(nodes: CompareTreeNode[], prefix: string, acc: PathSpanRef[]): void {
  nodes.forEach((node, index) => {
    const path = `${prefix}/${index}:${node.kind}:${node.name}`;
    acc.push({ path, span_id: node.span_id });
    collectPathSpans(node.children, path, acc);
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

function captureSummary(capture: unknown): string {
  if (!capture || typeof capture !== 'object') {
    return stableStringify(capture);
  }
  const record = capture as Record<string, unknown>;
  if (record.tool && typeof record.tool === 'object') {
    const tool = record.tool as Record<string, unknown>;
    return `tool:${String(tool.name)}`;
  }
  if (record.llm && typeof record.llm === 'object') {
    const llm = record.llm as Record<string, unknown>;
    return `llm:${String(llm.model ?? 'unknown')}`;
  }
  return 'capture';
}

function spanById(spans: CompareSpanRow[]): Map<string, CompareSpanRow> {
  return new Map(spans.map((span) => [span.span_id, span]));
}

export function compareSpanTrees(
  treeA: CompareTreeNode[],
  treeB: CompareTreeNode[],
  spansA: CompareSpanRow[] = [],
  spansB: CompareSpanRow[] = [],
): CompareDiffItem[] {
  const refsA: PathSpanRef[] = [];
  const refsB: PathSpanRef[] = [];
  collectPathSpans(treeA, 'root', refsA);
  collectPathSpans(treeB, 'root', refsB);

  const mapA = spanById(spansA);
  const mapB = spanById(spansB);
  const diffs: CompareDiffItem[] = [];

  const maxLen = Math.max(refsA.length, refsB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = refsA[i];
    const b = refsB[i];
    if (!a) {
      diffs.push({ path: b.path, type: 'missing', message: 'Span exists only in version B' });
      continue;
    }
    if (!b) {
      diffs.push({ path: a.path, type: 'missing', message: 'Span exists only in version A' });
      continue;
    }
    if (a.path !== b.path) {
      diffs.push({
        path: a.path,
        type: 'structure',
        message: `Structure diverged (A: ${a.path}, B: ${b.path})`,
      });
      continue;
    }

    const rowA = mapA.get(a.span_id);
    const rowB = mapB.get(b.span_id);
    if (rowA && rowB && rowA.status !== rowB.status) {
      diffs.push({
        path: a.path,
        type: 'status',
        message: `Status differs (A: ${rowA.status}, B: ${rowB.status})`,
      });
    }

    if (rowA && rowB) {
      const capA = stableStringify(rowA.capture ?? null);
      const capB = stableStringify(rowB.capture ?? null);
      if (capA !== capB) {
        diffs.push({
          path: a.path,
          type: 'capture',
          message: `Capture differs (${captureSummary(rowA.capture)} vs ${captureSummary(rowB.capture)})`,
          capture_a: rowA.capture ?? null,
          capture_b: rowB.capture ?? null,
        });
      }
    }
  }

  return diffs;
}
