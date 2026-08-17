-- Per-interaction relationship sentiment captured when logging.
ALTER TABLE interactions
    ADD COLUMN sentiment TEXT NOT NULL DEFAULT 'neutral'
        CHECK (sentiment IN ('positive', 'neutral', 'negative'));
