import type { RunSummary, SpanNode } from '../api';

interface SpanDetailPanelProps {
  run: RunSummary | null;
  span: SpanNode | null;
  playback: string | null;
  onReplay: () => void;
  replayLoading: boolean;
}

function CaptureSection({ capture }: { capture: unknown }) {
  if (!capture || typeof capture !== 'object') {
    return null;
  }

  const record = capture as Record<string, unknown>;

  if (record.llm && typeof record.llm === 'object') {
    const llm = record.llm as Record<string, unknown>;
    return (
      <section className="detail-section">
        <h4>LLM capture</h4>
        {llm.model != null && llm.model !== '' && (
          <p className="detail-kv">
            <span>Model</span>
            <code>{String(llm.model)}</code>
          </p>
        )}
        {typeof llm.usage === 'object' && llm.usage !== null && (
          <p className="detail-kv">
            <span>Tokens</span>
            <code>
              in {(llm.usage as { input?: number }).input ?? 0} / out{' '}
              {(llm.usage as { output?: number }).output ?? 0}
            </code>
          </p>
        )}
        <details open>
          <summary>Messages</summary>
          <pre className="mono detail-pre">{JSON.stringify(llm.messages, null, 2)}</pre>
        </details>
        {llm.response !== undefined && (
          <details open>
            <summary>Response</summary>
            <pre className="mono detail-pre">{JSON.stringify(llm.response, null, 2)}</pre>
          </details>
        )}
      </section>
    );
  }

  if (record.tool && typeof record.tool === 'object') {
    const tool = record.tool as Record<string, unknown>;
    return (
      <section className="detail-section">
        <h4>Tool capture</h4>
        <p className="detail-kv">
          <span>Tool</span>
          <code>{String(tool.name ?? '—')}</code>
        </p>
        <details open>
          <summary>Arguments</summary>
          <pre className="mono detail-pre">{JSON.stringify(tool.arguments, null, 2)}</pre>
        </details>
        {tool.result !== undefined && (
          <details open>
            <summary>Result</summary>
            <pre className="mono detail-pre">{JSON.stringify(tool.result, null, 2)}</pre>
          </details>
        )}
        {tool.error != null && tool.error !== '' && (
          <p className="detail-error">{String(tool.error)}</p>
        )}
      </section>
    );
  }

  return (
    <section className="detail-section">
      <h4>Capture</h4>
      <pre className="mono detail-pre">{JSON.stringify(capture, null, 2)}</pre>
    </section>
  );
}

export function SpanDetailPanel({
  run,
  span,
  playback,
  onReplay,
  replayLoading,
}: SpanDetailPanelProps) {
  if (!span) {
    return (
      <div className="card detail-panel detail-panel--empty">
        <p>Select a node in the execution tree to inspect its span.</p>
      </div>
    );
  }

  const attrs = span.attributes ?? {};
  const attrEntries = Object.entries(attrs).filter(([key]) => !key.startsWith('gen_ai.usage'));

  return (
    <div className="card detail-panel">
      <header className="detail-header">
        <div>
          <h3>{span.name}</h3>
          <p className="detail-sub">
            <span className={`badge ${span.status === 'error' ? 'error' : ''}`}>{span.status}</span>
            <span className="detail-kind">{span.kind}</span>
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onReplay}
          disabled={replayLoading}
        >
          {replayLoading ? 'Loading…' : 'Playback from here'}
        </button>
      </header>

      <div className="detail-grid">
        <p className="detail-kv">
          <span>Span ID</span>
          <code className="detail-id">{span.span_id}</code>
        </p>
        <p className="detail-kv">
          <span>Duration</span>
          <code>{span.duration_ms} ms</code>
        </p>
        {span.started_at && (
          <p className="detail-kv">
            <span>Started</span>
            <code>{new Date(span.started_at).toLocaleString()}</code>
          </p>
        )}
        {run && (
          <p className="detail-kv">
            <span>Agent</span>
            <code>
              {run.agent_name} @ {run.agent_version}
            </code>
          </p>
        )}
      </div>

      {(attrs['gen_ai.usage.input_tokens'] !== undefined ||
        attrs['gen_ai.usage.output_tokens'] !== undefined) && (
        <section className="detail-section">
          <h4>Token usage</h4>
          <div className="token-bars">
            <div className="token-bar">
              <span>Input</span>
              <strong>{String(attrs['gen_ai.usage.input_tokens'])}</strong>
            </div>
            <div className="token-bar">
              <span>Output</span>
              <strong>{String(attrs['gen_ai.usage.output_tokens'])}</strong>
            </div>
          </div>
        </section>
      )}

      {span.capture != null && <CaptureSection capture={span.capture} />}

      {attrEntries.length > 0 && (
        <section className="detail-section">
          <h4>Attributes</h4>
          <dl className="attr-list">
            {attrEntries.map(([key, value]) => (
              <div key={key} className="attr-row">
                <dt>{key}</dt>
                <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {playback && (
        <section className="detail-section">
          <h4>Playback steps</h4>
          <pre className="mono detail-pre">{playback}</pre>
        </section>
      )}

      <details className="detail-raw">
        <summary>Raw span JSON</summary>
        <pre className="mono detail-pre">{JSON.stringify(span, null, 2)}</pre>
      </details>
    </div>
  );
}
