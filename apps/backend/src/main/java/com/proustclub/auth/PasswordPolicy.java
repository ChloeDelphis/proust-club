package com.proustclub.auth;

import com.proustclub.common.EmailNormalizer;
import com.proustclub.auth.ApiException;
public final class PasswordPolicy {

    private PasswordPolicy() {}

    public static void requireDistinctFromIdentifiers(String password, String username, String email) {
        var normalizedEmail = EmailNormalizer.normalize(email);
        if ((username != null && password.equalsIgnoreCase(username.trim()))
                || password.equalsIgnoreCase(normalizedEmail)) {
            throw ApiException.passwordMatchesIdentifier();
        }
    }
}
