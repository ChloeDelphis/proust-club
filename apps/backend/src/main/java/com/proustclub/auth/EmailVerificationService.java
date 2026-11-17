package com.proustclub.auth;

import com.proustclub.mail.MailFailureLogger;
import com.proustclub.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final Duration TOKEN_TTL = Duration.ofHours(24);
    private static final OneTimeTokenTable TOKEN_TABLE = OneTimeTokenTable.EMAIL_VERIFICATION;

    private final OneTimeTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final MailService mailService;

    EmailVerificationService(
            OneTimeTokenRepository tokenRepository, UserRepository userRepository, MailService mailService
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
    }

    // Creates the token inside the current transaction and publishes a mail event. MailService's
    // listener sends it only after commit, so SMTP never holds this transaction open and cannot
    // send a link for a token whose transaction later rolls back. Delivery remains best-effort:
    // account creation is not blocked by an SMTP failure.
    @Transactional
    void sendVerification(UUID userId, String email) {
        var rawToken = SecureToken.generate();
        tokenRepository.insert(TOKEN_TABLE, userId, SecureToken.hash(rawToken), Instant.now().plus(TOKEN_TTL));
        MailFailureLogger.sendBestEffort(
                log, "email confirmation", () -> mailService.sendEmailConfirmation(email, rawToken));
    }

    // Guards on the user's current state rather than silently no-op'ing on an already-verified
    // account: unlike PasswordResetService.requestReset(), this endpoint is authenticated (the
    // caller already proved they own the account), so there's no anti-enumeration reason to stay
    // generic — a clear 409 is more useful than a silent success that resends nothing.
    @Transactional
    void resendVerification(UUID userId) {
        var user = userRepository.findByUuid(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + userId));
        if (user.emailVerified()) {
            throw ApiException.emailAlreadyVerified();
        }
        // A user never has more than one live confirmation link at once, same policy as
        // PasswordResetService.requestReset() — enforced atomically by insert() itself (upsert on
        // the "one live token per user" partial unique index), see OneTimeTokenRepository.
        sendVerification(user.uuid(), user.email());
    }

    @Transactional
    void confirmVerification(String rawToken) {
        // Validated and burned in one statement — see OneTimeTokenRepository for why.
        var token = tokenRepository.consumeValidToken(TOKEN_TABLE, SecureToken.hash(rawToken))
                .orElseThrow(ApiException::invalidOrExpiredVerificationToken);
        userRepository.markEmailVerified(token.userId());
        log.info("Email verified");
    }
}
