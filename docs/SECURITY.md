# Security notes (MVP / single-tenant)

## API key

- Set a strong `AGENTTRACE_API_KEY` in production.
- Comparison uses **constant-time** `timingSafeEqual` (see `apps/api/src/auth.ts`).

## CORS

- Configure allowed browser origins via `CORS_ORIGINS` (comma-separated).
- Default: local Vite dev URLs only.

## Request size

- `POST /v1/runs` is limited by `MAX_BODY_BYTES` (default 5MB) via `Content-Length` and parsed body size.

## Web app and secrets

The React app uses `VITE_API_KEY`, which is **embedded in the browser bundle**. This is acceptable for:

- Local development
- Single-tenant MVP behind a VPN or private network

**Not acceptable for public multi-user production.** Use one of:

- A **backend-for-frontend** that holds the API key server-side
- Session-based auth with scoped read-only tokens
- Network isolation (UI only reachable on internal network)

Do not commit real API keys; use `.env` (gitignored).

## Migrations

Schema changes are applied via versioned SQL files and recorded in `schema_migrations`. Run `pnpm db:migrate` after pulling API changes.
