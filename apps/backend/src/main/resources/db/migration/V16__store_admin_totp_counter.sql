ALTER TABLE admin_mfa_credentials
    RENAME COLUMN last_totp_used_at TO last_totp_counter;

ALTER TABLE admin_mfa_credentials
    ALTER COLUMN last_totp_counter TYPE BIGINT
    USING floor(extract(epoch FROM last_totp_counter) / 30)::BIGINT;
