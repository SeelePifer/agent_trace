import type { SpanTreeNode } from '@agenttrace/shared/span-tree';
import type { SpanNode } from '../api';

type TreeNode = SpanTreeNode<SpanNode>;

const KIND_META: Record<string, { label: string; color: string; icon: string }> = {
  agent: { label: 'Agent', color: '#3b82f6', icon: '◆' },
  llm: { label: 'LLM', color: '#a855f7', icon: '◇' },
  tool: { label: 'Tool', color: '#f59e0b', icon: '⚙' },
  custom: { label: 'Step', color: '#6b7280', icon: '○' },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? KIND_META.custom;
}

interface ExecutionTreeProps {
  roots: TreeNode[];
  selectedId: string | null;
  maxDurationMs: number;
  onSelect: (spanId: string) => void;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  ancestorHasNext: boolean[];
  selectedId: string | null;
  maxDurationMs: number;
  onSelect: (spanId: string) => void;
}

function TreeNode({
  node,
  depth,
  isLast,
  ancestorHasNext,
  selectedId,
  maxDurationMs,
  onSelect,
}: TreeNodeProps) {
  const meta = kindMeta(node.kind);
  const isSelected = selectedId === node.span_id;
  const isError = node.status === 'error';
  const barPct = maxDurationMs > 0 ? Math.min(100, (node.duration_ms / maxDurationMs) * 100) : 0;

  const inputTokens = node.attributes?.['gen_ai.usage.input_tokens'];
  const outputTokens = node.attributes?.['gen_ai.usage.output_tokens'];
  const hasTokens = inputTokens !== undefined || outputTokens !== undefined;

  return (
    <li className="exec-tree-item">
      <div className="exec-tree-row" style={{ paddingLeft: depth * 20 }}>
        {depth > 0 && (
          <div className="exec-tree-guides" aria-hidden>
            {ancestorHasNext.map((hasNext, i) => (
              <span
                key={i}
                className={`exec-tree-guide ${hasNext ? 'exec-tree-guide--continue' : ''}`}
              />
            ))}
            <span
              className={`exec-tree-guide exec-tree-guide--hook ${isLast ? 'exec-tree-guide--last' : ''}`}
            />
          </div>
        )}

        <button
          type="button"
          className={`exec-tree-node ${isSelected ? 'exec-tree-node--selected' : ''} ${isError ? 'exec-tree-node--error' : ''}`}
          onClick={() => onSelect(node.span_id)}
        >
          <span className="exec-tree-node__icon" style={{ color: meta.color }} title={meta.label}>
            {meta.icon}
          </span>
          <span className="exec-tree-node__body">
            <span className="exec-tree-node__title">
              <span
                className="exec-tree-kind"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="exec-tree-name">{shortName(node.name)}</span>
            </span>
            <span className="exec-tree-meta">
              <span>{node.duration_ms} ms</span>
              {hasTokens && (
                <span className="exec-tree-tokens">
                  {String(inputTokens ?? 0)} → {String(outputTokens ?? 0)} tok
                </span>
              )}
              {isError && <span className="exec-tree-fail">failed</span>}
            </span>
            <span className="exec-tree-bar-track">
              <span
                className="exec-tree-bar-fill"
                style={{ width: `${barPct}%`, background: meta.color }}
              />
            </span>
          </span>
        </button>
      </div>

      {node.children.length > 0 && (
        <ul className="exec-tree-children">
          {node.children.map((child, index) => (
            <TreeNode
              key={child.span_id}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              ancestorHasNext={[...ancestorHasNext, !isLast]}
              selectedId={selectedId}
              maxDurationMs={maxDurationMs}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function shortName(name: string): string {
  if (name.startsWith('execute_tool ')) {
    return name.slice('execute_tool '.length);
  }
  if (name.startsWith('chat ')) {
    return name.slice('chat '.length);
  }
  return name;
}

export function ExecutionTree({ roots, selectedId, maxDurationMs, onSelect }: ExecutionTreeProps) {
  if (roots.length === 0) {
    return <p className="exec-tree-empty">No spans in this run.</p>;
  }

  return (
    <ul className="exec-tree-root">
      {roots.map((root, index) => (
        <TreeNode
          key={root.span_id}
          node={root}
          depth={0}
          isLast={index === roots.length - 1}
          ancestorHasNext={[]}
          selectedId={selectedId}
          maxDurationMs={maxDurationMs}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
