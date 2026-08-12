package com.proustclub.auth;

import com.proustclub.mail.MailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

    @Mock
    EmailVerificationTokenRepository tokenRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    MailService mailService;

    @InjectMocks
    EmailVerificationService service;

    @Test
    void sendVerificationInsertsTokenAndSendsEmail() {
        var uuid = UUID.randomUUID();

        service.sendVerification(uuid, "marcel@example.com");

        verify(tokenRepository).insert(eq(uuid), anyString(), any(Instant.class));
        verify(mailService).sendEmailConfirmation(eq("marcel@example.com"), anyString());
    }

    // Best-effort by design: a transient mail failure must not roll back the account creation
    // that calls this — see the comment on EmailVerificationService.sendVerification().
    @Test
    void sendVerificationSwallowsMailFailure() {
        var uuid = UUID.randomUUID();
        doThrow(new MailSendException("smtp unreachable")).when(mailService).sendEmailConfirmation(anyString(), anyString());

        assertThatCode(() -> service.sendVerification(uuid, "marcel@example.com")).doesNotThrowAnyException();

        verify(tokenRepository).insert(eq(uuid), anyString(), any(Instant.class));
    }

    @Test
    void confirmVerificationMarksEmailVerified() {
        var uuid = UUID.randomUUID();
        var token = new EmailVerificationToken(42L, uuid);
        when(tokenRepository.consumeValidToken(anyString())).thenReturn(Optional.of(token));

        service.confirmVerification("raw-token");

        verify(userRepository).markEmailVerified(uuid);
    }

    @Test
    void confirmVerificationRejectsUnknownToken() {
        when(tokenRepository.consumeValidToken(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.confirmVerification("garbage-token"))
                .isInstanceOf(ApiException.class);

        verify(userRepository, never()).markEmailVerified(any());
    }
}
