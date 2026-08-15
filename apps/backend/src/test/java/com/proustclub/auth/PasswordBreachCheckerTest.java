package com.proustclub.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// Deliberately hits the real HIBP API (no mock) — this is the only test exercising the actual
// RestClient wiring built in PasswordBreachChecker's constructor. Every other test in this codebase
// mocks PasswordBreachChecker away, which is exactly why a real misconfiguration (missing baseUrl,
// see the constant comment on PasswordBreachChecker) went undetected until a manual code review:
// every check() call was throwing on a relative URI and silently falling open, with no test
// noticing since none of them ever ran the real delegate.
class PasswordBreachCheckerTest {

    private final PasswordBreachChecker checker = new PasswordBreachChecker();

    @Test
    void detectsAWellKnownCompromisedPassword() {
        assertThat(checker.isCompromised("password123")).isTrue();
    }

    @Test
    void doesNotFlagAnUnlikelyToBeCompromisedPassphrase() {
        assertThat(checker.isCompromised("Combray-Guermantes-Balbec-19260815-xkq7")).isFalse();
    }
}
