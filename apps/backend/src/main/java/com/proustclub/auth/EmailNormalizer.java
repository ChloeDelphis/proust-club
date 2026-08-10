package com.proustclub.auth;

import java.util.Locale;

// Email is case-insensitive in practice (mail providers treat it that way); normalizing before
// every check/lookup/insert makes the plain UNIQUE constraint on the column behave as a
// case-insensitive one, without needing citext or a functional index. Single source of truth for
// this rule — used by registration, password reset, and the password-reset rate limiter, so the
// same normalized string is always used as both the DB key and the rate-limit bucket key.
public final class EmailNormalizer {

    private EmailNormalizer() {}

    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
