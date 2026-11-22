package com.proustclub.auth.password;


import com.proustclub.auth.repository.OneTimeTokenRepository;
import com.proustclub.auth.repository.OneTimeTokenTable;
import com.proustclub.auth.AuthService;
import com.proustclub.common.EmailNormalizer;
import com.proustclub.auth.ApiException;
import com.proustclub.auth.PasswordPolicy;
import com.proustclub.auth.SecureToken;
import com.proustclub.auth.model.AuthUser;
import com.proustclub.auth.repository.UserRepository;
import com.proustclub.mail.MailFailureLogger;
import com.proustclub.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final OneTimeTokenTable TOKEN_TABLE = OneTimeTokenTable.PASSWORD_RESET;

    private final OneTimeTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final AuthService authService;

    public PasswordResetService(
            OneTimeTokenRepository tokenRepository, UserRepository userRepository,
            PasswordEncoder passwordEncoder, MailService mailService, AuthService authService
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.authService = authService;
    }

    // Never reveals whether the email matched an account — the controller always returns the same
    // generic response. MailService publishes a rendered message for after-commit delivery; its
    // listener absorbs SMTP failures, preserving both anti-enumeration and best-effort behavior.
    @Transactional
    public void requestReset(String email) {
        var normalizedEmail = EmailNormalizer.normalize(email);

        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            // A fresh request supersedes any still-live token from an earlier one — a user only
            // ever has one valid reset link at a time. Enforced atomically by insert() itself
            // (upsert on the "one live token per user" partial unique index), see
            // OneTimeTokenRepository for why this can't be a separate invalidate-then-insert.
            var rawToken = SecureToken.generate();
            tokenRepository.insert(TOKEN_TABLE, user.uuid(), SecureToken.hash(rawToken), Instant.now().plus(TOKEN_TTL));
            MailFailureLogger.sendBestEffort(
                    log, "password reset email", () -> mailService.sendPasswordResetEmail(user.email(), rawToken));
            log.info("Password reset requested");
        });
    }

    // Not @Transactional — makes an external HTTP call (PasswordBreachChecker), same reasoning as
    // AuthService.checkPasswordNotCompromised() for register(). Called from the controller before
    // confirmReset(), so the token is never burned on a password that gets rejected here.
    //
    // Gated on a read-only token lookup rather than called
    // unconditionally: this endpoint is unauthenticated, so without the peek any request with a
    // made-up token would still pay for a real HIBP round trip. confirmReset() below still
    // revalidates and consumes the token atomically regardless of what this peek observed — the
    // peek is purely an optimization to avoid spending an HIBP call on a token that's already dead,
    // never the actual source of truth on token validity. The decision lives here (not in the
    // controller) so PasswordResetController stays a flat sequence of service calls, like every
    // other controller in this package.
    public void checkNewPasswordPolicyIfTokenLooksValid(String rawToken, String newPassword) {
        tokenRepository.findValidTokenUserId(TOKEN_TABLE, SecureToken.hash(rawToken))
                .flatMap(userRepository::findByUuid)
                .ifPresent(user -> {
                    PasswordPolicy.requireDistinctFromIdentifiers(newPassword, user.username(), user.email());
                    authService.checkPasswordNotCompromised(newPassword);
                });
    }

    // Returns the updated user so the caller can open a new session (auto-login, same intent as
    // AuthService.register()) directly from it — no need to re-authenticate through
    // AuthenticationManager just to re-verify a password this method itself just wrote.
    @Transactional
    public AuthUser confirmReset(String rawToken, String newPassword) {
        // Validated and burned in one statement — see OneTimeTokenRepository for why.
        var token = tokenRepository.consumeValidToken(TOKEN_TABLE, SecureToken.hash(rawToken))
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        // Enforced by a foreign key with ON DELETE CASCADE, so this should never be empty in
        // practice; reusing the same generic exception rather than adding a dedicated case for a
        // scenario that shouldn't occur (same reasoning as AuthService.currentUser()).
        var user = userRepository.findByUuid(token.userId())
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        // Revalidate beside the write; the controller's earlier check exists to reject locally
        // before HIBP, while this transaction guarantees the invariant at password update time.
        PasswordPolicy.requireDistinctFromIdentifiers(newPassword, user.username(), user.email());
        var newPasswordHash = passwordEncoder.encode(newPassword);
        userRepository.updatePasswordHash(user.uuid(), newPasswordHash);
        log.info("Password reset confirmed");
        return new AuthUser(user.uuid(), user.username(), user.email(), newPasswordHash, user.role(), user.emailVerified());
    }
}
