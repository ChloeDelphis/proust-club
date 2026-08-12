package com.proustclub.auth;

import com.proustclub.mail.MailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    OneTimeTokenRepository tokenRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    MailService mailService;

    @InjectMocks
    PasswordResetService service;

    @Test
    void requestResetInvalidatesPreviousTokensAndSendsEmailForKnownAccount() {
        var uuid = UUID.randomUUID();
        var user = new AuthUser(uuid, "marcel", "marcel@example.com", "hashed", "USER", true);
        when(userRepository.findByEmail("marcel@example.com")).thenReturn(Optional.of(user));

        service.requestReset("marcel@example.com");

        verify(tokenRepository).invalidateAllUnusedForUser(eq("password_reset_tokens"), eq(uuid));
        verify(tokenRepository).insert(eq("password_reset_tokens"), eq(uuid), anyString(), any(Instant.class));
        verify(mailService).sendPasswordResetEmail(eq("marcel@example.com"), anyString());
    }

    @Test
    void requestResetNormalizesEmailBeforeLookup() {
        when(userRepository.findByEmail("marcel@example.com")).thenReturn(Optional.empty());

        service.requestReset("  Marcel@Example.com ");

        verify(userRepository).findByEmail("marcel@example.com");
    }

    @Test
    void requestResetDoesNothingForUnknownEmail() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        service.requestReset("ghost@example.com");

        verify(tokenRepository, never()).insert(any(), any(), any(), any());
        verifyNoInteractions(mailService);
    }

    @Test
    void confirmResetBurnsTokenAndUpdatesPassword() {
        var uuid = UUID.randomUUID();
        var token = new OneTimeToken(42L, uuid);
        var user = new AuthUser(uuid, "marcel", "marcel@example.com", "old-hash", "USER", true);

        when(tokenRepository.consumeValidToken(anyString(), anyString())).thenReturn(Optional.of(token));
        when(userRepository.findByUuid(uuid)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password-long-enough")).thenReturn("new-hash");

        var updatedUser = service.confirmReset("raw-token", "new-password-long-enough");

        assertThat(updatedUser.username()).isEqualTo("marcel");
        assertThat(updatedUser.passwordHash()).isEqualTo("new-hash");
        verify(userRepository).updatePasswordHash(uuid, "new-hash");
    }

    @Test
    void confirmResetRejectsUnknownToken() {
        when(tokenRepository.consumeValidToken(anyString(), anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.confirmReset("garbage-token", "new-password-long-enough"))
                .isInstanceOf(ApiException.class);

        verify(userRepository, never()).updatePasswordHash(any(UUID.class), any());
    }
}
