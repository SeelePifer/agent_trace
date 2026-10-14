import type { CompareTreeNode } from '@agenttrace/shared/compare';

interface CompareTreePanelProps {
  title: string;
  roots: CompareTreeNode[];
  highlightPaths: Set<string>;
}

function TreeBranch({
  nodes,
  prefix,
  highlightPaths,
}: {
  nodes: CompareTreeNode[];
  prefix: string;
  highlightPaths: Set<string>;
}) {
  return (
    <ul className="mini-tree">
      {nodes.map((node, index) => {
        const path = `${prefix}/${index}:${node.kind}:${node.name}`;
        const isHot = highlightPaths.has(path);
        return (
          <li
            key={node.span_id}
            className={isHot ? 'mini-tree__node mini-tree__node--hot' : 'mini-tree__node'}
          >
            <span className="mini-tree__kind">{node.kind}</span>
            <span className="mini-tree__name">{node.name}</span>
            <span className="mini-tree__meta">
              {node.status} · {node.duration_ms}ms
            </span>
            {node.children.length > 0 && (
              <TreeBranch nodes={node.children} prefix={path} highlightPaths={highlightPaths} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CompareTreePanel({ title, roots, highlightPaths }: CompareTreePanelProps) {
  return (
    <div className="compare-tree-panel">
      <h4>{title}</h4>
      {roots.length === 0 ? (
        <p className="muted">No tree</p>
      ) : (
        <TreeBranch nodes={roots} prefix="root" highlightPaths={highlightPaths} />
      )}
    </div>
  );
}
