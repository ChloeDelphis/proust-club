package com.proustclub.auth;

import com.proustclub.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final Duration TOKEN_TTL = Duration.ofHours(24);

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final MailService mailService;

    EmailVerificationService(
            EmailVerificationTokenRepository tokenRepository, UserRepository userRepository, MailService mailService
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
    }

    // Best-effort on purpose: a transient mail failure must never roll back account creation
    // (AuthService.register() calls this from within its own transaction) — an unconfirmed
    // account is already fully usable, see the ticket's "no blocking" decision. Deliberately
    // asymmetric with PasswordResetService.requestReset(), which lets a mail failure propagate:
    // there, failure just means the user can retry the request; here, propagating would make
    // signup itself unreliable on every transient SMTP hiccup.
    @Transactional
    void sendVerification(UUID userId, String email) {
        var rawToken = SecureToken.generate();
        tokenRepository.insert(userId, SecureToken.hash(rawToken), Instant.now().plus(TOKEN_TTL));
        try {
            mailService.sendEmailConfirmation(email, rawToken);
        } catch (MailException e) {
            log.warn("Failed to send email confirmation", e);
        }
    }

    @Transactional
    void confirmVerification(String rawToken) {
        // Validated and burned in one statement — see EmailVerificationTokenRepository for why.
        var token = tokenRepository.consumeValidToken(SecureToken.hash(rawToken))
                .orElseThrow(ApiException::invalidOrExpiredVerificationToken);
        userRepository.markEmailVerified(token.userId());
        log.info("Email verified");
    }
}
