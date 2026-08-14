package com.proustclub.auth;

import com.proustclub.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final String TOKEN_TABLE = "password_reset_tokens";

    private final OneTimeTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    PasswordResetService(
            OneTimeTokenRepository tokenRepository, UserRepository userRepository,
            PasswordEncoder passwordEncoder, MailService mailService
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
    }

    // Never throws and never reveals whether the email matched an account — the controller
    // always returns the same generic response regardless of what happens in here. Mail send
    // failures are swallowed rather than left to propagate: an uncaught MailException here would
    // roll back the transaction and surface as a 500 only for a *known* email (an unknown email
    // never reaches mailService at all), which would let a caller distinguish "account exists" from
    // "no such account" during any SMTP outage — defeating the anti-enumeration guarantee this
    // method exists to provide. Same best-effort posture as EmailVerificationService.sendVerification().
    @Transactional
    void requestReset(String email) {
        var normalizedEmail = EmailNormalizer.normalize(email);

        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            // A fresh request supersedes any still-live token from an earlier one — a user only
            // ever has one valid reset link at a time.
            tokenRepository.invalidateAllUnusedForUser(TOKEN_TABLE, user.uuid());

            var rawToken = SecureToken.generate();
            tokenRepository.insert(TOKEN_TABLE, user.uuid(), SecureToken.hash(rawToken), Instant.now().plus(TOKEN_TTL));
            try {
                mailService.sendPasswordResetEmail(user.email(), rawToken);
            } catch (MailException e) {
                log.warn("Failed to send password reset email", e);
            }
            log.info("Password reset requested");
        });
    }

    // Returns the updated user so the caller can open a new session (auto-login, same intent as
    // AuthService.register()) directly from it — no need to re-authenticate through
    // AuthenticationManager just to re-verify a password this method itself just wrote.
    @Transactional
    AuthUser confirmReset(String rawToken, String newPassword) {
        // Validated and burned in one statement — see OneTimeTokenRepository for why.
        var token = tokenRepository.consumeValidToken(TOKEN_TABLE, SecureToken.hash(rawToken))
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        // Enforced by a foreign key with ON DELETE CASCADE, so this should never be empty in
        // practice; reusing the same generic exception rather than adding a dedicated case for a
        // scenario that shouldn't occur (same reasoning as AuthService.currentUser()).
        var user = userRepository.findByUuid(token.userId())
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        var newPasswordHash = passwordEncoder.encode(newPassword);
        userRepository.updatePasswordHash(user.uuid(), newPasswordHash);
        log.info("Password reset confirmed");
        return new AuthUser(user.uuid(), user.username(), user.email(), newPasswordHash, user.role(), user.emailVerified());
    }
}
