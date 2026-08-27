package com.proustclub.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;

import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionInvalidatorTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    SessionRegistry sessionRegistry;

    @InjectMocks
    SessionInvalidator sessionInvalidator;

    @Test
    void invalidateOtherSessionsExpiresEverySessionExceptTheCurrentOne() {
        var principal = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");
        var current = new SessionInformation(principal, "current-session", new Date());
        var other = new SessionInformation(principal, "other-session", new Date());
        when(sessionRegistry.getAllSessions(eq(principal), eq(false))).thenReturn(List.of(current, other));

        sessionInvalidator.invalidateOtherSessions(principal, "current-session");

        assertThat(current.isExpired()).isFalse();
        assertThat(other.isExpired()).isTrue();
    }

    // The passed-in principal need not be the exact instance that registered a given session —
    // equals()/hashCode() on userId alone means any ProustClubPrincipal for this user retrieves
    // the full session set, including ones from other logins/devices (see ProustClubPrincipal).
    @Test
    void invalidateOtherSessionsWorksWithAnyEqualPrincipalInstance() {
        var registeredAtLogin = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "old-hash", "USER");
        var passedInLater = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", null, "USER");
        var other = new SessionInformation(registeredAtLogin, "other-session", new Date());
        when(sessionRegistry.getAllSessions(eq(passedInLater), eq(false))).thenReturn(List.of(other));

        sessionInvalidator.invalidateOtherSessions(passedInLater, "current-session");

        assertThat(other.isExpired()).isTrue();
    }
}
