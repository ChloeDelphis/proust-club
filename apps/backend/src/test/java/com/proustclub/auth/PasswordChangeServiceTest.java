package com.proustclub.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordChangeServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

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
    void verifyCurrentPasswordDelegatesToAuthServiceReauthenticate() {
        when(authService.reauthenticate("marcel@example.com", "old-password-long-enough")).thenReturn(mock(Authentication.class));

        service.verifyCurrentPassword("marcel@example.com", "old-password-long-enough");

        verify(authService).reauthenticate("marcel@example.com", "old-password-long-enough");
    }

    @Test
    void verifyCurrentPasswordPropagatesInvalidCredentials() {
        when(authService.reauthenticate("marcel@example.com", "wrong-password")).thenThrow(ApiException.invalidCredentials());

        assertThatThrownBy(() -> service.verifyCurrentPassword("marcel@example.com", "wrong-password"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void checkNewPasswordNotCompromisedDelegatesToAuthService() {
        service.checkNewPasswordNotCompromised("new-password-long-enough");

        verify(authService).checkPasswordNotCompromised("new-password-long-enough");
    }

    @Test
    void checkNewPasswordNotCompromisedPropagatesCompromisedPasswordException() {
        doThrow(ApiException.passwordCompromised()).when(authService).checkPasswordNotCompromised("compromised-password");

        assertThatThrownBy(() -> service.checkNewPasswordNotCompromised("compromised-password"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void changePasswordUpdatesHashAndInvalidatesOtherSessions() {
        when(passwordEncoder.encode("new-password-long-enough")).thenReturn("new-hash");

        service.changePassword(USER_ID, "new-password-long-enough", "current-session");

        verify(userRepository).updatePasswordHash(USER_ID, "new-hash");
        verify(sessionInvalidator).invalidateOtherSessions(USER_ID, "current-session");
        verify(authService, never()).reauthenticate(any(), any());
    }
}
