import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExecutionTree } from '../components/execution-tree';
import { RunWaterfall } from '../components/run-waterfall';
import { SpanDetailPanel } from '../components/span-detail-panel';
import { CopyField } from '../components/copy-field';
import { StatusPill } from '../components/status-pill';
import { getRun, replayRun, type RunSummary, type SpanNode } from '../api';
import { buildSpanTree, findSpanInTree } from '@agenttrace/shared/span-tree';

export function RunDetailPage() {
  const { runId } = useParams();
  const [run, setRun] = useState<RunSummary | null>(null);
  const [spans, setSpans] = useState<SpanNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tree = useMemo(() => buildSpanTree(spans), [spans]);

  const maxDurationMs = useMemo(
    () => spans.reduce((max, span) => Math.max(max, span.duration_ms), 0),
    [spans],
  );

  const selectedSpan = useMemo(() => {
    const fromTree = findSpanInTree(tree, selectedId ?? '');
    if (fromTree) return fromTree;
    return spans.find((span) => span.span_id === selectedId) ?? null;
  }, [tree, spans, selectedId]);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    getRun(runId)
      .then((data) => {
        setRun(data.run);
        setSpans(data.spans);
        const roots = buildSpanTree(data.spans);
        setSelectedId(roots[0]?.span_id ?? data.spans[0]?.span_id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [runId]);

  const onReplay = async () => {
    if (!runId) return;
    setReplayLoading(true);
    setError(null);
    try {
      const result = await replayRun(runId, selectedId ?? undefined);
      setPlayback(JSON.stringify(result.steps, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page run-detail">
        <div className="card run-detail-skeleton">
          <div className="skeleton-row skeleton-row--title" />
          <div className="skeleton-row" />
          <div className="skeleton-row skeleton-row--short" />
        </div>
        <div className="run-detail__split">
          <div className="card panel--tree">
            <div className="skeleton-list">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-row" />
              ))}
            </div>
          </div>
          <div className="card detail-panel detail-panel--empty">Loading span details…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page run-detail">
      <div className="run-detail__hero card">
        <Link to="/" className="back-link">
          ← All runs
        </Link>
        {run && (
          <div className="run-detail__hero-inner">
            <div>
              <h1 className="run-detail__title">{run.agent_name}</h1>
              <p className="run-detail__meta">
                <span className="mono tag-version">v{run.agent_version}</span>
                <StatusPill status={run.status} />
                <span className="muted">{run.duration_ms} ms total</span>
              </p>
              {run.error_summary && <p className="run-detail__err">{run.error_summary}</p>}
              <CopyField
                label="Input hash (for Compare)"
                value={run.input_hash}
                hint="Use the same hash with two agent versions on the Compare page."
              />
            </div>
            <div className="run-detail__trace mono muted">trace {run.trace_id}</div>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {run && tree.length > 0 && (
        <div className="card waterfall">
          <RunWaterfall
            roots={tree}
            runDurationMs={run.duration_ms}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}

      <div className="run-detail__split">
        <div className="card panel--tree">
          <h3 className="card__title">Execution tree</h3>
          <p className="panel-hint">Dependency flow: agent → LLM decisions → tool calls</p>
          <ExecutionTree
            roots={tree}
            selectedId={selectedId}
            maxDurationMs={maxDurationMs}
            onSelect={setSelectedId}
          />
        </div>
        <SpanDetailPanel
          run={run}
          span={selectedSpan}
          playback={playback}
          onReplay={onReplay}
          replayLoading={replayLoading}
        />
      </div>
    </div>
  );
}
