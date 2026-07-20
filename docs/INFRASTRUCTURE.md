# Personal-CRM — Infrastructure Guide

**Version:** 1.1  
**Date:** June 2026  
**Status:** Local 3-tier app built & running (Docker Compose); production internal deployment (K8s + RDS) planned

> **Reality check:** Sections 1–4 now describe what is **actually built and running locally** (the
> Docker Compose stack, the real schema, and the as-implemented Acme Auth OIDC flow). Sections 5–6
> (K8s + Terraform + IAM) remain the **planned** production deployment. The authoritative local
> compose file is [`../docker-compose.yml`](../docker-compose.yml); reference snippets below mirror
> it but defer to the real file if they ever drift.

---

## Overview

This document covers the full infrastructure picture for Personal-CRM:

1. [Local Development — Docker Compose](#1-local-development--docker-compose)
2. [Container Architecture](#2-container-architecture)
3. [Database Schema & Migrations](#3-database-schema--migrations)
4. [Authentication — Acme Auth](#4-authentication--acme-auth)
5. [Production Deployment — K8s + Terraform](#5-production-deployment--k8s--terraform)
6. [IAM & Secrets — No Static Credentials](#6-iam--secrets--no-static-credentials)

---

## 1. Local Development — Docker Compose

The local dev environment is a Docker Compose stack of three containers that mirrors production as closely as possible.

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
│       │       (JWKS validation against                   │
│       │        Acme Auth in dev: bypassed                │
│       │        or pointed at Acme staging)               │
└──────────────────────────────────────────────────────────┘
```

### `docker-compose.yml` (mirrors the real file)

The real [`../docker-compose.yml`](../docker-compose.yml) runs three services. Key facts as actually
configured:

- **`db`** — `postgres:16`, `restart: unless-stopped`, named volume `postgres_data`, healthcheck via
  `pg_isready`. Defaults: DB `personal_crm`, user `personal_crm_dev`, password `devpassword` (all overridable).
- **`api`** — built from `./api`; env includes `DATABASE_URL`, `PORT=8080`, `CORS_ORIGINS`
  (default `http://localhost:5173`), `SEED_DATA` (default `false`), and the Acme Auth vars
  (`ACME_AUTH_JWKS_URL` / `ACME_AUTH_ISSUER` / `ACME_AUTH_AUDIENCE`, **empty ⇒ auth bypassed**).
  Waits for the DB healthcheck.
- **`ui`** — runs the **Vite dev server** in a `node:20-alpine` container
  (`npm install && npm run dev -- --host 0.0.0.0 --port 5173`) with the repo bind-mounted for HMR.
  Env: `VITE_API_URL` (default `http://localhost:8080`),
  `VITE_ACME_AUTH_ISSUER` (**empty ⇒ UI auth bypassed**, synthetic "Local Dev" user), and
  `VITE_ACME_AUTH_CLIENT_ID` (default `personal-crm-local`). Published on `:5173`.

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

Local dev runs with auth bypassed on both tiers so no Acme Auth connection is needed day-to-day:

- **API:** if `ACME_AUTH_JWKS_URL` is empty, the Go middleware skips JWT validation and treats all
  requests as authenticated.
- **UI:** if `VITE_ACME_AUTH_ISSUER` is empty, the app skips the OIDC redirect and injects a
  synthetic "Local Dev" user.

To exercise the real flow locally, set `ACME_AUTH_ISSUER` (UI + API), `ACME_AUTH_JWKS_URL` (API),
and optionally `ACME_AUTH_AUDIENCE` before `docker compose up`.

---

## 2. Container Architecture

### UI — React

```
ui/
├── Dockerfile          # production (nginx) image; local dev uses the Vite dev server
├── package.json
├── vite.config.ts
└── src/
    ├── screens/        # One component per screen (ActivityFeed, CustomerProfile, …)
    ├── app/            # Shell + shared UI: Layout, Modal, nav, icons, ui primitives, toast
    ├── crm/            # CrmContext, helpers, ai (OpenAI-compatible client)
    ├── auth/           # Acme Auth OIDC (pkce, tokens, jwt, oidc, AuthContext) — no library
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
│   ├── auth/          # Acme Auth JWKS middleware (dev-bypass when unconfigured)
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

Use **[golang-migrate](https://github.com/golang-migrate/migrate)** — it's the standard Go database migration library with a CLI and an embeddable library interface.

```
api/internal/db/migrations/
├── 000001_init.up.sql          -- full schema: all tables (customers, contacts, interactions, …)
├── 000001_init.down.sql
├── 000002_interaction_sentiment.up.sql   -- ADD COLUMN sentiment (positive|neutral|negative)
└── 000002_interaction_sentiment.down.sql
```

Each migration is a pair of `.up.sql` / `.down.sql` files. Migrations are embedded into the Go binary and applied at startup (or via the `migrate` CLI).

### Core schema

```sql
-- Org hierarchy
CREATE TABLE subdivisions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE studios (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    subdivision_id  TEXT NOT NULL REFERENCES subdivisions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers (game teams)
CREATE TABLE customers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    studio_id   TEXT NOT NULL REFERENCES studios(id),
    app_status  TEXT NOT NULL DEFAULT 'prototype',
    slack_channel TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE contacts (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT,
    slack         TEXT,
    role          TEXT,
    customer_id   TEXT NOT NULL REFERENCES customers(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interactions
CREATE TABLE interactions (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT NOT NULL REFERENCES customers(id),
    type         TEXT NOT NULL,  -- meeting, call, email, slack, other
    date         DATE NOT NULL,
    notes        TEXT,
    sentiment    TEXT NOT NULL DEFAULT 'neutral'  -- positive | neutral | negative
        CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    tags         TEXT[],
    created_by   TEXT NOT NULL,  -- user sub from JWT
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interaction_attendees (
    interaction_id  TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    contact_id      TEXT NOT NULL REFERENCES contacts(id),
    PRIMARY KEY (interaction_id, contact_id)
);

-- Action items / commitments
CREATE TABLE action_items (
    id              TEXT PRIMARY KEY,
    interaction_id  TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    owner_id        TEXT,          -- user sub or contact id
    due_date        DATE,
    status          TEXT NOT NULL DEFAULT 'open',  -- open, in-progress, closed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team notes
CREATE TABLE team_notes (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    text         TEXT NOT NULL,
    created_by   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
    id           TEXT PRIMARY KEY,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id     TEXT NOT NULL,
    action       TEXT NOT NULL,
    record_type  TEXT NOT NULL,
    record_id    TEXT NOT NULL,
    detail       TEXT
);

CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX idx_audit_log_record    ON audit_log (record_type, record_id);
```

### Migration workflow

```bash
# Apply all pending migrations (run locally via docker compose or in CI)
docker compose exec api ./migrate up

# Roll back the last migration
docker compose exec api ./migrate down 1

# Check current migration version
docker compose exec api ./migrate version
```

In production, migrations are applied as a pre-deploy step (K8s init container or CI job) before the new API version rolls out.

---

## 4. Authentication — Acme Auth

> Reference: [Acme Auth Web Integration](https://docs.acme.example.com/extending/auth-web-integration.html)

Acme Auth is Acme Games' internal OIDC broker backed by Okta. All Acme Games employees have access. It provides standard OIDC flows and mints JWTs that the API validates.

### 4.1 UI — OIDC Authorization Code Flow

```
User                     React App                  Acme Auth
 │                           │                           │
 │  Navigate to /            │                           │
 │──────────────────────────▶│                           │
 │                           │  Check session token      │
 │                           │  (none / expired)         │
 │                           │                           │
 │                           │  Redirect to Acme Auth    │
 │                           │──────────────────────────▶│
 │                           │                           │  Okta SSO login
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
 │                           │  (memory, not localStorage)│
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

The Go API validates every inbound JWT using Acme Auth's JWKS endpoint.

```go
// internal/auth/middleware.go
package auth

import (
    "context"
    "net/http"
    "strings"
    "time"

    "github.com/MicahParks/keyfunc/v2"
    "github.com/golang-jwt/jwt/v5"
)

type Middleware struct {
    jwks   *keyfunc.JWKS
    issuer string
}

func NewMiddleware(jwksURL, issuer string) (*Middleware, error) {
    options := keyfunc.Options{
        RefreshInterval: 1 * time.Hour,
        RefreshErrorHandler: func(err error) {
            // log JWKS refresh error
        },
    }
    jwks, err := keyfunc.Get(jwksURL, options)
    if err != nil {
        return nil, err
    }
    return &Middleware{jwks: jwks, issuer: issuer}, nil
}

func (m *Middleware) Require(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Dev bypass: if JWKS URL is not configured, skip validation
        if m.jwks == nil {
            next.ServeHTTP(w, r)
            return
        }

        authHeader := r.Header.Get("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

        token, err := jwt.Parse(tokenStr, m.jwks.Keyfunc,
            jwt.WithIssuer(m.issuer),
            jwt.WithExpirationRequired(),
        )
        if err != nil || !token.Valid {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        // Inject claims into context for handlers to use (e.g. audit logging)
        claims, _ := token.Claims.(jwt.MapClaims)
        ctx := context.WithValue(r.Context(), contextKeyUser, claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

Apply to all routes:

```go
// main.go (excerpt)
authMiddleware, err := auth.NewMiddleware(
    os.Getenv("ACME_AUTH_JWKS_URL"),
    os.Getenv("ACME_AUTH_ISSUER"),
)
mux.Handle("/api/", authMiddleware.Require(apiRouter))
```

**As built** ([`../api/internal/auth/auth.go`](../api/internal/auth/auth.go)): the constructor is
`auth.New(jwksURL, issuer, audience)` (uses `MicahParks/keyfunc/v2` + `golang-jwt/v5`). It validates
`exp` always, plus `iss` and `aud` when configured. In dev-bypass (empty JWKS URL) it injects a
synthetic `Local Dev` user. `auth.ActorID(ctx)` resolves the audit actor (email → sub → `system`),
and `/healthz` reports `authEnabled`. `/healthz` is the only unauthenticated route; everything under
`/api/` requires the middleware.

---

## 5. Production Deployment — K8s + Terraform

### Architecture

```
Acme Games Internal Network
  │
  ├── Kubernetes Cluster (MGT)
  │     ├── Deployment: personal-crm-ui
  │     │     └── Container: nginx + React build
  │     │           └── Service: ClusterIP → Ingress
  │     │
  │     └── Deployment: personal-crm-api
  │           └── Container: Go binary
  │                 └── Service: ClusterIP
  │                       └── IAM instance profile → RDS
  │
  └── AWS (via Terraform)
        └── RDS: PostgreSQL 16
              └── IAM auth enabled (no static password)
```

### Terraform responsibilities

An infra engineer manages the following with Terraform:

```hcl
# Managed resources (reference — not the final TF code)

# RDS instance
resource "aws_db_instance" "personal_crm" {
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.medium"
  db_name           = "personal_crm"
  iam_database_authentication_enabled = true  # No static password
  # ... subnet group, security groups, parameter group
}

# IAM role for the API pod (K8s service account → IAM role via IRSA or kube2iam)
resource "aws_iam_role" "personal_crm_api" {
  name = "personal-crm-api"
  # trust policy allows the K8s service account to assume this role
}

resource "aws_iam_role_policy" "personal_crm_rds" {
  role = aws_iam_role.personal_crm_api.id
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["rds-db:connect"]
      Resource = "arn:aws:rds-db:*:*:dbuser:${aws_db_instance.personal_crm.resource_id}/personal_crm_app"
    }]
  })
}
```

### IAM authentication to RDS (no static credentials)

The Go API connects to RDS using an IAM auth token instead of a username/password. The token is generated at runtime using the AWS SDK and is valid for 15 minutes. The connection string looks like:

```
host=<rds-endpoint> port=5432 dbname=personal_crm user=personal_crm_app
password=<iam-auth-token> sslmode=require
```

The API refreshes the token automatically before expiry. This means:
- No secrets in environment variables or K8s Secrets for the DB password
- Access is controlled entirely by IAM policy
- Credential rotation is automatic

### Deployment flow

```
1. Engineer merges PR to main
2. CI builds Docker images:
     docker build -t personal-crm-ui:$SHA ./ui
     docker build -t personal-crm-api:$SHA ./api
3. CI pushes images to Acme Games container registry
4. CI runs DB migrations against RDS (init container or migration job):
     ./migrate -database $DATABASE_URL up
5. CI deploys updated K8s Deployments (rolling update):
     kubectl set image deployment/personal-crm-api api=personal-crm-api:$SHA
     kubectl set image deployment/personal-crm-ui ui=personal-crm-ui:$SHA
6. K8s rolls out new pods; readiness probe gates traffic
```

---

## 6. IAM & Secrets — No Static Credentials

| Credential type | Local dev | Production |
|---|---|---|
| Database password | Static (docker-compose env var) | IAM auth token (generated at runtime) |
| Acme Auth client secret | `.env` file (not committed) | K8s Secret, injected as env var |
| AWS credentials | Not needed locally | IAM instance profile / IRSA |
| API keys (Slack, Jira) | `.env` file (not committed) | K8s Secret, injected as env var |

`.env.example` (committed; actual `.env` is gitignored):

```bash
# Acme Auth — get from Acme Auth app registration
ACME_AUTH_ISSUER=https://auth.acme.example.com
ACME_AUTH_JWKS_URL=https://auth.acme.example.com/.well-known/jwks.json
ACME_AUTH_CLIENT_ID=

# Leave empty to disable auth locally
# ACME_AUTH_JWKS_URL=
```

---

## 7. Migration Path — Status

The static HTML/vanilla-JS prototype has been fully replaced by the real stack. Current progress:

```
Phase 0:  HTML prototype, in-memory data, GitHub Pages            ✅ retired (design reference only)
          ↓
Phase 1:  Go API + Postgres (Docker Compose local)                ✅ DONE — schema in Section 3
          ↓
Phase 2:  React + Vite + TS UI replaces the HTML prototype        ✅ DONE — calls the Go API via CRM.*
          calls the Go API instead of in-memory CRM.*
          ↓
Phase 3:  Acme Auth wired into UI + API                           ✅ DONE (code; dev-bypass locally)
          K8s deployment by infra engineer                        ⏳ PLANNED (Section 5)
          RDS provisioned via Terraform                           ⏳ PLANNED (Section 5)
```

**Done:** the local 3-tier app runs end-to-end with MGT data; the UI talks only through the
typed `CRM.*` client (`ui/src/api/client.ts`); OIDC + JWKS auth are implemented on both tiers.

**Remaining (production internal deploy):** provision RDS + IAM via Terraform (Section 5–6), ship the
UI + API containers to the MGT Kubernetes cluster with ingress + internal DNS, run migrations
against RDS and load production data, and enable API JWT validation by setting `ACME_AUTH_JWKS_URL`
(plus issuer/audience) in the API deployment.

---

## Document History

| Version | Date | Notes |
|---|---|---|
| 1.0 | June 2026 | Initial — approved Acme Games infrastructure stack confirmed |
| 1.1 | June 2026 | Aligned Sections 1–4 with the **built** local stack: Vite dev-server UI on `:5173`, `VITE_*` env vars, real compose facts, as-built no-library OIDC flow + JWKS middleware, corrected `ui/`+`api/` directory trees, embedded auto-migrations, and migration-path status (Phases 0–3 done; deploy planned) |
