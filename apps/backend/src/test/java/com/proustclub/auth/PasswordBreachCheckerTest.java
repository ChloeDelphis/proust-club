package com.proustclub.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.web.authentication.password.HaveIBeenPwnedRestApiPasswordChecker;
import org.springframework.web.client.RestClient;

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

    // Validates the *actual* fail-open mechanism for a real HIBP outage — found by /code-review,
    // confirmed by decompiling spring-security-web 7.1.0: HaveIBeenPwnedRestApiPasswordChecker's
    // own check() already swallows RestClientException (connection failure, timeout, HIBP 4xx/5xx)
    // and returns "not compromised" — AuthService's own catch(RuntimeException) never gets a
    // chance to run for this failure mode. Not testable through PasswordBreachChecker itself (its
    // baseUrl is fixed to the real API), so this drives the underlying Spring Security class
    // directly, pointed at a host guaranteed not to resolve.
    @Test
    void hibpDelegateFailsOpenOnConnectionFailureRatherThanThrowing() {
        var unreachable = new HaveIBeenPwnedRestApiPasswordChecker();
        unreachable.setRestClient(RestClient.builder().baseUrl("https://unreachable.invalid/range/").build());

        assertThat(unreachable.check("password123").isCompromised()).isFalse();
    }
}
