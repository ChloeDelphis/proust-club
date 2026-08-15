package com.proustclub.auth;

import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

// PasswordBreachChecker is package-private (like every other auth/ collaborator), so no test
// outside com.proustclub.auth can declare a field of that type to override it directly. Without
// this, every @SpringBootTest that calls register() — not just auth-specific ones — makes a real
// outbound HTTPS call to api.pwnedpasswords.com on every run (found by /code-review: 7 unrelated
// test classes were doing exactly this, unnoticed because it happens to succeed silently rather
// than fail). @Primary overrides the real @Component-scanned bean; isCompromised() defaults to
// Mockito's standard "false" for an unstubbed boolean method — the same "not compromised" outcome
// those tests already relied on, just without the network call. AuthControllerTest doesn't import
// this — it needs per-test control over compromised/not-compromised and already declares its own
// @MockitoBean for that.
@TestConfiguration
public class PasswordBreachCheckerTestConfig {

    @Bean
    @Primary
    PasswordBreachChecker passwordBreachChecker() {
        return Mockito.mock(PasswordBreachChecker.class);
    }
}
