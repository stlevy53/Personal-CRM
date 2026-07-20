# Personal-CRM — Infrastructure Guide

**Version:** 2.0
**Status:** Local 3-tier app built & running (Docker Compose). This is a personal, single-user
tool — there is no production deployment plan beyond "run it on a machine you control."

---

## Overview

1. [Local Development — Docker Compose](#1-local-development--docker-compose)
2. [Container Architecture](#2-container-architecture)
3. [Database Schema & Migrations](#3-database-schema--migrations)
4. [Authentication — Optional OIDC](#4-authentication--optional-oidc)
5. [If you ever want to deploy this somewhere else](#5-if-you-ever-want-to-deploy-this-somewhere-else)

---

## 1. Local Development — Docker Compose

The local dev environment is a Docker Compose stack of three containers.

### Stack

```
┌──────────────────────────────────────────────────────────┐
│  Docker Compose (local)                                  │
│                                                          │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐ │
│  │  ui        │   │  api       │   │  db              │ │
│  │  React+Vite│──▶│  Go pgx/v5 │──▶│  postgres:16     │ │
│  │  :5173     │   │  :8080     │   │  :5432           │ │
│  └────────────┘   └────────────┘   └──────────────────┘ │
│       ▲                 │                                │
│       │       (JWKS validation, optional —                │
│       │        bypassed by default in local dev)          │
└──────────────────────────────────────────────────────────┘
```

### `docker-compose.yml`

Three services. Key facts as actually configured (the real file is the source of truth if these
ever drift — see [`../docker-compose.yml`](../docker-compose.yml)):

- **`db`** — `postgres:16`, `restart: unless-stopped`, named volume `postgres_data`, healthcheck via
  `pg_isready`. Defaults: DB `personal_crm`, user `personal_crm_dev`, password `devpassword` (all overridable).
- **`api`** — built from `./api`; env includes `DATABASE_URL`, `PORT=8080`, `CORS_ORIGINS`
  (default `http://localhost:5173`), `SEED_DATA` (default `false`), and the optional auth vars
  (`ACME_AUTH_JWKS_URL` / `ACME_AUTH_ISSUER` / `ACME_AUTH_AUDIENCE`, **empty ⇒ auth bypassed**).
  Waits for the DB healthcheck.
- **`ui`** — runs the **Vite dev server** in a `node:20-alpine` container
  (`npm install && npm run dev -- --host 0.0.0.0 --port 5173`) with the repo bind-mounted for HMR.
  Env: `VITE_API_URL` (default `http://localhost:8080`),
  `VITE_ACME_AUTH_ISSUER` (**empty ⇒ UI auth bypassed**, synthetic "Local Dev" user), and
  `VITE_ACME_AUTH_CLIENT_ID` (default `personal-crm-local`). Published on `:5173`.

> The env var names still carry an `ACME_AUTH_*` prefix from how this repo started life; they're
> just names at this point — point them at whatever OIDC provider you want, if any.

> The nginx-based UI **Dockerfile** in Section 2 is the **production build** image. Local dev uses
> the Vite dev server shown above, not nginx.

### Running locally

```bash
# Build images and bring up the stack
docker compose up --build -d

# Check health / tail logs
docker compose ps
docker compose logs -f api

# Stop
docker compose down
```

Migrations are **embedded in the API binary and applied automatically at startup**
(`api/internal/db`). A standalone migration CLI also exists at `api/cmd/migrate` if you need to run
them manually.

### Dev auth bypass (both tiers)

Local dev runs with auth bypassed on both tiers by default:

- **API:** if `ACME_AUTH_JWKS_URL` is empty, the Go middleware skips JWT validation and treats all
  requests as authenticated.
- **UI:** if `VITE_ACME_AUTH_ISSUER` is empty, the app skips the OIDC redirect and injects a
  synthetic "Local Dev" user.

To exercise the real OIDC flow, set `ACME_AUTH_ISSUER` (UI + API), `ACME_AUTH_JWKS_URL` (API),
and optionally `ACME_AUTH_AUDIENCE` before `docker compose up`. This only matters if you deploy
somewhere reachable by more than just you.

---

## 2. Container Architecture

### UI — React

```
ui/
├── Dockerfile          # production (nginx) image; local dev uses the Vite dev server
├── package.json
├── vite.config.ts
└── src/
    ├── screens/        # One component per screen (ActivityFeed, CompanyProfile, …)
    ├── app/            # Shell + shared UI: Layout, Modal, nav, icons, ui primitives, toast
    ├── crm/            # CrmContext, helpers, ai (OpenAI-compatible client)
    ├── auth/            # Optional OIDC (pkce, tokens, jwt, oidc, AuthContext) — no library
    ├── api/            # client.ts (the only backend entry point) + types.ts
    └── styles.css      # token-driven design system
```

**Dockerfile (UI):**

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

The nginx config proxies `/api/*` to the API service. The UI itself is a standard React SPA with client-side routing.

### API — Go

```
api/
├── Dockerfile
├── go.mod
├── main.go
├── internal/
│   ├── api/           # Thin HTTP handlers per resource + shared helpers (writeJSON, audit, CORS)
│   ├── auth/          # JWKS middleware (dev-bypass when unconfigured)
│   ├── config/        # Env-based runtime config
│   ├── db/            # pgx pool, migrate runner, and embedded migrations/
│   └── seed/          # Optional demo seed (SEED_DATA=true; retired by default)
└── cmd/
    └── migrate/       # Standalone migration runner binary
```

**Dockerfile (API):**

```dockerfile
# Build stage
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /api ./main.go
RUN go build -o /migrate ./cmd/migrate/main.go

# Runtime stage
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /api /api
COPY --from=build /migrate /migrate
COPY --from=build /app/internal/migrations /migrations
EXPOSE 8080
CMD ["/api"]
```

---

## 3. Database Schema & Migrations

### Migration tool

Migrations use **[golang-migrate](https://github.com/golang-migrate/migrate)**-style paired
`.up.sql` / `.down.sql` files, embedded into the Go binary and applied at startup (or via the
`migrate` CLI).

```
api/internal/db/migrations/
├── 000001_init.up.sql          -- full schema: all tables (customers, contacts, interactions, …)
├── 000001_init.down.sql
├── 000002_interaction_sentiment.up.sql   -- ADD COLUMN sentiment (positive|neutral|negative)
└── 000002_interaction_sentiment.down.sql
```

### Core schema

See [`api/internal/db/migrations/000001_init.up.sql`](../api/internal/db/migrations/000001_init.up.sql)
for the authoritative, current schema — it's the source of truth rather than a copy here. In
short: an optional two-level grouping (`subdivisions` → `studios`) above `customers` (the
company/opportunity you're tracking), `contacts` nested under a customer, `interactions` logged
against a customer with `action_items` and a `sentiment` field, free-form `team_notes`, and an
`audit_log`.

### Migration workflow

```bash
# Apply all pending migrations (run locally via docker compose or in CI)
docker compose exec api ./migrate up

# Roll back the last migration
docker compose exec api ./migrate down 1

# Check current migration version
docker compose exec api ./migrate version
```

---

## 4. Authentication — Optional OIDC

Auth is **off by default** for local, single-user use. The plumbing exists if you ever deploy
this somewhere network-reachable and want to gate access behind a real identity provider.

### 4.1 UI — OIDC Authorization Code Flow

```
User                     React App                  OIDC Provider
 │                           │                           │
 │  Navigate to /            │                           │
 │──────────────────────────▶│                           │
 │                           │  Check session token      │
 │                           │  (none / expired)         │
 │                           │                           │
 │                           │  Redirect to provider      │
 │                           │──────────────────────────▶│
 │                           │                           │  SSO login
 │                           │                           │◀──────────────
 │                           │  Authorization code       │
 │◀──────────────────────────────────────────────────────│
 │  Redirect back to app     │                           │
 │──────────────────────────▶│                           │
 │                           │  Exchange code for tokens │
 │                           │──────────────────────────▶│
 │                           │  ID token + Access token  │
 │                           │◀──────────────────────────│
 │                           │  Store access token       │
 │                           │  (sessionStorage)          │
 │  Render app               │                           │
 │◀──────────────────────────│                           │
```

**As built (no third-party OIDC library):** the flow is implemented directly with `fetch` in
[`../ui/src/auth/`](../ui/src/auth/):

- `pkce.ts` — PKCE code verifier/challenge generation.
- `oidc.ts` — build the authorize URL, exchange the code for tokens, refresh, and revoke.
- `tokens.ts` — persist tokens in **`sessionStorage`** (never `localStorage`/cookies).
- `jwt.ts` — base64-decode the JWT payload locally for `email` / `name` / `groups`.
- `AuthContext.tsx` — holds the user, auto-refreshes ~45s before expiry, exposes `login`/`logout`,
  and applies the **dev bypass** (synthetic user) when `VITE_ACME_AUTH_ISSUER` is empty.
- [`LoginScreen`](../ui/src/screens/LoginScreen.tsx) / [`CallbackScreen`](../ui/src/screens/CallbackScreen.tsx)
  handle the redirect, code exchange, CSRF `state` check, and pre-auth path restore.

Config comes from **Vite** env vars (`VITE_ACME_AUTH_ISSUER`, `VITE_ACME_AUTH_CLIENT_ID`,
`VITE_API_URL`) — not `REACT_APP_*`. Flow: **Authorization Code + PKCE**, public client
`personal-crm-local`, scopes `openid profile email groups offline_access`, redirect URI
`<origin>/callback`.

All API calls go through [`../ui/src/api/client.ts`](../ui/src/api/client.ts), which attaches
`Authorization: Bearer <access_token>` and, on a `401`, **refreshes once** before redirecting to
`/login`.

### 4.2 API — JWT Validation via JWKS

The Go API validates every inbound JWT using a configured JWKS endpoint when one is set
(**as built**: [`../api/internal/auth/auth.go`](../api/internal/auth/auth.go), constructor
`auth.New(jwksURL, issuer, audience)`, using `MicahParks/keyfunc/v2` + `golang-jwt/v5`). It
validates `exp` always, plus `iss` and `aud` when configured. In dev-bypass (empty JWKS URL) it
injects a synthetic `Local Dev` user. `auth.ActorID(ctx)` resolves the audit actor (email → sub →
`system`), and `/healthz` reports `authEnabled`. `/healthz` is the only unauthenticated route;
everything under `/api/` requires the middleware.

---

## 5. If you ever want to deploy this somewhere else

This is built and tested for local Docker Compose use only — that's the intended deployment for a
personal tool. If you later want it reachable from another device, the pieces are already
container-shaped (`api/Dockerfile`, `ui/Dockerfile`) and would run behind any Postgres-backed
host (a small VPS, a home server, etc.). At minimum you'd want to:

- Turn on real OIDC (Section 4) instead of relying on dev-bypass, since the app would no longer
  be reachable only from your own machine.
- Point `DATABASE_URL` at a real, backed-up Postgres instance instead of the local Docker volume.
- Terminate TLS in front of it (a reverse proxy is enough — nothing in this app assumes a
  particular cloud provider).

There's no further infrastructure plan beyond that; build it out if and when you actually need
it.
