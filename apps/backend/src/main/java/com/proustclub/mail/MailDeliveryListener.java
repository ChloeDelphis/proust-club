package com.proustclub.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
class MailDeliveryListener {

    private static final Logger log = LoggerFactory.getLogger(MailDeliveryListener.class);

    private final JavaMailSender mailSender;

    MailDeliveryListener(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void deliver(MailDeliveryRequested event) {
        MailFailureLogger.sendBestEffort(log, event.action(), () -> {
            var message = new SimpleMailMessage();
            message.setTo(event.recipient());
            message.setSubject(event.subject());
            message.setText(event.body());
            mailSender.send(message);
            log.info("{} sent", event.action());
        });
    }
}
