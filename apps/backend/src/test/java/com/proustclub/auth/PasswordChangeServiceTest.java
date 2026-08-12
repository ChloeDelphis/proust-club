package com.proustclub.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

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
    AuthenticationManager authenticationManager;

    @Mock
    SessionInvalidator sessionInvalidator;

    @InjectMocks
    PasswordChangeService service;

    @Test
    void changePasswordUpdatesHashAndInvalidatesOtherSessionsWhenCurrentPasswordIsCorrect() {
        var uuid = UUID.randomUUID();
        var user = new AuthUser(uuid, "marcel", "marcel@example.com", "old-hash", "USER");
        when(authenticationManager.authenticate(any())).thenReturn(mock(Authentication.class));
        when(userRepository.findByUsername("marcel")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password-long-enough")).thenReturn("new-hash");

        service.changePassword("marcel", "old-password-long-enough", "new-password-long-enough", "current-session");

        verify(userRepository).updatePasswordHash(uuid, "new-hash");
        verify(sessionInvalidator).invalidateOtherSessions("marcel", "current-session");
    }

    @Test
    void changePasswordRejectsIncorrectCurrentPassword() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        assertThatThrownBy(() ->
                service.changePassword("marcel", "wrong-password", "new-password-long-enough", "current-session"))
                .isInstanceOf(ApiException.class);

        verify(userRepository, never()).updatePasswordHash(any(), any());
        verify(sessionInvalidator, never()).invalidateOtherSessions(any(), any());
    }
}
