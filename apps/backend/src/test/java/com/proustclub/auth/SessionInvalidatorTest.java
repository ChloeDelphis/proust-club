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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
        when(sessionRegistry.getAllPrincipals()).thenReturn(List.of(principal));
        when(sessionRegistry.getAllSessions(eq(principal), eq(false))).thenReturn(List.of(current, other));

        sessionInvalidator.invalidateOtherSessions(USER_ID, "current-session");

        assertThat(current.isExpired()).isFalse();
        assertThat(other.isExpired()).isTrue();
    }

    @Test
    void invalidateOtherSessionsIgnoresPrincipalsForOtherUsers() {
        var thisUser = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");
        var otherUser = new ProustClubPrincipal(UUID.randomUUID(), "swann", "swann@example.com", "hash", "USER");
        when(sessionRegistry.getAllPrincipals()).thenReturn(List.of(thisUser, otherUser));
        when(sessionRegistry.getAllSessions(eq(thisUser), eq(false))).thenReturn(List.of());

        sessionInvalidator.invalidateOtherSessions(USER_ID, "current-session");

        verify(sessionRegistry, never()).getAllSessions(eq(otherUser), eq(false));
    }
}
