package com.proustclub.auth;

final class PasswordPolicy {

    private PasswordPolicy() {}

    static void requireDistinctFromIdentifiers(String password, String username, String email) {
        var normalizedEmail = EmailNormalizer.normalize(email);
        if (password.equalsIgnoreCase(username.trim()) || password.equalsIgnoreCase(normalizedEmail)) {
            throw ApiException.passwordMatchesIdentifier();
        }
    }
}
