# AGENTS.md — Personal-CRM

Guidance for developers and AI coding agents working in this repo. Read this first.

## What this is

Internal "Relationship Intelligence" CRM for Acme Games' MGT (Mobile Game Tech) Systems Team:
tracks interactions, contacts, and commitments between MGT and the game/partner teams it
supports, with AI search over the notes. It is a real 3-tier app (not the old static prototype).

## Repo layout

```
api/         Go API (pgx/v5). Handlers in internal/api, auth in internal/auth,
             DB + embedded migrations in internal/db. Entry: api/main.go. Serves :8080.
ui/          React + Vite + TypeScript SPA. Talks ONLY through ui/src/api/client.ts (CRM.*).
             Screens in src/screens, app shell/context in src/app + src/crm. Dev server :5173.
tools/import/ Python ETL example: extract_*.py read a source spreadsheet -> reviewable
             CSVs; load_*.py emit idempotent upsert SQL. See "Data import" below.
docs/        TECHNICAL_PLAN.md (product/architecture), INFRASTRUCTURE.md (deploy spec).
docker-compose.yml  Orchestrates ui + api + db (Postgres 16).
```

## Local development

```bash
docker compose up --build -d        # start ui + api + db
docker compose ps                   # health
docker compose logs -f api          # tail logs
```

- UI: http://localhost:5173 · API: http://localhost:8080 (`/api/stats`, `/healthz`) · Postgres: :5432
- DB data persists in the `postgres_data` volume; services use `restart: unless-stopped`.
- Run SQL against the DB:
  ```bash
  docker compose cp file.sql db:/tmp/file.sql
  docker compose exec -T db psql -U personal_crm_dev -d personal_crm -v ON_ERROR_STOP=1 -f /tmp/file.sql
  ```

## Common commands

| Task | Command |
|---|---|
| UI type-check | `docker compose exec -T ui npx tsc --noEmit` |
| UI lint | `docker compose exec -T ui npm run lint` |
| UI tests | `docker compose exec -T ui npm test` |
| UI build | `docker compose exec -T ui npm run build` |
| API build | `docker run --rm -v "${PWD}/api:/app" -w /app golang:1.22 go build ./...` |
| API vet | `docker run --rm -v "${PWD}/api:/app" -w /app golang:1.22 go vet ./...` |
| API tests | `docker run --rm -v "${PWD}/api:/app" -w /app golang:1.22 go test ./...` |
| API fmt check | `docker run --rm -v "${PWD}/api:/app" -w /app golang:1.22 gofmt -l .` |

CI (`.github/workflows/ci.yml`) runs the UI (lint + type-check + test + build) and API
(fmt + vet + build + test) gates on every push/PR. Keep them green.

## Data import workflow

`tools/import` turns the MGT spreadsheet into idempotent SQL (deterministic slug IDs,
`ON CONFLICT DO UPDATE`). Pattern: edit `data/<name>.csv` -> run the matching `load_*.py`
-> apply the generated SQL with `psql`.

- **Everything under `data/` is git-ignored** (real customer/personnel data + the source
  `.xlsx`). Never commit it; never expose it publicly.
- Some roster fixes live ONLY in `data/*.csv` (extra MGT people, a merged duplicate,
  contact→engineer reclassifications). Re-running `extract_*.py` regenerates those CSVs from
  the spreadsheet and will overwrite manual edits — re-apply them if you regenerate.

## Conventions

- TypeScript is strict; keep `tsc --noEmit` clean. The UI only calls the backend through the
  `CRM.*` client (`ui/src/api/client.ts`) — don't fetch elsewhere.
- Reuse the design system in `ui/src/styles.css` (CSS variables, badge/btn/form classes).
- Don't add comments that just narrate code; explain non-obvious intent only.
- Go: handlers are thin; share helpers in `internal/api` (`writeJSON`, `decodeJSON`, `audit`).

## Git, remotes & environment

- **`origin` = `github.com/stlevy53/Personal-CRM` is the only remote.**
- Commit only when asked. `data/` stays out of commits — synthetic demo data only, no production
  data belongs in this repo.
- Shell is Windows PowerShell: no `&&` chaining, no heredocs. Use specialized file tools, and
  `rg`/Grep instead of `grep`.

## Auth status

Not implemented yet. A placeholder `CURRENT_USER` ("mp") still backs the top-nav avatar and
team-note authorship; new interactions save with an empty logger. Acme Auth (UI OIDC + API
JWKS, see `docs/INFRASTRUCTURE.md`) will replace this. The API auth middleware
(`api/internal/auth`) runs in dev-bypass when no JWKS URL is configured.
