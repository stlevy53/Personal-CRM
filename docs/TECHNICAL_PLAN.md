# Personal-CRM — Technical Plan

**Version:** 2.2  
**Date:** June 2026  
**Author:** MGT Systems Team  
**Status:** Active — Relationship Intelligence MVP **built as a real 3-tier app** (React + Go + PostgreSQL), running locally with MGT data; production internal deployment next

---

## 0. MVP Scope (Current Direction)

The first release is a **Relationship Intelligence platform**, not a support ticketing tool. The goal is high-value data capture with zero external integration dependencies, paired with AI search so the captured data behaves like a living knowledge base.

> **Build status (June 2026):** The MVP is no longer a mock single-page prototype. It is implemented as a real three-tier application — a **React + Vite + TypeScript** UI, a **Go (`pgx/v5`)** API, and **PostgreSQL 16**, orchestrated locally with Docker Compose. MGT data is imported and live in the private working copy this public repo is derived from (this repo ships synthetic demo data only). The UI ships a token-driven design system and full **OIDC (Acme Auth, PKCE)** authentication; the API has Acme Auth JWKS JWT validation. Both auth tiers run in dev-bypass locally. Each interaction now carries a **sentiment indicator** (Positive / Neutral / Negative) selectable at log time and visible on all interaction cards. The only remaining MVP gap is the **AI Search results UI** (currently a "Coming soon" placeholder; provider plumbing exists). See `README.md` for the feature-level status table and `docs/INFRASTRUCTURE.md` for the deployment spec.

**In scope for MVP:**
- Customer profiles (manually entered — no Airtable sync) within a Acme Games → Subdivision → Studio → Customer hierarchy, with an editable App Status
- Contacts directory with add / edit / CSV import / search / filter / sort
- Interaction logging — meetings, calls, emails, Slack threads, with notes, tags, attendees, a **sentiment indicator** (Positive / Neutral / Negative), and **action items as commitments** (owner, due date, and Open/In Progress/Closed status). Customers, MGT attendees, and external contacts can be created inline while logging
- Inline creation of org metadata (subdivisions, studios, app statuses) from the customer form
- Activity feed across all customers
- Customer-level relationship notes
- **AI Search** — natural-language Q&A over every logged interaction, note, and profile, via an OpenAI-compatible API called directly from the browser *(provider config + client plumbing built; results UI is a "Coming soon" placeholder)*
- Audit log
- Settings (AI provider configuration)

**Explicitly deferred (see Sections 2+ for the full vision):**
- Support request / case management, SLA tracking, routing
- Jira, Slack, PagerDuty, email integrations
- SSO **group-based authorization / role gating** (authentication itself via Acme Auth is built; all authenticated users still share full access)
- Airtable sync (replaced by manual entry)

**MVP access model:** All users are MGT-internal and share the **same full capabilities**. There is no role switcher and no role-gated screens; role-based access via SSO groups is part of the production vision (Section 6.5), not the MVP. Authentication (login) is provided by Acme Auth OIDC and is bypassed in local dev.

**MVP data entities:** `Customer` (the `GameTeam` record + `Subdivision`/`Studio` hierarchy), `Contact`, `Interaction` (with `ActionItem` commitments and a `sentiment` field), `TeamNote`, `AuditLogEntry`. See Section 4.1 for the support-era entities retained for the longer-term vision.

> Sections 1 onward describe the **full long-term vision** (support CRM with SLA/routing/integrations). They remain the target end-state; the MVP above is the first increment toward it.

---

## 1. Overview

The Personal-CRM's long-term vision is a support relationship management platform embedded in the MGT Developer Portal, replacing fragmented Slack/email intake with structured case management, game team profiles, SLA enforcement, and cross-pod dashboards.

This document covers the full technical architecture from current state (MVP relationship intelligence, mock data, single-page HTML app) through the complete production implementation (Go/React/PostgreSQL on AWS).

> **Database:** PostgreSQL on AWS RDS is the approved data store (confirmed June 2026). Earlier drafts targeted DynamoDB; any remaining DynamoDB references in this document are explicitly marked as superseded and retained for historical context only. See `docs/INFRASTRUCTURE.md` for the authoritative schema and migration strategy.

---

## 2. Architecture

### 2.1 Current State (MVP — Real 3-Tier App, Local)

```
Browser (React + Vite + TS SPA, :5173)
  └── ui/src/api/client.ts  (typed CRM.* client — the ONLY way the UI reaches the backend)
        │  Authorization: Bearer <Acme Auth JWT>   (dev-bypass when unconfigured)
        ▼
  Go API (pgx/v5, :8080)
        ├── internal/api      thin HTTP handlers; REST mirrors the CRM.* shapes
        ├── internal/auth     Acme Auth JWKS JWT middleware (dev-bypass locally)
        ├── internal/config   env-based config
        └── internal/db       pool + embedded SQL migrations
        ▼
  PostgreSQL 16 (:5432, postgres_data volume)

(AI Search, when wired: ui/src/crm/ai.ts → OpenAI-compatible chat completions,
 key/endpoint/model in browser localStorage, configured in Settings.)
```

The original mock in-memory prototype has been retired and removed from this repo. Every CRUD operation goes through the typed `CRM.*` client in `ui/src/api/client.ts`, which calls the Go REST API, which persists to PostgreSQL. Docker Compose (`docker-compose.yml`) runs all three tiers locally; data persists in the `postgres_data` volume.

The AI Search **provider plumbing** is built (`ui/src/crm/ai.ts`: serialize the dataset to a text knowledge base and call an OpenAI-compatible endpoint; key/endpoint/model in `localStorage`, configured in **Settings**, with a working **Test Connection**), but the AI Search **results screen** is a "Coming soon" placeholder.

**MVP screens:** Activity Feed (`home`), Log Interaction (`log`), AI Search (`ai`, placeholder), Customers (`s06`), Customer Profile (`s05`), Contacts (`contacts`), Audit Log (`s09`), Settings (`settings`). All screens are available to every authenticated user.

**Design system:** The UI is built on a token-driven system in `ui/src/styles.css` (oklch warm-slate neutrals + one blue accent + a muted status scale; Hanken Grotesk / DM Mono; 8px rhythm; fixed topbar + sidebar rail). See `README.md` § Design system.

### 2.2 Target State (Production)

```
Browser (React SPA)
  └── Developer Portal (Go + React)
        ├── /crm/**           ← CRM routes embedded in the portal
        └── CRM React components
              │
              ▼
        CRM Backend Service (Go)
              ├── REST API (cases, teams, contacts, routing, audit)
              ├── SLA engine (scheduled job, every 15 min)
              └── Webhook handlers (Jira, Slack)
                    │
        ┌───────────┼────────────────────────────┐
        ▼           ▼                            ▼
  PostgreSQL     Jira API              External integrations
  on AWS RDS     (ticket create,       Slack · PagerDuty
  (primary store) status sync)         Airtable · Email · SSO
```

### 2.3 Separation of Concerns

| Layer | Responsibility | Current impl | Production impl |
|---|---|---|---|
| **Data store** | All CRM entities + CRUD | PostgreSQL 16 (Docker, local) via Go `pgx/v5` service | PostgreSQL on AWS RDS via the same Go service |
| **SLA engine** | Timer calculation, breach detection | Not built (deferred) | Go scheduled job + PostgreSQL |
| **Routing engine** | service → pod mapping | Not built (deferred) | Configurable rules in PostgreSQL |
| **Notifications** | Slack, email, PagerDuty triggers | Not built (deferred) | Real API calls from Go service |
| **Auth** | Authentication / access control | Acme Auth OIDC (UI) + JWKS validation (API), both dev-bypassable locally; no role gating yet | Acme Auth enforced + SSO-group authorization |
| **Frontend** | UI rendering | React + Vite + TS SPA (`ui/`) | Same SPA, containerized on the MGT cluster |

---

## 3. Tech Stack

### Current (Built — local 3-tier app)
| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite + TypeScript (strict) | SPA in `ui/`; talks only via the typed `CRM.*` client; token-driven design system in `ui/src/styles.css` |
| Backend API | Go (`pgx/v5`) | Thin REST handlers in `api/internal/api`; embedded SQL migrations; serves `:8080` |
| Data | PostgreSQL 16 | MGT data imported via `tools/import`; persists in the `postgres_data` Docker volume |
| Auth | Acme Auth OIDC (UI, PKCE, no library) + JWKS validation (API) | Dev-bypass when unconfigured; see Section 6.5 / `docs/INFRASTRUCTURE.md` |
| Local orchestration | Docker Compose | `ui` + `api` + `db`; `docker compose up --build -d` |
| Hosting | Local only (Docker Compose) | GitHub Pages cannot host this (needs API + DB); production target is the internal K8s + RDS stack |
| Source control | GitHub (`origin`) | `github.com/stlevy53/Personal-CRM` |

### Target (Production — confirmed March 10, 2026, PRD RD-16; infra stack confirmed June 2026)
| Layer | Technology | Notes |
|---|---|---|
| Frontend | React (TypeScript) | Containerized; served from a container (not S3) for simplicity and internal access control |
| Backend API | Go | REST service; containerized |
| Database | AWS RDS (PostgreSQL) | Managed by Terraform; IAM-authenticated (no static credentials) |
| Local dev | Docker Compose | React + Go + Postgres containers; migrations run locally before prod |
| Container build | Docker | `docker build` per service; images shaped into K8s Deployments at deploy time |
| Infrastructure-as-code | Terraform | Manages RDS instance, IAM roles/instance profiles (least-privilege) |
| Orchestration | Kubernetes (in-house) | UI and API as K8s Deployments on existing MGT cluster |
| Auth (UI) | Acme Auth (Acme Games) | OIDC broker backed by Okta SSO; all Acme Games employees can log in — see Section 6.5 |
| Auth (API) | Acme Auth JWKS | Go API validates JWTs via Acme Auth's JWKS endpoint; no unsecured API calls |
| Notifications | Slack API, PagerDuty API, Email (TBD) | |
| Data source | Airtable API | Game team and studio reference data (post-MVP) |
| Issue tracking | Jira REST API | Ticket creation + bidirectional status sync |

> **DB choice (June 2026):** PostgreSQL/RDS replaces the earlier DynamoDB target. Postgres fits the relational data model naturally (customers — studios — subdivisions, foreign keys, dashboard joins), works in the Docker Compose local dev loop, and is the approved standard in the Acme Games infrastructure toolkit. See `docs/INFRASTRUCTURE.md` for schema and migration strategy.

### ~~Interim Backend Option~~ — superseded
The Supabase interim option is no longer applicable. PostgreSQL on RDS is the direct production target, with Docker Compose providing an identical Postgres environment locally.

---

## 4. Data Model

### 4.1 Entities

#### Case
The primary support request record. Created on intake, linked to a Jira ticket.

| Field | Type | Notes |
|---|---|---|
| `id` | String | Format: `CASE-NNNN` (zero-padded) |
| `title` | String | Max 200 chars |
| `description` | String | Max 2,000 chars |
| `service` | Enum | `k8s \| aws \| ci \| db \| obs` |
| `priority` | Enum | `critical \| standard` |
| `status` | Enum | `open \| in-progress \| waiting \| resolved \| auto-closed` |
| `gameTeamId` | String | FK → GameTeam |
| `contactId` | String | FK → Contact (submitter) |
| `assignedTo` | String? | FK → Engineer (null = unassigned) |
| `podId` | String | FK → Pod (set by routing rules) |
| `jiraTicket` | String | Linked Jira ticket key (e.g. `MGT-2847`) |
| `createdAt` | Timestamp | SLA clock starts here |
| `firstResponseAt` | Timestamp? | Set when engineer first adds a note |
| `resolvedAt` | Timestamp? | Set when case resolved |
| `waitingSince` | Timestamp? | Set when status = waiting; SLA paused |
| `slaOutcome` | Enum? | `met \| breached` — set on resolution |
| `notes` | Note[] | Internal notes (not visible to customer) |
| `timeline` | TimelineEvent[] | Audit trail of state changes |
| `reassignments` | Reassignment[] | Log of all reassignments |

#### Customer (`GameTeam` record)
Persistent relationship record for each game/project. The `gameTeams` namespace is retained for interface stability; in the UI these are "Customers."

| Field | Type | Notes |
|---|---|---|
| `id` | String | Slug (e.g. `fv3`, `poker`) |
| `name` | String | Customer / game name |
| `studioId` | String | FK → Studio (which rolls up to a Subdivision under the Acme Games publisher) |
| `appStatus` | Enum | `prototype \| pre-production \| production \| soft-launch \| live-worldwide \| sunsetting \| sunset` (extendable inline) |
| `slackChannel` | String? | Primary Slack channel |
| `contacts` | String[] | FK[] → Contact |
| `notes` | TeamNote[] | Institutional knowledge; visible to all users |

> `services` (services-consumed) was removed from the MVP UI. The longer-term routing/SLA vision (Sections 4–6) still references service categories.

#### Subdivision / Studio
Org hierarchy above the customer: `Acme Games (publisher) → Subdivision → Studio → Customer`. Each `Studio` has a `subdivisionId`; each `Customer` has a `studioId`. All three can be created inline from the customer form.

#### ActionItem (Commitment)
A structured commitment captured on an interaction.

| Field | Type | Notes |
|---|---|---|
| `text` | String | What was committed |
| `ownerId` | String? | FK → MGT person responsible |
| `dueDate` | Date? | Expected completion |
| `status` | Enum | `open \| in-progress \| closed` |

#### Contact
Individual person at a game team. Nested under GameTeam.

| Field | Type | Notes |
|---|---|---|
| `id` | String | |
| `name` | String | |
| `email` | String | Used for notifications + survey delivery |
| `slack` | String? | Slack handle (e.g. `@j_ellis`) |
| `role` | String | Free text (e.g. `Lead Engineer`) |
| `gameTeamId` | String | FK → GameTeam |

#### RoutingRule
Maps a service category to a pod, Jira project, and Slack channel.

| Field | Type | Notes |
|---|---|---|
| `id` | String | |
| `service` | String | Service category key |
| `serviceName` | String | Display name |
| `podId` | String | FK → Pod |
| `jiraProject` | String | Jira project key |
| `slackChannel` | String | Channel for pod notifications |
| `active` | Boolean | Disabled rules are ignored by routing |
| `updatedAt` | Timestamp | |

#### Pod
A MGT team responsible for a service area.

| Field | Type | Notes |
|---|---|---|
| `id` | String | |
| `name` | String | Display name |
| `jiraProject` | String | Default Jira project |
| `slackChannel` | String | Pod notification channel |

#### Engineer
A MGT engineer who works cases.

| Field | Type | Notes |
|---|---|---|
| `id` | String | |
| `name` | String | |
| `initials` | String | Used in avatar display |
| `podId` | String | FK → Pod |

#### AuditLogEntry
Every significant action in the system.

| Field | Type | Notes |
|---|---|---|
| `id` | String | |
| `timestamp` | Timestamp | |
| `actorId` | String | Engineer ID, contact ID, or `system` |
| `action` | String | Human-readable action type |
| `recordType` | String | `Case \| Profile \| Routing Rule` |
| `recordId` | String | ID of the affected record |
| `detail` | String | Additional context |

### 4.2 SLA Rules

| Priority | First Response | Resolution | At-Risk Threshold |
|---|---|---|---|
| Critical Outage | 2 hours | 24 hours | 80% (19.2 hrs) |
| Standard | 24 hours | 120 hours (5 days) | 80% (96 hrs) |

- All windows are **24/7 calendar time** — no business-hours exclusions (PRD RD-02)
- SLA clock starts at `case.createdAt`
- Clock **pauses** when status = `waiting`; resumes when status changes back to `in-progress`
- On breach (Critical Outage): PagerDuty escalation fires to pod on-call rotation
- On breach (Standard): Slack notification to pod channel

### ~~4.3 DynamoDB Access Patterns~~ (superseded — PostgreSQL/RDS is now the target DB)

> **Note (June 2026):** The database target has changed from DynamoDB to PostgreSQL on AWS RDS. The access patterns below were drafted for DynamoDB and are retained for historical reference only. The PostgreSQL schema and migration strategy are documented in `docs/INFRASTRUCTURE.md`.

| # | Query | DynamoDB Pattern |
|---|---|---|
| 1 | Get case by ID | PK=`CASE#{id}` |
| 2 | Get all open cases (queue) | GSI on status, sorted by createdAt |
| 3 | Get cases by game team | GSI on gameTeamId + createdAt |
| 4 | Get cases by pod | GSI on podId + status |
| 5 | Get cases by engineer (assigned) | GSI on assignedTo + status |
| 6 | Get cases by contact (submitter) | GSI on contactId + createdAt |
| 7 | Get cases by SLA status | GSI on slaStatus + createdAt |
| 8 | Get game team by ID | PK=`TEAM#{id}` |
| 9 | Get all game teams | Scan (acceptable; small table) |
| 10 | Get contacts by game team | GSI on gameTeamId |
| 11 | Get routing rules (all active) | PK=`ROUTE`, SK=serviceKey |
| 12 | Get audit log (recent first) | PK=`AUDIT`, SK=timestamp (DESC) |
| 13 | Get audit log by record | GSI on recordId + timestamp |
| 14 | Cross-pod case volume (dashboard) | Aggregate query or pre-computed stat |
| 15 | SLA health rollup (dashboard) | Aggregate query or pre-computed stat |

---

## 5. API Design (Production)

### 5.1 Cases

```
POST   /api/cases                     Create case
GET    /api/cases                     List cases (filterable: status, pod, priority, assignee)
GET    /api/cases/:id                 Get case detail
PATCH  /api/cases/:id                 Update case (status, assignedTo, podId)
POST   /api/cases/:id/notes           Add internal note
POST   /api/cases/:id/resolve         Resolve case
POST   /api/cases/:id/reassign        Reassign to new pod/engineer
POST   /api/cases/:id/waiting         Set waiting-on-customer
```

### 5.2 Game Teams

```
GET    /api/teams                     List all game teams
POST   /api/teams                     Create game team profile
GET    /api/teams/:id                 Get team profile
PATCH  /api/teams/:id                 Update profile fields
POST   /api/teams/:id/notes           Add team note
GET    /api/teams/:id/cases           Get case history for team
POST   /api/teams/:id/contacts        Add contact
```

### 5.3 Routing

```
GET    /api/routing                   List all routing rules
POST   /api/routing                   Create routing rule
PATCH  /api/routing/:id               Update routing rule
PATCH  /api/routing/:id/toggle        Enable / disable rule
POST   /api/routing/resolve           Resolve service → pod (used at intake)
```

### 5.4 Dashboard

```
GET    /api/stats/kpis                Open cases, SLA rate, avg resolution, breach count
GET    /api/stats/volume?by=pod       Case volume grouped by pod
GET    /api/stats/volume?by=service   Case volume grouped by service
GET    /api/stats/sla-health          Met / at-risk / breached breakdown
GET    /api/stats/top-teams           Top teams by volume (last 30/90 days)
```

### 5.5 Audit

```
GET    /api/audit                     Get audit log (filterable by actor, action, record)
```

---

## 6. Integration Specifications

### 6.1 Jira

**Trigger:** Case creation  
**Action:** Create Jira issue in the pod's project  
**Fields mapped:**
- Summary ← `case.title`
- Description ← `case.description` + link to CRM case
- Priority ← `case.priority` (Critical → Blocker; Standard → Normal)
- Labels ← `[crm-case, case.gameTeamId]`

**Bidirectional sync:**
- Jira webhook → `PATCH /api/cases/:id` when ticket status changes
- CRM case status mapping: `In Progress` → in-progress, `Done` → triggers resolve flow
- Retry logic: up to 3 attempts on failure; failed creations logged to admin

**Implementation approach (mock → production):**
- Mock: UI shows Jira ticket ID, no real call
- Interim: Zapier "New Supabase row → Create Jira issue"
- Production: Go service calls Jira REST API v3

### 6.2 Slack

**Outbound only** — Slack is never an intake channel (PRD RD-07)

| Trigger | Message | Channel |
|---|---|---|
| New case created | `[CASE-NNNN] New {priority} case: {title} — {gameTeam}` | Pod's routing channel |
| SLA At Risk (80%) | `⚠️ [CASE-NNNN] At Risk — {remaining} remaining` | Pod channel |
| SLA Breached | `🔴 [CASE-NNNN] SLA BREACHED — {priority}` | Pod channel |
| Case resolved | `✅ [CASE-NNNN] Resolved — SLA {outcome}` | Pod channel |
| Reassignment | `[CASE-NNNN] Reassigned to {pod} · {engineer}` | New pod's channel |

**Message format:** All messages include Case ID, title, game team, and link to CRM case.

**Implementation approach:**
- Mock: Toast notification in UI
- Interim: Zapier webhook → Slack
- Production: Go service → Slack Web API (Block Kit formatted messages)

### 6.3 Airtable

**MVP Decision (resolved OQ-02):** No Airtable sync for MVP. Game team, studio, and project information is entered manually by users through the CRM interface. This removes an external integration dependency and simplifies Phase 1 significantly.

**Post-MVP:** If Airtable sync becomes necessary to reduce manual data entry burden, it can be added as a discrete enhancement — the data model supports it without changes.

**Implementation approach:**
- MVP: Manual entry via CRM UI; admin can create/edit game team profiles directly
- Post-MVP: Go service polls Airtable REST API on configurable schedule, or real-time via Airtable webhook

### 6.4 PagerDuty

**Trigger:** Critical Outage SLA breach (24h resolution window exceeded)  
**Action:** Create PagerDuty incident routed to pod's on-call escalation policy  
**Fallback:** If PagerDuty unreachable → fire Slack alert to pod channel  

**Incident payload:**
- Title: `CRM SLA BREACH: [CASE-NNNN] {title}`
- Severity: critical
- Body: Case ID, game team, elapsed time, link to CRM case

**Per-pod PagerDuty policy mapping:** Needs to be defined per pod (OQ-04)

### 6.5 Authentication — Acme Auth (Acme Games SSO)

All authentication goes through **Acme Auth**, Acme Games' internal OIDC broker backed by Okta SSO. Every Acme Games employee has access, making it the default security mechanism for internal tools.

**UI Authentication flow:**
1. User lands on the React app; if no valid session, redirect to Acme Auth login endpoint
2. Acme Auth handles the Okta SSO flow and returns an authorization code
3. App exchanges the code for ID + access tokens
4. Access token (JWT) is stored in memory and sent as `Authorization: Bearer <token>` on all API calls
5. On expiry, silent refresh via Acme Auth's OIDC renewal flow

Reference: [Acme Auth Web Integration docs](https://docs.acme.example.com/extending/auth-web-integration.html)

**API JWT validation:**
The Go API validates every inbound request by:
1. Fetching Acme Auth's JWKS endpoint (cached with TTL)
2. Verifying the JWT signature against the public keys
3. Checking standard claims (`iss`, `aud`, `exp`)
4. Extracting the user identity from the `sub` / email claims for audit logging

No request without a valid, unexpired JWT from Acme Auth is accepted. This applies to all `/api/*` routes.

**Role assignment via SSO groups:**
| Role | SSO Group |
|---|---|
| Any authenticated user (read/write) | Any valid Acme Auth login (all Acme Games employees) |
| MGT Engineer | `mgt-engineers` |
| Leadership | `mgt-leadership` |
| Admin | `mgt-admins` |

**Implementation approach:**
- Mock (current): No auth; all users have full access
- Production: Acme Auth OIDC in React UI + JWKS validation in Go API (PRD RD-16)

### 6.6 Email

**Triggers:**
1. Case created → confirmation to submitter (case ID, Jira ticket, SLA commitment)
2. Case resolved → resolution summary + optional acknowledgment link
3. Waiting reminder → Day 3 and Day 6 after status = waiting
4. Survey → 24h after resolution if no acknowledgment

**Email service:** TBD — pending IT decision (OQ-03)

---

## 7. Frontend Architecture (Production React)

When migrating from the current HTML prototype to React within the Developer Portal:

### Component Structure
```
src/crm/
  ├── pages/
  │   ├── IntakeForm.tsx           # S-01
  │   ├── MyRequests.tsx           # S-02
  │   ├── SupportQueue.tsx         # S-03
  │   ├── CaseDetail.tsx           # S-04
  │   ├── TeamProfile.tsx          # S-05
  │   ├── ProfilesList.tsx         # S-06
  │   ├── Dashboard.tsx            # S-07
  │   ├── RoutingConfig.tsx        # S-08
  │   └── AuditLog.tsx             # S-09
  │
  ├── components/
  │   ├── SLABar.tsx               # SLA progress bar + status label
  │   ├── CaseTable.tsx            # Reusable case list table
  │   ├── CaseDrawer.tsx           # Slide-in case preview
  │   ├── TeamSnapshot.tsx         # Right-column team context card
  │   ├── Timeline.tsx             # Case event timeline
  │   └── ResolveModal.tsx         # Resolve / reassign / waiting modals
  │
  ├── hooks/
  │   ├── useCases.ts              # Case CRUD + SLA computation
  │   ├── useTeams.ts              # Game team profiles
  │   └── useDashboard.ts          # Stats and aggregations
  │
  └── api/
      ├── client.ts                # Axios/fetch wrapper with auth headers
      ├── cases.ts                 # Case API calls
      ├── teams.ts                 # Team API calls
      └── stats.ts                 # Dashboard API calls
```

### Migration Path from Prototype — COMPLETE for the relationship-intelligence MVP
The static `assets/js/app.js` prototype has already been ported to the React + Vite + TypeScript SPA in `ui/` (screens in `ui/src/screens/`, contexts in `ui/src/app/` + `ui/src/crm/`, typed client in `ui/src/api/client.ts`). The component structure above (cases/SLA/routing) describes the **future support-CRM** screens, which remain deferred. The retired prototype is kept only as a static design reference at the repo root.

---

## 8. Build Phases

### Phase 1 — Foundation & Data Model (2–3 weeks)
**Goal:** Production database schema established, portal hosting confirmed, auth working.

- [ ] Define complete PostgreSQL schema + migration inventory (blocks all other backend work)
- [ ] Write Technical Design Document (TDD)
- [ ] Set up AWS infrastructure (RDS PostgreSQL via Terraform)
- [ ] Implement SSO integration + role-based access
- [ ] Game team profile CRUD backed by database
- [ ] Airtable sync (game team / studio dropdowns)
- [ ] Admin routing configuration UI (live)
- [ ] Resolve: OQ-02 (Airtable sync frequency), OQ-08 (RPO/RTO), OQ-09 (duplicate detection)

**Blockers:** SSO group mapping, portal hosting confirmed. ~~Airtable API access~~ — removed from MVP scope.

---

### Phase 2 — Intake & Routing (2–3 weeks)
**Goal:** First real case submitted through the portal and routed to Jira.

- [ ] Intake form embedded in Developer Portal (React component)
- [ ] Form validation with Airtable-sourced dropdowns
- [ ] Rules-based routing engine (service → pod → Jira project)
- [ ] Jira ticket auto-creation with retry logic (3 attempts)
- [ ] Bidirectional Jira status sync via webhook (within 60 sec)
- [ ] Email confirmation on submission
- [ ] Contact auto-creation on first submission
- [ ] Resolve: OQ-03 (email service selection)

**Blockers:** Phase 1 complete, Jira API credentials, email service selected.

---

### Phase 3 — SLA Engine & Notifications (2 weeks)
**Goal:** SLA tracking live with real-time Slack alerts.

- [ ] SLA timer service (Go scheduled job, runs every 15 min)
- [ ] At-Risk detection at 80% threshold
- [ ] Slack notification: new case assigned to pod
- [ ] Slack notification: At-Risk warning with link
- [ ] Slack notification: SLA breach
- [ ] PagerDuty escalation: Critical Outage breach → pod on-call
- [ ] Reassignment flow with full audit logging
- [ ] Waiting-on-customer status with SLA pause/resume
- [ ] Resolve: OQ-04 (PagerDuty policies per pod)

**Blockers:** Slack API token, PagerDuty policies per pod.

---

### Phase 4 — Dashboards (2 weeks)
**Goal:** Engineer and leadership dashboards reading from live data.

- [ ] Engineer dashboard: queue, SLA indicators, filters, sort by urgency
- [ ] Leadership dashboard: cross-pod KPIs, volume charts, recurring issues
- [ ] Studio health view (lifecycle stage, open cases, SLA status)
- [ ] Time-window selector (7 / 30 / 90 days)
- [ ] CSV export
- [ ] Performance validation (< 2s dashboard load)

**Blockers:** Phases 1–3 complete (needs real data to be meaningful).

---

### Phase 5 — Resolution, Survey & Hardening (2 weeks)
**Goal:** Full case lifecycle complete; ready for pilot rollout.

- [ ] Case resolution trigger (Jira close → CRM resolve)
- [ ] Resolution email with optional acknowledgment link
- [ ] Survey trigger mechanism (24h after resolution if no ack)
- [ ] Auto-close at Day 20 for waiting cases
- [ ] Graceful degradation (intake queues if CRM backend down)
- [ ] Audit log completeness audit
- [ ] Performance load testing
- [ ] Controlled pilot rollout (2–3 game teams)
- [ ] Resolve: OQ-06 (Slack deprecation plan), OQ-07 (pilot game teams)

**Blockers:** Pilot teams identified, Slack change management plan ready.

---

## 9. Open Questions (Blocking Build)

| ID | Question | Owner | Urgency | Blocks Phase |
|---|---|---|---|---|
| ~~OQ-02~~ | ~~Airtable sync frequency?~~ | — | **RESOLVED: No Airtable sync for MVP. Manual data entry.** | — |
| OQ-03 | Which email service for transactional emails? | IT / Engineering | Pre-build | 2 |
| OQ-04 | PagerDuty escalation policies per pod? | MGT Ops | Pre-build | 3 |
| OQ-06 | Slack intake deprecation / change management plan | PM / Leadership | Pre-rollout | 5 |
| OQ-07 | Which 2–3 game teams for controlled pilot? | PM / Leadership | Pre-rollout | 5 |
| OQ-08 | RPO/RTO targets for backup and recovery? | Engineering / IT | Pre-build | 1 |
| OQ-09 | Duplicate game team profile handling? (flag / block / merge) | PM / Engineering | Pre-build | 1 |

---

## 10. Deployment

### Current: GitHub
The canonical remote is `origin`: `github.com/stlevy53/Personal-CRM`. The app runs locally via Docker
Compose; there is no static-prototype GitHub Pages deployment in this repo.

### Production: K8s + RDS + Terraform

An engineer on the MGT infrastructure team will shape the containers into Kubernetes Deployments:

- **UI container** — React app built with `docker build`, deployed as a K8s Deployment + Service
- **API container** — Go service built with `docker build`, deployed as a K8s Deployment + Service
- **Database** — AWS RDS (PostgreSQL), managed by Terraform
- **IAM** — Terraform creates IAM roles and instance profiles for least-privilege RDS access; no static username/password
- **DB migrations** — The same migration files used locally are applied to the RDS instance at deploy time

UI is served from a container (not S3) to avoid the complexity of locking down S3 to internal-only access.

See `docs/INFRASTRUCTURE.md` for the complete local dev and deployment architecture.

### Environment-Specific Configuration
```
# Environment variables injected by K8s (ConfigMaps / Secrets)
CRM_API_URL=https://crm-api.internal.acme.example.com
ACME_AUTH_ISSUER=https://auth.acme.example.com
ACME_AUTH_JWKS_URL=https://auth.acme.example.com/.well-known/jwks.json
ACME_AUTH_CLIENT_ID=<from Acme Auth app registration>
POSTGRES_HOST=<rds-endpoint>
POSTGRES_DB=personal_crm
# No POSTGRES_USER / POSTGRES_PASSWORD - IAM auth only in production
```

---

## 11. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Intake form availability | 99.9% | Aligns with Developer Portal SLA |
| Intake form load time | < 2 seconds | |
| Form submission confirmation | < 3 seconds | |
| Dashboard load (engineer) | < 2 seconds | |
| Dashboard load (leadership) | < 3 seconds | |
| Jira ticket creation | < 5 seconds from case submit | With retry on failure |
| Jira status sync | < 60 seconds from Jira update | |
| SLA alert latency | < 15 minutes from threshold hit | Scheduled job interval |
| Data retention | Indefinite (no auto-archival in v1) | |
| Backup | Daily minimum | RPO/RTO per Acme Games infra standards (OQ-08) |

---

## 12. Security & Compliance

- Authentication via Acme Games SSO — no separate CRM credentials (PRD RD-16)
- Role permissions enforced at API level, not just UI
- All significant actions logged to audit trail with actor + timestamp
- Data residency: standard Acme Games cloud governance applies (PRD RD-15)
- No special compliance constraints confirmed by Legal (PRD RD-15)
- Unauthorized access attempts logged

---

## Document History

| Version | Date | Notes |
|---|---|---|
| 1.0 | May 2026 | Initial technical plan — self-build phase, mock data |
| 2.0 | May 2026 | MVP re-scoped to Relationship Intelligence; deferred support/SLA/integrations |
| 2.1 | May 2026 | Removed role switcher (all users internal); Acme Games → Subdivision → Studio → Customer hierarchy; `appStatus` replaces `lifecycle`; action items modeled as commitments (owner/due/status); contacts CRUD + CSV import; canonical remote = internal Acme Games GitHub |
| 2.2 | June 2026 | "Current state" updated to the **built 3-tier app**: React + Vite + TS UI, Go (`pgx/v5`) API, PostgreSQL 16 via Docker Compose; MGT data imported; Acme Auth OIDC (PKCE, UI) + JWKS validation (API), dev-bypassable; token-driven design system; prototype→React migration complete; AI Search results UI a "Coming soon" placeholder |
| 2.3 | June 2026 | Added per-interaction **sentiment indicator** (Positive / Neutral / Negative): DB migration `000002`, Go model + handler updates, UI selector on Log Interaction form, color-coded badge on all interaction cards |
