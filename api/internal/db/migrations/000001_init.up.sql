-- Org hierarchy: Acme Games (publisher) -> Subdivision -> Studio -> Customer
CREATE TABLE subdivisions (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE studios (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    subdivision_id TEXT NOT NULL REFERENCES subdivisions(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MGT-internal teams + people (interaction loggers / internal attendees)
CREATE TABLE pods (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE engineers (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    initials TEXT NOT NULL DEFAULT '',
    pod_id   TEXT REFERENCES pods(id)
);

-- App / product lifecycle statuses (extendable inline from the UI)
CREATE TABLE app_statuses (
    key      TEXT PRIMARY KEY,
    label    TEXT NOT NULL,
    badge    TEXT NOT NULL DEFAULT 'badge-other',
    position INT  NOT NULL DEFAULT 0
);

-- Customers (the "gameTeams" records; leaf of the org hierarchy)
CREATE TABLE customers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    studio_id     TEXT NOT NULL REFERENCES studios(id),
    app_status    TEXT NOT NULL DEFAULT 'prototype',
    slack_channel TEXT NOT NULL DEFAULT '',
    services      TEXT[] NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_studio ON customers (studio_id);

CREATE TABLE contacts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL DEFAULT '',
    slack       TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT '',
    customer_id TEXT REFERENCES customers(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_customer ON contacts (customer_id);

CREATE TABLE team_notes (
    id          TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    author_id   TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_team_notes_customer ON team_notes (customer_id, created_at DESC);

CREATE TABLE interactions (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL DEFAULT 'meeting',
    title       TEXT NOT NULL DEFAULT '',
    date        TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes       TEXT NOT NULL DEFAULT '',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    logged_by   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interactions_customer ON interactions (customer_id, date DESC);
CREATE INDEX idx_interactions_date ON interactions (date DESC);

CREATE TABLE interaction_attendees_mgt (
    interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    engineer_id    TEXT NOT NULL,
    PRIMARY KEY (interaction_id, engineer_id)
);

CREATE TABLE interaction_attendees_external (
    interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    contact_id     TEXT NOT NULL,
    PRIMARY KEY (interaction_id, contact_id)
);

-- Action items = commitments captured on an interaction
CREATE TABLE action_items (
    id             BIGSERIAL PRIMARY KEY,
    interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    position       INT  NOT NULL DEFAULT 0,
    text           TEXT NOT NULL,
    owner_id       TEXT,
    due_date       DATE,
    status         TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in-progress', 'closed')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_items_interaction ON action_items (interaction_id, position);

CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id    TEXT NOT NULL DEFAULT '',
    action      TEXT NOT NULL,
    record_type TEXT NOT NULL DEFAULT '',
    record_id   TEXT NOT NULL DEFAULT '',
    detail      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX idx_audit_record ON audit_log (record_type, record_id);
