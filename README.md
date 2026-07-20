# Personal-CRM — Relationship Intelligence

Internal "Relationship Intelligence" CRM for Acme Games' **MGT** (Mobile Game Tech) Systems Team.
It tracks the relationships, interactions, and commitments between MGT and the game/partner teams
it supports — and is being built so all of it becomes searchable through AI.

**Status:** Active development — real 3-tier app running locally; MGT data imported; UI OIDC
auth implemented; production internal deployment (K8s + RDS + Acme Auth) is the next milestone.

> This is a **real application** (React + Go + PostgreSQL), not the old static prototype. The
> The original static prototype has been retired from this repo; the app below is the real thing.

---

## What it does

MGT provides shared infrastructure and platform tech (ZDK, LaunchPad, CI/CD, databases,
observability) to the studios and game teams across Acme Games. The relationships, meetings, and
commitments around that work used to live in people's heads, scattered notes, and Slack channels.
This app turns that into structured, queryable institutional knowledge.

- **Log interactions** — capture meetings, calls, emails, Slack threads, and other touchpoints
  against a customer, with notes, tags, MGT attendees, external attendees, a **sentiment indicator**
  (Positive / Neutral / Negative), and **action items (commitments)**. New customers, MGT people,
  and external contacts can be created **inline** while logging via a type-ahead
  [AttendeePicker](ui/src/app/AttendeePicker.tsx) — no leaving the form.
- **Commitments / action items** — each action item is a structured commitment with an **owner**, a
  **due date**, and a **status** (Open → In Progress → Closed). Status is editable inline, and open
  counts surface on interaction cards and in the activity feed.
- **Customer profiles** — a 360° view of each customer: org hierarchy (Acme Games → Subdivision → Studio
  → Customer), app status, primary Slack channel, contacts, full interaction history, and
  relationship (team) notes. New subdivisions, studios, and app statuses can be added inline.
- **Customers directory** — card grid with search and subdivision / studio / app-status filters.
- **Contacts directory** — add, edit, and bulk-import contacts via CSV, with search, filtering,
  sortable columns, and CSV export.
- **Activity feed** — KPI strip plus a two-column feed of recent interactions across every customer,
  with "Most active" and "Commitments due soon" side cards. Long interaction notes preserve their
  original formatting and collapse to a few lines with an inline **Show more / Show less** toggle.
- **Audit log** — every write (create/update/status change/note) is recorded with actor, timestamp,
  record, and detail; filterable, with CSV export.
- **AI Search** — *(UI placeholder, "Coming soon")* the page that will answer natural-language
  questions ("What has MGT committed to for Frontier Quest 3 this quarter?") synthesized from everything
  logged, with citations. The OpenAI-compatible provider plumbing already exists (configure it in
  **Settings**; **Test Connection** works), but the search results UI is not wired up yet.

The app intentionally has **zero external integration dependencies** to deliver value — no Jira,
Slack, PagerDuty, or Airtable hookups required. Support ticketing, SLA tracking, and routing are
part of the longer-term vision (see [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md)) but are
**deferred** beyond this phase.

### Organizational model

Customers sit at the leaf of a four-level hierarchy:

```
Acme Games (publisher)
  └── Subdivision        e.g. Nova, Vertex
        └── Studio       e.g. Atlas Studio, Halcyon Games, Vertex Casino & Cards
              └── Customer (game / project)   e.g. Frontier Quest 3, Acme Poker
```

Each customer carries an **App Status** (Prototype, Pre-Production, Production, Soft Launch, Live
Worldwide, Sunsetting, Sunset — extendable inline).

All users are MGT-internal with the **same full capabilities** — there is no role switcher and no
role-gated screens. Access is gated by Acme Auth login (every Acme Games employee can authenticate);
SSO-group-based authorization is part of the production vision, not a current feature.

---

## Architecture

A real three-tier application, orchestrated for local dev with Docker Compose:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  ui         │     │  api        │     │  db              │
│  React +    │ ──▶ │  Go         │ ──▶ │  postgres:16     │
│  Vite + TS  │     │  (pgx/v5)   │     │                  │
│  :5173      │     │  :8080      │     │  :5432           │
└─────────────┘     └─────────────┘     └──────────────────┘
      │                    ▲
      │   OIDC (Acme Auth) │  JWT validated via Acme Auth JWKS
      └────────────────────┘  (bypassed in local dev when unconfigured)
```

- **`ui/`** — React + Vite + TypeScript SPA. It talks to the backend **only** through the typed
  `CRM.*` client in [`ui/src/api/client.ts`](ui/src/api/client.ts). Screens live in
  `ui/src/screens/`, the app shell/contexts in `ui/src/app/` and `ui/src/crm/`, auth in
  `ui/src/auth/`, and the design system in [`ui/src/styles.css`](ui/src/styles.css). Dev server on
  `:5173`.
- **`api/`** — Go API using `pgx/v5`. Thin HTTP handlers (`internal/api`), Acme Auth JWT middleware
  (`internal/auth`), config from env (`internal/config`), and embedded SQL migrations
  (`internal/db/migrations`). REST endpoints mirror the `CRM.*` shapes. Serves `:8080`
  (`/api/*`, `/healthz`).
- **`db`** — PostgreSQL 16. Data persists in the `postgres_data` Docker volume.

The UI never `fetch`es anywhere except through `CRM.*`. The Go handlers stay thin and share helpers
(`writeJSON`, `decodeJSON`, `audit`).

---

## Quick start (local development)

```bash
docker compose up --build -d   # start ui + api + db
docker compose ps              # check health
docker compose logs -f api     # tail API logs
```

- **UI:** http://localhost:5173
- **API:** http://localhost:8080 (`/api/stats`, `/healthz`)
- **Postgres:** localhost:5432 (`personal_crm` / `personal_crm_dev`)

DB data persists in the `postgres_data` volume; services use `restart: unless-stopped`. Run SQL
against the DB:

```bash
docker compose cp file.sql db:/tmp/file.sql
docker compose exec -T db psql -U personal_crm_dev -d personal_crm -v ON_ERROR_STOP=1 -f /tmp/file.sql
```

### Auth in local dev

Both tiers run in **dev-bypass** by default so you don't need a Acme Auth connection day-to-day:

- **UI:** when `VITE_ACME_AUTH_ISSUER` is empty, the app skips OIDC and injects a synthetic
  "Local Dev" user.
- **API:** when `ACME_AUTH_JWKS_URL` is empty, the middleware skips JWT validation and treats all
  requests as authenticated.

To exercise the real OIDC flow locally, set `ACME_AUTH_ISSUER` (UI + API) and `ACME_AUTH_JWKS_URL`
(API) in your environment before `docker compose up`. See
[`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) for the full auth setup.

### Common commands

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

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the UI (lint + type-check + test +
build) and API (fmt + vet + build + test) gates on every push/PR. Keep them green.

---

## Authentication (Acme Auth / OIDC)

The UI implements OIDC against **Acme Auth** (Acme Games' internal OIDC broker, issuer
`https://auth.acme.example.com`, public client `personal-crm-local`) **with no third-party library**:

- **Authorization Code flow with PKCE** (public client, no secret), scopes
  `openid profile email groups offline_access`.
- Tokens stored in **`sessionStorage`** (never `localStorage` or cookies).
- **Automatic refresh** ~45s before access-token expiry using the refresh token.
- JWT payload is **parsed locally** (base64) for `email`, `name`, and `groups` — no separate
  userinfo call for display.
- `client.ts` attaches `Authorization: Bearer <token>` and, on a `401`, **refreshes once** before
  redirecting to `/login`.
- Logout revokes the refresh token, then returns to `/login`.

Implementation: [`ui/src/auth/`](ui/src/auth/) — `pkce.ts`, `tokens.ts` (sessionStorage),
`jwt.ts`, `oidc.ts`, `AuthContext.tsx` (auto-refresh + dev bypass), plus
[`LoginScreen`](ui/src/screens/LoginScreen.tsx) and
[`CallbackScreen`](ui/src/screens/CallbackScreen.tsx) (code exchange, pre-auth path restore, CSRF
state check).

On the API, the [`internal/auth`](api/internal/auth) middleware validates JWTs against Acme Auth's
JWKS endpoint and runs in **dev-bypass** when `ACME_AUTH_JWKS_URL` is unset. Enable it by setting
that variable (plus `ACME_AUTH_ISSUER` / `ACME_AUTH_AUDIENCE`) in the API container env.

---

## Design system

The UI was rebuilt on a deliberate, token-driven design system — *"calm, sharp, premium
power-tool"* — defined in [`ui/src/styles.css`](ui/src/styles.css). Reuse these tokens and component
classes rather than inventing new styles.

- **Color** — an `oklch` palette of warm-slate neutrals (`--canvas`, `--surface`, `--ink…`,
  `--line…`), a single confident blue accent (`--accent`, `--accent-wash`, `--accent-ring`), a brand
  red reserved for the logo mark + critical states (`--brand`, `--crit`), and a muted, shared-chroma
  **status** scale (`--st-live`, `--st-prod`, `--st-soft`, `--st-pre`, `--st-proto`,
  `--st-sunsetting`, `--st-sunset`). The sidebar uses its own deep-slate ramp (`--rail…`).
- **Typography** — **Hanken Grotesk** for UI text and **DM Mono** for IDs, counts, and code-like
  values (`--font`, `--mono`).
- **Geometry & depth** — an 8px spacing rhythm; radii `--r-sm`/`--r`/`--r-lg`/`--r-xl`; three
  shadow tiers (`--shadow-sm`/`--shadow`/`--shadow-lg`); a fixed 248px sidebar rail and 60px topbar.
- **Layout shell** — fixed topbar (brand mark, global search → AI, notifications, user avatar, sign
  out) + sectioned sidebar rail (Workspace / Relationships / Admin) with icons and live counts, over
  a responsive `main` content area. Grid screens use `minmax(0, 1fr)` tracks so they rescale to the
  viewport instead of overflowing.
- **Components** — shared primitives in [`ui/src/app/ui.tsx`](ui/src/app/ui.tsx) (status dot +
  label, icon-led interaction-type chip, color-coded sentiment badge, clamped notes with
  expand/collapse, action-status menu, empty state) and a
  [Lucide-style inline icon set](ui/src/app/icons.tsx). Display helpers
  (monograms, name-derived gradients, initials, relative/short dates) live in
  [`ui/src/crm/helpers.ts`](ui/src/crm/helpers.ts).
- **Conventions** — status dots are driven by `data-s` attributes and interaction types by `data-t`;
  animations are gated behind `@media (prefers-reduced-motion: no-preference)`.

---

## Repo layout

```
api/                 Go API (pgx/v5). Handlers in internal/api, auth in internal/auth,
                     config in internal/config, DB + embedded migrations in internal/db.
                     Entry: api/main.go (serves :8080). Migration CLI in api/cmd/migrate.
ui/                  React + Vite + TypeScript SPA. Talks ONLY through ui/src/api/client.ts.
                     Screens in src/screens, shell/contexts in src/app + src/crm, auth in
                     src/auth, design system in src/styles.css. Dev server :5173.
tools/import/        Python ETL example: extract_*.py read a source spreadsheet -> reviewable
                     CSVs; load_*.py emit idempotent upsert SQL. Included as a reference
                     implementation — no sample workbook ships with this repo. (data/ is
                     git-ignored.)
docs/                TECHNICAL_PLAN.md (product/architecture/roadmap),
                     INFRASTRUCTURE.md (local dev + deploy spec).
docker-compose.yml   Orchestrates ui + api + db (Postgres 16).
AGENTS.md            Guidance for developers and AI coding agents — read first.
```

---

## Data model

The Postgres schema (migrations in
[`api/internal/db/migrations/`](api/internal/db/migrations/)) and its TypeScript mirror
([`ui/src/api/types.ts`](ui/src/api/types.ts)):

| Entity | Notes |
|---|---|
| `subdivisions` | Org level under the Acme Games publisher |
| `studios` | Belong to a subdivision (`subdivision_id`) |
| `customers` | Game/project (leaf); `studio_id`, `app_status`, `slack_channel`, `services[]` |
| `app_statuses` | Lifecycle statuses (key/label/badge/position), extendable inline |
| `pods` | MGT-internal teams |
| `engineers` | MGT people (interaction loggers / internal attendees), grouped by pod |
| `contacts` | People at a customer (`customer_id`, email, slack, role) |
| `interactions` | type / title / date / notes / **sentiment** (`positive`/`neutral`/`negative`) / tags / `customer_id` / `logged_by` |
| `interaction_attendees_mgt` | Interaction ↔ engineer join |
| `interaction_attendees_external` | Interaction ↔ contact join |
| `action_items` | Commitments: text, owner, due date, status (`open`/`in-progress`/`closed`) |
| `team_notes` | Per-customer relationship notes (author + timestamp) |
| `audit_log` | Actor, action, record type/id, detail, timestamp |

### Data

This repo ships with no data of its own baked into version control. For a quick look at the app,
set `SEED_DATA=true` to load the synthetic demo dataset in [`api/internal/seed/seed.sql`](api/internal/seed/seed.sql)
(fictional teams, studios, and interactions — same shape as production data, none of it real).

`tools/import/` is included as a reference implementation of the ETL pattern used to bring real
operational data in from a spreadsheet (idempotent slug IDs, `ON CONFLICT DO UPDATE`). It expects
a workbook at `docs/Personal-CRM Data.xlsx`, which is **not included** — point it at your own source
data if you want to run it. Everything under `data/` is git-ignored; nothing written there is ever
committed. See [`AGENTS.md`](AGENTS.md) for the import workflow.

---

## API surface

All routes require auth (Bearer JWT) except `/healthz`; in local dev auth is bypassed.

```
GET    /healthz
GET    /api/stats
GET    /api/customers            POST /api/customers
GET    /api/customers/{id}       PATCH /api/customers/{id}
POST   /api/customers/{id}/notes
GET    /api/contacts             POST /api/contacts        PATCH /api/contacts/{id}
GET    /api/interactions         POST /api/interactions
GET    /api/interactions/{id}    PATCH /api/interactions/{id}
PATCH  /api/interactions/{id}/action-items/{index}
GET    /api/subdivisions         POST /api/subdivisions
GET    /api/studios              POST /api/studios
GET    /api/app-statuses         POST /api/app-statuses
GET    /api/people               POST /api/people
GET    /api/pods
GET    /api/audit
```

---

## Screens

| Screen ID | Name | Section |
|---|---|---|
| `home` | Activity Feed | Workspace |
| `log` | Log Interaction | Workspace |
| `ai` | AI Search *(Coming soon placeholder)* | Workspace |
| `s06` | Customers (directory) | Relationships |
| `s05` | Customer Profile | Relationships |
| `contacts` | Contacts | Relationships |
| `settings` | Settings (AI provider config) | Admin |
| `s09` | Audit Log | Admin |

---

## Feature status

| Feature | Status |
|---|---|
| Log interaction (meeting / call / email / slack / other) | Working |
| Edit interactions | Working |
| Inline create of customers / MGT people / contacts while logging | Working |
| Type-ahead attendee picker (MGT + external) | Working |
| Action items as commitments (owner, due date, status), inline status changes | Working |
| Activity feed with live KPIs + side cards | Working |
| Interaction notes: preserved formatting + Show more/less | Working |
| Sentiment indicator per interaction (Positive / Neutral / Negative) | Working |
| Customers directory (card grid, search, filters) | Working |
| Customer profile (interactions / contacts / notes tabs) | Working |
| Customer add / edit with inline metadata creation | Working |
| Contacts directory (add / edit / CSV import + export / search / filter / sort) | Working |
| Relationship (team) notes | Working |
| Audit log (filter + CSV export) | Working |
| Settings / AI provider config (with Test Connection) | Working |
| New token-driven design system | Working |
| UI OIDC authentication (Acme Auth, PKCE) | Implemented (dev-bypass locally) |
| API JWT validation (Acme Auth JWKS) | Implemented (dev-bypass locally) |
| AI Search results UI | Placeholder ("Coming soon") |
| Data persistence | PostgreSQL (Docker volume locally) |
| Production deployment (K8s + RDS + Acme Auth) | Planned — see `docs/INFRASTRUCTURE.md` |
| Support tickets / SLA / routing; Jira / Slack / PagerDuty | Deferred (long-term vision) |

See [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md) for the full roadmap.

---

## Source & deployment

- **Remote:** `origin` = `github.com/stlevy53/Personal-CRM`.
- This repo ships with synthetic demo data only — no production data is ever committed (`data/`
  stays out of version control; see `.gitignore`).
- GitHub Pages **cannot** host this app (it needs the Go API + Postgres). A production deployment
  sketch (Kubernetes + RDS + OIDC) is in [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md). The
  app currently runs locally only.
- Shell is Windows PowerShell: no `&&` chaining, no heredocs. Commit only when asked; keep `data/`
  out of commits.
