package com.proustclub.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordChangeServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    AuthService authService;

    @Mock
    SessionInvalidator sessionInvalidator;

    @InjectMocks
    PasswordChangeService service;

    @Test
    void changePasswordUpdatesHashAndInvalidatesOtherSessionsWhenCurrentPasswordIsCorrect() {
        when(authService.reauthenticate("marcel", "old-password-long-enough")).thenReturn(mock(Authentication.class));
        when(passwordEncoder.encode("new-password-long-enough")).thenReturn("new-hash");

        service.changePassword("marcel", "old-password-long-enough", "new-password-long-enough", "current-session");

        verify(userRepository).updatePasswordHash("marcel", "new-hash");
        verify(sessionInvalidator).invalidateOtherSessions("marcel", "current-session");
    }

    @Test
    void changePasswordRejectsIncorrectCurrentPassword() {
        when(authService.reauthenticate("marcel", "wrong-password")).thenThrow(ApiException.invalidCredentials());

        assertThatThrownBy(() ->
                service.changePassword("marcel", "wrong-password", "new-password-long-enough", "current-session"))
                .isInstanceOf(ApiException.class);

        verify(userRepository, never()).updatePasswordHash(any(String.class), any());
        verify(sessionInvalidator, never()).invalidateOtherSessions(any(), any());
    }
}
