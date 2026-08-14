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
    private static final String TOKEN_TABLE = "email_verification_tokens";

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

    // Best-effort on purpose: a transient mail failure must never roll back account creation
    // (AuthService.register() calls this from within its own transaction) — an unconfirmed
    // account is already fully usable, see the ticket's "no blocking" decision. Same posture as
    // PasswordResetService.requestReset(), which swallows mail failures for a different but
    // related reason: there, propagating would let a caller distinguish "account exists" from
    // "no such account" during an SMTP outage, breaking anti-enumeration.
    @Transactional
    void sendVerification(UUID userId, String email) {
        var rawToken = SecureToken.generate();
        tokenRepository.insert(TOKEN_TABLE, userId, SecureToken.hash(rawToken), Instant.now().plus(TOKEN_TTL));
        try {
            mailService.sendEmailConfirmation(email, rawToken);
        } catch (MailException e) {
            // Exception class only, not the throwable itself: MailSendException/SendFailedException
            // routinely embed the rejected recipient address in their message (SMTP bounces echo it
            // back) — logging the full exception would leak the email, which CLAUDE.md forbids.
            log.warn("Failed to send email confirmation ({})", e.getClass().getSimpleName());
        }
    }

    // Guards on the user's current state rather than silently no-op'ing on an already-verified
    // account: unlike PasswordResetService.requestReset(), this endpoint is authenticated (the
    // caller already proved they own the account), so there's no anti-enumeration reason to stay
    // generic — a clear 409 is more useful than a silent success that resends nothing.
    @Transactional
    void resendVerification(String username) {
        var user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
        if (user.emailVerified()) {
            throw ApiException.emailAlreadyVerified();
        }
        // A user never has more than one live confirmation link at once, same policy as
        // PasswordResetService.requestReset() — scoped to resend rather than folded into
        // sendVerification() so registration (the other caller) doesn't pay for a guaranteed
        // no-op invalidation query (no prior token exists yet on a brand-new account).
        tokenRepository.invalidateAllUnusedForUser(TOKEN_TABLE, user.uuid());
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
