package com.proustclub.auth;

import org.slf4j.Logger;
import org.springframework.mail.MailException;

// Shared by EmailVerificationService.sendVerification() and PasswordResetService.requestReset():
// both swallow a best-effort mail send the same way (never propagate, log the exception class
// only — never the throwable itself, which routinely embeds the rejected recipient address on an
// SMTP bounce, and CLAUDE.md forbids logging emails unnecessarily). AuthService's fail-open catch
// is deliberately not unified here — different exception type, different logging need, different
// role (secondary safety net, not this best-effort posture).
final class MailFailureLogger {

    private MailFailureLogger() {
    }

    static void sendBestEffort(Logger log, String action, Runnable send) {
        try {
            send.run();
        } catch (MailException e) {
            log.warn("Failed to send {} ({})", action, e.getClass().getSimpleName());
        }
    }
}
