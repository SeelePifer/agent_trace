# AgentTrace

Small TypeScript SDK and debugger for AI agent runs: execution trees, token/latency metadata, **playback replay**, and version comparison. Single-tenant, API-first ingestion into PostgreSQL.

## Stack

- `@agenttrace/sdk` — trace `run`, `withLlm`, `withTool`, optional OTLP export
- `@agenttrace/api` — Hono REST API
- `@agenttrace/web` — React trace explorer
- `examples/toy-agent` — demo agent (success + failure)

## Quick start

1. **Install dependencies**

   ```bash
   pnpm install
   pnpm build
   ```

2. **Start PostgreSQL**

   ```bash
   docker compose up -d
   cp .env.example .env   # repo root — API and migrate load this file
   pnpm db:migrate
   ```

3. **Run API and web**

   ```bash
   pnpm --filter @agenttrace/api dev
   pnpm --filter @agenttrace/web dev
   ```

4. **Ingest demo runs**

   ```bash
   pnpm --filter @agenttrace/toy-agent start
   pnpm --filter @agenttrace/toy-agent start:fail
   ```

5. Open [http://localhost:5173](http://localhost:5173) — inspect runs, playback captures, compare `1.0.0` vs `1.1.0` using the run `input_hash` from the API.

**Full walkthrough:** [docs/HOW_TO_USE.md](./docs/HOW_TO_USE.md) (SDK, playback, **Compare versions**, API examples).

## Environment

| Variable                        | Description                |
| ------------------------------- | -------------------------- |
| `DATABASE_URL`                  | Postgres connection string |
| `AGENTTRACE_API_KEY`            | Bearer token for API       |
| `AGENTTRACE_API_URL`            | SDK / toy agent ingest URL |
| `VITE_API_URL` / `VITE_API_KEY` | Web app API settings       |
| `RETENTION_DAYS`                | TTL for `pnpm retention:run` |
| `INGEST_RATE_LIMIT_PER_MINUTE`  | Per-key ingest rate limit    |
| `REDACT_CAPTURES`               | Server-side PII scrub on ingest |

## API (MVP)

- `POST /v1/runs` — ingest a completed run
- `POST /v1/runs/stream` — chunked ingest (`final` on last batch)
- `GET /openapi.json` — OpenAPI 3.1 description
- `GET /v1/runs` — list runs
- `GET /v1/runs/:id` — run + span tree
- `POST /v1/replay/:id` — **playback** steps from recorded captures
- `POST /v1/compare` — structural diff for same `input_hash`, two versions

## Tests

```bash
pnpm test                    # unit tests + web Playwright smoke (after build)
# first time only: pnpm --filter @agenttrace/web exec playwright install chromium
pnpm test:integration        # needs DATABASE_URL (see CI job)
pnpm retention:run           # delete runs older than RETENTION_DAYS
```

`pnpm lint` runs ESLint + TypeScript; `pnpm format` checks Prettier.

## CI

On push/PR to `main`, GitHub Actions runs lint (ESLint + `tsc`), Prettier, build, unit tests, and a Postgres-backed integration job (`pnpm test:integration`). See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Design choices (MVP)

- TypeScript only
- Ingest via proprietary API (no OTel collector → Postgres)
- Playback replay (no live re-execution of tools/LLMs)
- Single tenant (one API key per deployment)
