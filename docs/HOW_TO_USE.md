# AgentTrace — How to use

This guide covers the web UI, the toy agent demo, and the **Compare versions** workflow.

## Prerequisites

1. PostgreSQL running (`docker compose up -d`).
2. Migrations applied (`pnpm db:migrate`).
3. API and web running:

   ```bash
   pnpm --filter @agenttrace/api dev
   pnpm --filter @agenttrace/web dev
   ```

4. Root `.env` with `AGENTTRACE_API_KEY` and `DATABASE_URL`. Web needs `VITE_API_URL` and `VITE_API_KEY` (see `.env.example`).

---

## 1. Ingest agent runs (SDK)

Configure the SDK and wrap each agent execution in `run()`:

```typescript
import { configure, run, flush } from '@agenttrace/sdk';

configure({
  apiUrl: process.env.AGENTTRACE_API_URL,
  apiKey: process.env.AGENTTRACE_API_KEY,
  capture: 'always', // or 'on_error' in production
});

await run(
  {
    name: 'my-agent', // agent name (used in Compare)
    version: '1.0.0', // semver or git sha (used in Compare)
    input: { question: '...' }, // fixture — hashed for Compare
  },
  async ({ withLlm, withTool }) => {
    // wrap each LLM call and tool call
  },
);

await flush(); // send all queued traces to API (required before process exit)
```

Multiple `run()` calls queue traces; a single `flush()` uploads them **in order** without losing data.

**Important for Compare:** two runs are comparable only if they share:

| Field                  | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| Same `input` (fixture) | Same `input_hash` (SHA-256 of stable JSON) |
| Same `agent.name`      | e.g. `toy-agent`                           |
| Different `version`    | e.g. `1.0.0` vs `1.1.0`                    |

The SDK computes `input_hash` automatically on ingest. You do not need to pass it manually when tracing.

**Timestamps:** ingest schemas require ISO-8601 datetimes (SDK uses `Date.toISOString()` with `Z`). Offsets without `Z` may fail validation unless normalized client-side.

---

## 2. Toy agent demo (success + failure)

From the repo root:

```bash
pnpm --filter @agenttrace/toy-agent start        # version 1.0.0 — success
pnpm --filter @agenttrace/toy-agent start:fail   # version 1.1.0 — tool error
```

Both scripts use the **same** `input` object, so they produce the **same `input_hash`**, but different execution trees (the failure run stops at the tool).

---

## 3. Web UI — Runs

Open [http://localhost:5173](http://localhost:5173).

- **Runs** lists ingested traces. Filter by status (`ok` / `error`).
- Click a row to open the **execution tree**, timeline, and span detail panel.
- On the run page, copy **Input hash** — you need it for Compare.

---

## 4. Web UI — Playback

On a run detail page:

1. Select a span in the tree (or timeline).
2. Click **Playback from here**.
3. The panel shows recorded **capture** data (LLM messages/responses, tool args/results) — no live API calls.

Use this to debug where a failed run diverged without re-running the agent.

---

## 5. Compare versions (step by step)

Compare answers: _“For the same user input and agent name, how did version A’s span tree differ from version B’s?”_

### What it compares

- **Structure** — span kinds, names, order along each branch.
- **Status** — `ok` vs `error` at the same tree path.
- **Capture** — recorded LLM/tool payloads (arguments, results, messages) at the same path.

### Steps in the UI

1. Ingest **two** runs with:
   - identical fixture `input` (→ same `input_hash`),
   - same `agent.name`,
   - different `agent.version` (e.g. `1.0.0` and `1.1.0`).

2. Open either run and **copy Input hash** from the hero section.

3. Go to **Compare** in the sidebar.

4. Fill in:
   - **Agent name** — e.g. `toy-agent`
   - **Input hash** — pasted from step 2
   - **Version A** — e.g. `1.0.0`
   - **Version B** — e.g. `1.1.0`

5. Click **Run comparison**.

### Interpreting results

| Result                               | Meaning                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| “Trees match for this fixture pair.” | Same span structure for both versions (rare if behavior changed).                                                         |
| List of diff items                   | First structural mismatches (missing span, different tool name/order, etc.).                                              |
| Error “Missing run for comparison”   | No run stored for that `input_hash` + `agent_version` (+ optional `agent_name`). Ingest the missing version or fix typos. |

### Example with toy agent

After running both toy scripts:

```text
Agent name:  toy-agent
Version A:   1.0.0
Version B:   1.1.0
Input hash:  (copy from run detail — same for both toy runs)
```

You should see diffs where the failure run’s tree stops early or uses a different branch (e.g. tool error vs completed flow).

---

## 6. Compare via API

```bash
curl -s -X POST http://localhost:3001/v1/compare \
  -H "Authorization: Bearer dev-secret-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "toy-agent",
    "input_hash": "<paste-sha256-here>",
    "version_a": "1.0.0",
    "version_b": "1.1.0"
  }' | jq
```

Response includes `run_a`, `run_b`, `tree_a`, `tree_b`, and `diffs[]`.

`agent_name` is optional in the schema but **recommended** so you do not accidentally match another agent with the same hash.

---

## 7. Compute `input_hash` locally (optional)

If you need the hash before ingesting (e.g. in tests):

```typescript
import { hashInput } from '@agenttrace/shared';

const hash = hashInput({ question: 'What is the refund policy?' });
```

This must match the object you pass to `run({ input })` (stable key ordering is handled by `hashInput`).

---

## Troubleshooting

| Problem               | Fix                                                                        |
| --------------------- | -------------------------------------------------------------------------- |
| Compare returns 404   | Ensure both versions were ingested with the same `input` and `agent.name`. |
| Empty runs list       | Check API is up, `flush()` was called, and `AGENTTRACE_API_KEY` matches.   |
| Web cannot load runs  | Set `VITE_API_URL` and `VITE_API_KEY` in `.env`, restart Vite.             |
| Wrong hash in Compare | Copy hash from the API/run detail, not `trace_id`.                         |

---

## Quick reference

| Feature            | Where                                             |
| ------------------ | ------------------------------------------------- |
| List traces        | Web → Runs                                        |
| Tree + span detail | Web → click run                                   |
| Playback           | Run detail → select span → Playback               |
| Compare            | Web → Compare (needs `input_hash` + two versions) |
| Ingest             | SDK `flush()` → `POST /v1/runs`                   |
| Stream ingest      | `POST /v1/runs/stream` (chunks + `final`)         |
| OpenAPI            | `GET /openapi.json` on API                        |
| Retention          | `RETENTION_DAYS` + `pnpm retention:run`           |

---

## Streaming ingest (long runs)

Send span batches to `POST /v1/runs/stream` with the same `trace_id` and fixture fields:

- `final: false` on interim chunks (`ingest_state=streaming`)
- `final: true` on the last chunk (`ingest_state=complete`)

## Retention

Set `RETENTION_DAYS` in `.env` and run `pnpm retention:run` on a schedule in production.
