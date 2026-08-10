package com.proustclub.auth;

import com.proustclub.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final SessionRegistry sessionRegistry;

    PasswordResetService(
            PasswordResetTokenRepository tokenRepository, UserRepository userRepository,
            PasswordEncoder passwordEncoder, MailService mailService, SessionRegistry sessionRegistry
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.sessionRegistry = sessionRegistry;
    }

    // Never throws and never reveals whether the email matched an account — the controller
    // always returns the same generic response regardless of what happens in here.
    @Transactional
    void requestReset(String email) {
        var normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            // A fresh request supersedes any still-live token from an earlier one — a user only
            // ever has one valid reset link at a time.
            tokenRepository.invalidateAllUnusedForUser(user.uuid());

            var rawToken = generateToken();
            tokenRepository.insert(user.uuid(), hash(rawToken), Instant.now().plus(TOKEN_TTL));
            mailService.sendPasswordResetEmail(user.email(), rawToken);
            log.info("Password reset requested");
        });
    }

    // Returns the username so the caller can open a new session (auto-login, same pattern as
    // AuthService.register()) — this method only replaces the password, it doesn't authenticate.
    @Transactional
    String confirmReset(String rawToken, String newPassword) {
        var token = tokenRepository.findValidByTokenHash(hash(rawToken))
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        // Burned immediately — a token funds exactly one confirm attempt, successful or not, so
        // an intercepted link can't be retried against this endpoint.
        tokenRepository.markUsed(token.id());

        // Enforced by a foreign key with ON DELETE CASCADE, so this should never be empty in
        // practice; reusing the same generic exception rather than adding a dedicated case for a
        // scenario that shouldn't occur (same reasoning as AuthService.currentUser()).
        var user = userRepository.findByUuid(token.userId())
                .orElseThrow(ApiException::invalidOrExpiredResetToken);

        userRepository.updatePasswordHash(user.uuid(), passwordEncoder.encode(newPassword));
        log.info("Password reset confirmed");
        return user.username();
    }

    // Called once the caller has established its own new session, so that session's id can be
    // excluded from the sweep.
    void invalidateOtherSessions(String username, String currentSessionId) {
        // SessionRegistry keys sessions by the exact principal object used at login time
        // (org.springframework.security.core.userdetails.User, see AuthUserDetailsService) —
        // its equals()/hashCode() compare username only, so a lookalike User with a throwaway
        // password matches every real session for this user.
        var principal = new User(username, "N/A", List.of());
        sessionRegistry.getAllSessions(principal, false).stream()
                .filter(session -> !session.getSessionId().equals(currentSessionId))
                .forEach(SessionInformation::expireNow);
    }

    private static String generateToken() {
        var bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // SHA-256, not the Argon2id used for user passwords: the token is already 256 bits of
    // SecureRandom entropy and short-lived/single-use, so a fast hash is enough — Argon2id's
    // deliberate slowness defends against guessing a human-chosen password, which doesn't apply
    // here and would just cost CPU for no security benefit.
    private static String hash(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available on every JVM", e);
        }
    }
}
