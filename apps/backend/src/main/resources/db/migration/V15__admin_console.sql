-- Privileged admin authentication, aggregate usage metrics and notification delivery.

CREATE TABLE admin_mfa_credentials (
    user_id             UUID PRIMARY KEY REFERENCES users(uuid) ON DELETE CASCADE,
    secret_ciphertext   BYTEA       NOT NULL,
    last_totp_used_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_mfa_recovery_codes (
    user_id             UUID        NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    code_hash           CHAR(64)    NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at             TIMESTAMPTZ,
    PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE admin_daily_metrics (
    metric_date         DATE        PRIMARY KEY,
    registrations       INTEGER     NOT NULL DEFAULT 0 CHECK (registrations >= 0),
    account_deletions   INTEGER     NOT NULL DEFAULT 0 CHECK (account_deletions >= 0)
);

CREATE TABLE admin_notification_settings (
    id                          SMALLINT    PRIMARY KEY CHECK (id = 1),
    registrations_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    deletions_enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_notification_outbox (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          VARCHAR(32) NOT NULL CHECK (event_type IN ('REGISTRATION', 'ACCOUNT_DELETION')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts            INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_until       TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    last_error_type     VARCHAR(128)
);

CREATE INDEX admin_notification_outbox_pending_idx
    ON admin_notification_outbox (next_attempt_at, created_at)
    WHERE sent_at IS NULL;
