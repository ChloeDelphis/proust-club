package com.proustclub.admin;

import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import org.mockito.ArgumentCaptor;

class AdminNotificationWorkerTest {

    @Test
    void sendsEnabledEventWithoutUserDetailsAndMarksItSent() {
        var repository = mock(AdminDataRepository.class);
        var mailSender = mock(JavaMailSender.class);
        var claim = new AdminNotificationClaim(
                UUID.randomUUID(), "REGISTRATION", OffsetDateTime.parse("2026-11-20T10:15:30Z"), 1);
        when(repository.claimNotification()).thenReturn(Optional.of(claim), Optional.empty());
        when(repository.notificationPreferences()).thenReturn(new AdminNotificationPreferences(true, true));
        when(repository.adminEmail()).thenReturn(Optional.of("admin@example.com"));

        new AdminNotificationWorker(repository, mailSender).deliverPending();

        var sentMessage = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(sentMessage.capture());
        assertThat(sentMessage.getValue().getText()).doesNotContain("admin@example.com", "user@example.com");
        assertThat(sentMessage.getValue().getText()).contains("Date et heure (UTC) : 2026-11-20T10:15:30Z");
        verify(repository).markNotificationSent(claim.id());
    }

    @Test
    void skipsDisabledEventAndRetriesWhenThereIsNoAdminRecipient() {
        var repository = mock(AdminDataRepository.class);
        var mailSender = mock(JavaMailSender.class);
        var disabled = new AdminNotificationClaim(
                UUID.randomUUID(), "REGISTRATION", OffsetDateTime.now(), 1);
        var withoutRecipient = new AdminNotificationClaim(
                UUID.randomUUID(), "ACCOUNT_DELETION", OffsetDateTime.now(), 2);
        when(repository.claimNotification()).thenReturn(Optional.of(disabled), Optional.of(withoutRecipient), Optional.empty());
        when(repository.notificationPreferences()).thenReturn(
                new AdminNotificationPreferences(false, true), new AdminNotificationPreferences(true, true));
        when(repository.adminEmail()).thenReturn(Optional.empty());

        new AdminNotificationWorker(repository, mailSender).deliverPending();

        verify(repository).markNotificationSent(disabled.id());
        verify(repository).scheduleNotificationRetry(withoutRecipient, "NoAdminRecipient");
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void retriesMailFailureWithoutLoggingMessageContents() {
        var repository = mock(AdminDataRepository.class);
        var mailSender = mock(JavaMailSender.class);
        var claim = new AdminNotificationClaim(UUID.randomUUID(), "ACCOUNT_DELETION", OffsetDateTime.now(), 3);
        when(repository.claimNotification()).thenReturn(Optional.of(claim), Optional.empty());
        when(repository.notificationPreferences()).thenReturn(new AdminNotificationPreferences(true, true));
        when(repository.adminEmail()).thenReturn(Optional.of("admin@example.com"));
        org.mockito.Mockito.doThrow(new MailSendException("private transport detail"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        new AdminNotificationWorker(repository, mailSender).deliverPending();

        verify(repository).scheduleNotificationRetry(claim, "MailSendException");
    }
}
