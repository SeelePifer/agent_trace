export interface FlatSpanForTree {
  span_id: string;
  parent_span_id: string | null;
  ordinal: number;
}

export type SpanTreeNode<T extends FlatSpanForTree> = T & {
  children: SpanTreeNode<T>[];
};

export function buildSpanTree<T extends FlatSpanForTree>(spans: T[]): SpanTreeNode<T>[] {
  const byId = new Map<string, SpanTreeNode<T>>();
  const roots: SpanTreeNode<T>[] = [];

  for (const span of spans) {
    byId.set(span.span_id, { ...span, children: [] });
  }

  for (const span of spans) {
    const node = byId.get(span.span_id)!;
    if (span.parent_span_id && byId.has(span.parent_span_id)) {
      byId.get(span.parent_span_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByOrdinal = (nodes: SpanTreeNode<T>[]) => {
    nodes.sort((a, b) => a.ordinal - b.ordinal);
    nodes.forEach((n) => sortByOrdinal(n.children));
  };
  sortByOrdinal(roots);

  return roots;
}

export function flattenSpanTree<T extends FlatSpanForTree>(
  nodes: SpanTreeNode<T>[],
): SpanTreeNode<T>[] {
  const out: SpanTreeNode<T>[] = [];
  const walk = (list: SpanTreeNode<T>[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function findSpanInTree<T extends FlatSpanForTree>(
  nodes: SpanTreeNode<T>[],
  spanId: string,
): SpanTreeNode<T> | null {
  for (const node of nodes) {
    if (node.span_id === spanId) return node;
    const found = findSpanInTree(node.children, spanId);
    if (found) return found;
  }
  return null;
}
