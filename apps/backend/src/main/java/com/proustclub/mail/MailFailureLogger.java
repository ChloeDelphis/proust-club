package com.proustclub.mail;

import org.slf4j.Logger;
import org.springframework.mail.MailException;

// Email addresses and token-bearing message bodies must not leak through SMTP exception messages.
public final class MailFailureLogger {

    private MailFailureLogger() {}

    public static void sendBestEffort(Logger log, String action, Runnable send) {
        try {
            send.run();
        } catch (MailException e) {
            log.warn("Failed to send {} ({})", action, e.getClass().getSimpleName());
        }
    }
}
