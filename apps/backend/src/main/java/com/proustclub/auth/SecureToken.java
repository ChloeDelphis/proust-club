package com.proustclub.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

// Shared by every one-time link sent by email (password reset, email confirmation): a random,
// single-use, short-lived credential that only ever needs to prove possession of the link, not
// resist offline guessing of a human-chosen secret.
final class SecureToken {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private SecureToken() {
    }

    static String generate() {
        var bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // SHA-256, not the Argon2id used for user passwords: the token is already 256 bits of
    // SecureRandom entropy and short-lived/single-use, so a fast hash is enough — Argon2id's
    // deliberate slowness defends against guessing a human-chosen password, which doesn't apply
    // here and would just cost CPU for no security benefit.
    static String hash(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available on every JVM", e);
        }
    }
}
