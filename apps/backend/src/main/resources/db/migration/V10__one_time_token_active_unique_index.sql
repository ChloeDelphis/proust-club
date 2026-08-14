-- Enforces "a user never has more than one live token at once" at the DB level, so the
-- invalidate-then-insert race between concurrent requests (double click, two tabs) can no longer
-- leave two unused tokens behind. Shared by both one-time-token tables (password_reset_tokens,
-- email_verification_tokens) since both go through the same OneTimeTokenRepository.

CREATE UNIQUE INDEX idx_password_reset_tokens_active_user
    ON password_reset_tokens (user_id) WHERE used_at IS NULL;

CREATE UNIQUE INDEX idx_email_verification_tokens_active_user
    ON email_verification_tokens (user_id) WHERE used_at IS NULL;
