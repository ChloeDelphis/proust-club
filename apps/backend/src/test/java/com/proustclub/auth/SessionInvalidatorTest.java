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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionInvalidatorTest {

    @Mock
    SessionRegistry sessionRegistry;

    @InjectMocks
    SessionInvalidator sessionInvalidator;

    @Test
    void invalidateOtherSessionsExpiresEverySessionExceptTheCurrentOne() {
        var current = new SessionInformation(new Object(), "current-session", new Date());
        var other = new SessionInformation(new Object(), "other-session", new Date());
        when(sessionRegistry.getAllSessions(any(), eq(false))).thenReturn(List.of(current, other));

        sessionInvalidator.invalidateOtherSessions("marcel", "current-session");

        assertThat(current.isExpired()).isFalse();
        assertThat(other.isExpired()).isTrue();
    }
}
