package com.proustclub.admin.notifications;

import com.proustclub.admin.AdminDataRepository;
import com.proustclub.admin.AdminDataRepository.AdminNotificationClaim;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminNotificationWorker {

    private static final Logger log = LoggerFactory.getLogger(AdminNotificationWorker.class);
    private final AdminDataRepository repository;
    private final JavaMailSender mailSender;

    public AdminNotificationWorker(AdminDataRepository repository, JavaMailSender mailSender) {
        this.repository = repository;
        this.mailSender = mailSender;
    }

    @Scheduled(fixedDelay = 30_000)
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void deliverPending() {
        for (int index = 0; index < 10; index++) {
            var claim = repository.claimNotification();
            if (claim.isEmpty()) return;
            deliver(claim.get());
        }
    }

    private void deliver(AdminNotificationClaim claim) {
        var preferences = repository.notificationPreferences();
        boolean enabled = switch (claim.eventType()) {
            case "REGISTRATION" -> preferences.registrationsEnabled();
            case "ACCOUNT_DELETION" -> preferences.deletionsEnabled();
            default -> false;
        };
        if (!enabled) {
            repository.markNotificationSent(claim.id());
            return;
        }
        var recipient = repository.adminEmail();
        if (recipient.isEmpty()) {
            repository.scheduleNotificationRetry(claim, "NoAdminRecipient");
            return;
        }
        try {
            var message = new SimpleMailMessage();
            message.setTo(recipient.get());
            message.setSubject(claim.eventType().equals("REGISTRATION")
                    ? "Nouvelle inscription — Proust Club" : "Suppression de compte — Proust Club");
            var eventDescription = claim.eventType().equals("REGISTRATION")
                    ? "Une nouvelle personne s’est inscrite sur Proust Club."
                    : "Une personne a supprimé son compte Proust Club.";
            message.setText(eventDescription + "\nDate et heure (UTC) : " + claim.createdAt());
            mailSender.send(message);
            repository.markNotificationSent(claim.id());
        } catch (RuntimeException e) {
            repository.scheduleNotificationRetry(claim, e.getClass().getSimpleName());
            log.warn("Admin notification delivery failed; retry scheduled (exceptionType={})", e.getClass().getSimpleName());
        }
    }
}
