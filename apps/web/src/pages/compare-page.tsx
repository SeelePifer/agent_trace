import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CompareTreeNode } from '@agenttrace/shared/compare';
import { PageHeader } from '../components/page-header';
import { CompareTreePanel } from '../components/compare-tree-panel';
import { compareVersions } from '../api';

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const [inputHash, setInputHash] = useState(searchParams.get('input_hash') ?? '');
  const [versionA, setVersionA] = useState(searchParams.get('version_a') ?? '1.0.0');
  const [versionB, setVersionB] = useState(searchParams.get('version_b') ?? '1.1.0');
  const [agentName, setAgentName] = useState(searchParams.get('agent') ?? 'toy-agent');
  const [diffs, setDiffs] = useState<
    Array<{ path: string; type: string; message: string; capture_a?: unknown; capture_b?: unknown }>
  >([]);
  const [treeA, setTreeA] = useState<CompareTreeNode[]>([]);
  const [treeB, setTreeB] = useState<CompareTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compared, setCompared] = useState(false);

  const highlightPaths = useMemo(() => new Set(diffs.map((d) => d.path)), [diffs]);

  const onCompare = async () => {
    setError(null);
    setLoading(true);
    setCompared(false);
    try {
      const result = await compareVersions({
        input_hash: inputHash,
        version_a: versionA,
        version_b: versionB,
        agent_name: agentName,
      });
      setDiffs(result.diffs);
      setTreeA((result.tree_a as CompareTreeNode[]) ?? []);
      setTreeB((result.tree_b as CompareTreeNode[]) ?? []);
      setCompared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDiffs([]);
      setTreeA([]);
      setTreeB([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Compare versions"
        description="Same fixture (input_hash), two agent versions — structure, status, and capture diffs."
      />

      <div className="compare-layout">
        <div className="card compare-form">
          <label className="field">
            <span>Agent name</span>
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          </label>
          <label className="field field--full">
            <span>Input hash (sha256)</span>
            <input
              className="mono"
              placeholder="Paste hash from a run row or API"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value)}
            />
          </label>
          <div className="version-pair">
            <label className="field">
              <span>Version A</span>
              <input value={versionA} onChange={(e) => setVersionA(e.target.value)} />
            </label>
            <div className="version-pair__vs" aria-hidden>
              vs
            </div>
            <label className="field">
              <span>Version B</span>
              <input value={versionB} onChange={(e) => setVersionB(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn--primary" onClick={onCompare} disabled={loading}>
            {loading ? 'Comparing…' : 'Run comparison'}
          </button>
        </div>

        <div className="card compare-results">
          <h3 className="card__title">Diff summary</h3>
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}
          {!error && !compared && (
            <p className="muted compare-placeholder">Run a comparison to see trees and diffs.</p>
          )}
          {compared && diffs.length === 0 && (
            <div className="alert alert--success">
              Trees and captures match for this fixture pair.
            </div>
          )}
          <ul className="diff-list">
            {diffs.map((diff, index) => (
              <li key={`${diff.path}-${index}`} className={`diff-item diff-item--${diff.type}`}>
                <span className={`diff-type diff-type--${diff.type}`}>{diff.type}</span>
                <code className="diff-item__path">{diff.path}</code>
                <p>{diff.message}</p>
                {diff.type === 'capture' && (
                  <div className="capture-diff-grid">
                    <div>
                      <span className="capture-diff-label">Version A</span>
                      <pre className="mono detail-pre">
                        {JSON.stringify(diff.capture_a, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="capture-diff-label">Version B</span>
                      <pre className="mono detail-pre">
                        {JSON.stringify(diff.capture_b, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {compared && (
        <div className="compare-trees card">
          <h3 className="card__title">Side-by-side trees</h3>
          <div className="compare-trees__grid">
            <CompareTreePanel
              title={`Version ${versionA}`}
              roots={treeA}
              highlightPaths={highlightPaths}
            />
            <CompareTreePanel
              title={`Version ${versionB}`}
              roots={treeB}
              highlightPaths={highlightPaths}
            />
          </div>
        </div>
      )}
    </div>
  );
}
