import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/page-header';
import { StatusPill } from '../components/status-pill';
import { listRuns, type RunSummary } from '../api';

type StatusFilter = '' | 'ok' | 'error';

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function compareUrl(run: RunSummary): string {
  const params = new URLSearchParams({
    input_hash: run.input_hash,
    agent: run.agent_name,
    version_a: run.agent_version,
    version_b: run.agent_version === '1.0.0' ? '1.1.0' : '1.0.0',
  });
  return `/compare?${params.toString()}`;
}

export function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [status, setStatus] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listRuns({ status: status || undefined })
      .then((data) => setRuns(data.runs))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [status]);

  const stats = useMemo(() => {
    const errors = runs.filter((r) => r.status === 'error').length;
    const avgMs =
      runs.length > 0
        ? Math.round(runs.reduce((sum, r) => sum + r.duration_ms, 0) / runs.length)
        : 0;
    return { total: runs.length, errors, avgMs };
  }, [runs]);

  return (
    <div className="page">
      <PageHeader
        title="Runs"
        description="Every agent execution as a trace — open one to explore the dependency tree."
        actions={
          <div className="filter-chips">
            {(['', 'ok', 'error'] as StatusFilter[]).map((value) => (
              <button
                key={value || 'all'}
                type="button"
                className={`chip ${status === value ? 'chip--active' : ''}`}
                onClick={() => setStatus(value)}
              >
                {value === '' ? 'All' : value}
              </button>
            ))}
          </div>
        }
      />

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Visible runs</span>
          <strong className="stat-card__value">{stats.total}</strong>
        </div>
        <div className="stat-card stat-card--warn">
          <span className="stat-card__label">Failures</span>
          <strong className="stat-card__value">{stats.errors}</strong>
        </div>
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">Avg duration</span>
          <strong className="stat-card__value">{stats.avgMs} ms</strong>
        </div>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="card table-card">
        {loading ? (
          <div className="skeleton-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden>
              ◎
            </div>
            <h3>No runs yet</h3>
            <p>Ingest a trace with the SDK or run the toy agent example.</p>
            <code className="empty-state__cmd">pnpm --filter @agenttrace/toy-agent start</code>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Version</th>
                <th>Input hash</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Link className="row-link" to={`/runs/${run.id}`}>
                      <span className="row-link__icon" aria-hidden>
                        →
                      </span>
                      {run.agent_name}
                    </Link>
                  </td>
                  <td>
                    <span className="mono tag-version">v{run.agent_version}</span>
                  </td>
                  <td>
                    <code className="hash-chip mono" title={run.input_hash}>
                      {truncateHash(run.input_hash)}
                    </code>
                  </td>
                  <td>
                    <StatusPill status={run.status} size="sm" />
                  </td>
                  <td>
                    <span className="duration-cell">{run.duration_ms} ms</span>
                  </td>
                  <td className="muted">{new Date(run.started_at).toLocaleString()}</td>
                  <td>
                    <Link className="compare-link" to={compareUrl(run)}>
                      Compare
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
