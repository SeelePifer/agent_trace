# Code review notes (AgentTrace MVP)

Internal review snapshot for maintainers. Prioritized: **P0** (fix soon), **P1** (next sprint), **P2** (nice to have).

## Strengths

- Clear monorepo split: `shared` schemas, thin SDK, API, web.
- Compare/replay/ingest flows are easy to follow.
- Zod validation on API boundaries.
- Toy agent gives a reproducible demo for Compare.
- Vitest coverage on hash stability, SDK ingest/nested spans/`on_error`, tree compare; Playwright web smoke with mocked API.

## P0 — Correctness & reliability

| Item                          | Location                             | Notes                                                                                                                        |
| ----------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| ~~Single pending run in SDK~~ | `packages/sdk/src/export.ts`         | **Fixed:** FIFO queue; `flush()` drains all pending runs.                                                                    |
| ~~OTel trace linkage~~        | `packages/sdk/src/run.ts`            | **Fixed:** ingest `trace_id` / root `span_id` come from OTel `spanContext()`; children use `context.with` parenting.         |
| ~~API error handling~~        | `apps/api/src/errors.ts`, `index.ts` | **Done:** `onError` + structured `logServerError`, `HTTPException`, `notFound`, stable JSON error codes; invalid JSON → 400. |
| ~~409 detection~~             | `errors.ts` `isUniqueViolation`      | **Done:** Postgres `23505` only (route + global handler).                                                                    |
| ~~`input_hash` integrity~~    | `packages/shared/schemas.ts`         | **Done:** sha256 hex format + `superRefine` vs `hashInput(input)`.                                                           |

## P1 — Security & ops

| Item                   | Notes                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| ~~API key comparison~~ | **Done:** `timingSafeEqual` in `auth.ts`.                               |
| ~~CORS~~               | **Done:** `CORS_ORIGINS` env (`apps/api/src/cors.ts`).                  |
| ~~Payload size~~       | **Done:** `MAX_BODY_BYTES` + `enforceBodyLimit` + parse size check.     |
| Secrets in web         | Documented in `docs/SECURITY.md` (MVP bundle key; BFF for prod).        |
| ~~Migrations~~         | **Done:** `schema_migrations` table + versioned runner in `migrate.ts`. |

## P1 — Product / UX

| Item                   | Notes                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| ~~Compare UI~~         | **Done:** side-by-side trees + capture JSON diff panels.           |
| ~~Runs list~~          | **Done:** truncated `input_hash` + Compare link with query params. |
| ~~Run detail loading~~ | **Done:** skeleton state.                                          |
| ~~Deep compare~~       | **Done:** `capture_a` / `capture_b` on diff items + UI.            |

## P1 — Code quality

| Item                          | Notes                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| ~~Duplicate `buildSpanTree`~~ | **Done:** `@agenttrace/shared` (`span-tree.ts`, `compare.ts`).        |
| ~~`insertRun` typing~~        | **Done:** `Pool` / `PoolClient` from `pg`.                            |
| ~~Zod `.datetime()`~~         | **Done:** documented in `HOW_TO_USE.md`.                              |
| ~~Nested spans timing~~       | **Done:** SDK sorts spans by `started_at`; API `ORDER BY started_at`. |

## P2 — Features (implemented)

- ~~CI integration tests~~ — `apps/api/src/integration/e2e.test.ts` + `integration` job in CI.
- ~~Retention~~ — `RETENTION_DAYS` + `pnpm retention:run`.
- ~~Redaction~~ — `@agenttrace/shared/redact` (SDK + API `REDACT_CAPTURES`).
- ~~Streaming ingest~~ — `POST /v1/runs/stream` with `final` flag + span upsert.
- ~~Rate limiting~~ — `INGEST_RATE_LIMIT_PER_MINUTE` on ingest routes.
- ~~OpenAPI~~ — `GET /openapi.json` (paths documented; request bodies mirror Zod schemas in `@agenttrace/shared`).
- ~~ESLint + Prettier~~ — root config; `pnpm lint` runs ESLint + package `tsc`.

## Testing gaps

- Optional: Playwright against a live API + Postgres (smoke tests mock `/v1/*` today).

## CI

Workflow: `.github/workflows/ci.yml` — unit job (`lint`, `build`, `test`) + `integration` job with Postgres.

## Suggested roadmap order

1. Shared `buildSpanTree` + API integration test (ingest → get → compare).
2. OTel context alignment + SDK run queue or explicit `flush` docs.
3. Compare UI: dual tree visualization.
4. Security hardening (body limit, timing-safe key, CORS env).
