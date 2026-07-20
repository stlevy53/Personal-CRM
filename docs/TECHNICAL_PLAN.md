# Personal-CRM — Technical Plan

**Version:** 3.0
**Status:** Built as a real 3-tier app (React + Go + PostgreSQL), running locally. This document
covers what's actually implemented; there is no enterprise-scale roadmap beyond it — this is a
single-user personal tool.

---

## Overview

Personal-CRM is a **relationship intelligence** tool: structured logging of interactions,
contacts, and commitments so conversations don't live only in scattered notes, email, and chat
history. It's built for tracking personal relationships — job search / interview loops,
professional networking, freelance clients — where you're the only user.

It is implemented as a real three-tier application — a **React + Vite + TypeScript** UI, a
**Go (`pgx/v5`)** API, and **PostgreSQL 16**, orchestrated locally with Docker Compose. The UI
ships a token-driven design system and optional **OIDC (PKCE)** authentication (off by default);
the API has optional JWKS JWT validation. Each interaction carries a **sentiment indicator**
(Positive / Neutral / Negative) selectable at log time. The only remaining gap is the **AI Search
results UI** (currently a "Coming soon" placeholder; provider plumbing exists). See `README.md`
for the feature-level status table and `docs/INFRASTRUCTURE.md` for the deployment spec.

**In scope / built:**
- Company profiles within an optional two-level grouping hierarchy (`subdivisions` → `studios` →
  `customers`), with an editable status field
- Contacts directory with add / edit / CSV import / search / filter / sort
- Interaction logging — meetings, calls, emails, messages, with notes, tags, attendees, a
  **sentiment indicator**, and **action items as commitments** (owner, due date, Open/In
  Progress/Closed status). Companies and contacts can be created inline while logging
- Inline creation of grouping metadata (subdivisions, studios, statuses) from the company form
- Activity feed across all companies
- Company-level relationship notes
- **AI Search** — natural-language Q&A over every logged interaction, note, and profile, via an
  OpenAI-compatible API called directly from the browser *(provider config + client plumbing
  built; results UI is a "Coming soon" placeholder)*
- Audit log
- Settings (AI provider configuration)

**Explicitly out of scope** (this is a personal, single-user tool, not a team support platform):
- Case/ticket management, SLA tracking, routing rules
- Jira, Slack, PagerDuty, or other external-integration webhooks
- Role-based access / multi-tenant auth — everyone with a login has full access; OIDC exists only
  for the case you deploy this somewhere network-reachable
- Third-party data sync (e.g. Airtable) — everything is entered manually

**Data entities:** `Customer` (company/opportunity; sits under an optional `Subdivision`/`Studio`
grouping), `Contact`, `Interaction` (with `ActionItem` commitments and a `sentiment` field),
`TeamNote`, `AuditLogEntry`. There is also an optional `Pod`/`Engineer` pairing for grouping
people on your side of the relationship, useful if you're logging on behalf of more than one
identity (e.g. a shared household or small team) — otherwise leave it as a single entry.

---

## Architecture

```
Browser (React + Vite + TS SPA, :5173)
  └── ui/src/api/client.ts  (typed CRM.* client — the ONLY way the UI reaches the backend)
        │  Authorization: Bearer <JWT>   (dev-bypass when unconfigured)
        ▼
  Go API (pgx/v5, :8080)
        ├── internal/api      thin HTTP handlers; REST mirrors the CRM.* shapes
        ├── internal/auth     JWKS JWT middleware (dev-bypass locally)
        ├── internal/config   env-based config
        └── internal/db       pool + embedded SQL migrations
        ▼
  PostgreSQL 16 (:5432, postgres_data volume)

(AI Search, when wired: ui/src/crm/ai.ts → OpenAI-compatible chat completions,
 key/endpoint/model in browser localStorage, configured in Settings.)
```

Every CRUD operation goes through the typed `CRM.*` client in `ui/src/api/client.ts`, which calls
the Go REST API, which persists to PostgreSQL. Docker Compose (`docker-compose.yml`) runs all
three tiers locally; data persists in the `postgres_data` volume.

The AI Search **provider plumbing** is built (`ui/src/crm/ai.ts`: serialize the dataset to a text
knowledge base and call an OpenAI-compatible endpoint; key/endpoint/model in `localStorage`,
configured in **Settings**, with a working **Test Connection**), but the AI Search **results
screen** is a "Coming soon" placeholder.

**Screens:** Activity Feed (`home`), Log Interaction (`log`), AI Search (`ai`, placeholder),
Companies (`s06`), Company Profile (`s05`), Contacts (`contacts`), Audit Log (`s09`), Settings
(`settings`). All screens are available to every authenticated user (or the dev-bypass user).

**Design system:** The UI is built on a token-driven system in `ui/src/styles.css` (oklch
warm-slate neutrals + one blue accent + a muted status scale; Hanken Grotesk / DM Mono; 8px
rhythm; fixed topbar + sidebar rail). See `README.md` § Design system.

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite + TypeScript (strict) | SPA in `ui/`; talks only via the typed `CRM.*` client; token-driven design system in `ui/src/styles.css` |
| Backend API | Go (`pgx/v5`) | Thin REST handlers in `api/internal/api`; embedded SQL migrations; serves `:8080` |
| Data | PostgreSQL 16 | Persists in the `postgres_data` Docker volume |
| Auth (optional) | OIDC (UI, PKCE, no library) + JWKS validation (API) | Dev-bypass when unconfigured; see `docs/INFRASTRUCTURE.md` |
| Local orchestration | Docker Compose | `ui` + `api` + `db`; `docker compose up --build -d` |
| Hosting | Local only (Docker Compose) | GitHub Pages cannot host this (needs API + DB); anything beyond local is up to you — see `docs/INFRASTRUCTURE.md` |
| Source control | GitHub (`origin`) | `github.com/stlevy53/Personal-CRM` |

---

## Data model

The Postgres schema lives in
[`api/internal/db/migrations/`](../api/internal/db/migrations/) and its TypeScript mirror in
[`ui/src/api/types.ts`](../ui/src/api/types.ts). See `README.md` § Data model for the entity
table — it's kept in sync there rather than duplicated here.

---

## API surface

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

All routes require auth (Bearer JWT) except `/healthz`; in local dev auth is bypassed.

---

## Ideas / not built

Things that would be reasonable next steps for a personal tool, in rough order of value:

- Wire up the **AI Search results UI** — the provider plumbing already exists.
- A lightweight reminder surface for commitments coming due (the data's already there in
  `action_items`).
- A simple export (CSV/JSON) of the full dataset for backup, beyond the per-screen CSV exports
  that already exist.

None of these are scheduled — this is a personal tool built for as-needed use, not a roadmap with
deadlines.

---

## Document History

| Version | Date | Notes |
|---|---|---|
| 1.0–2.3 | May–June 2026 | Original internal build history (support-CRM vision, MVP re-scope, 3-tier app, sentiment field). Superseded by this personal-use rewrite. |
| 3.0 | July 2026 | Rewritten as a personal relationship-tracking tool; dropped the enterprise support-ticketing vision (cases, SLA engine, Jira/Slack/PagerDuty/Airtable integrations, K8s/RDS/Terraform production plan) — none of it applies to single-user personal use. |
