-- Enforces "a user never has more than one live token at once" at the DB level, so the
-- invalidate-then-insert race between concurrent requests (double click, two tabs) can no longer
-- leave two unused tokens behind. Shared by both one-time-token tables (password_reset_tokens,
-- email_verification_tokens) since both go through the same OneTimeTokenRepository.

-- Deduplicate first: the race this migration closes may already have left a user with more than
-- one live (used_at IS NULL) token, which would make CREATE UNIQUE INDEX below fail outright.
-- Keep the most recently issued live token per user, mark any older ones as used.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM password_reset_tokens
    WHERE used_at IS NULL
)
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM email_verification_tokens
    WHERE used_at IS NULL
)
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX idx_password_reset_tokens_active_user
    ON password_reset_tokens (user_id) WHERE used_at IS NULL;

CREATE UNIQUE INDEX idx_email_verification_tokens_active_user
    ON email_verification_tokens (user_id) WHERE used_at IS NULL;
