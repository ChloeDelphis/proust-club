package com.proustclub.auth;

import com.proustclub.auth.dto.RegisterRequest;
import com.proustclub.auth.dto.UserResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailVerificationService emailVerificationService;
    private final PasswordBreachChecker passwordBreachChecker;

    AuthService(
            UserRepository repository, PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager, EmailVerificationService emailVerificationService,
            PasswordBreachChecker passwordBreachChecker
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.emailVerificationService = emailVerificationService;
        this.passwordBreachChecker = passwordBreachChecker;
    }

    // Not @Transactional, and deliberately called from the controller before register() rather
    // than from inside it: register() runs inside a single DB transaction, and this makes an
    // external HTTP call (PasswordBreachChecker) — holding a DB connection open for the duration
    // of that call would be wasteful. Splitting register() itself into a non-transactional wrapper
    // calling an internal @Transactional method wouldn't work either: calling this.someMethod()
    // from within the same class bypasses Spring's proxy-based AOP, so @Transactional on that
    // inner method would silently do nothing. checkNoCheapConflicts() below follows the same
    // pattern, and is called first by the controller so a request that's already invalid never
    // pays for this HTTP round-trip.
    void checkPasswordNotCompromised(String password) {
        boolean compromised;
        try {
            compromised = passwordBreachChecker.isCompromised(password);
        } catch (RuntimeException e) {
            // Secondary safety net, not the primary fail-open path: PasswordBreachChecker's
            // delegate (HaveIBeenPwnedRestApiPasswordChecker.check()) already swallows
            // RestClientException internally (timeout, connection failure, HIBP 4xx/5xx) and
            // returns "not compromised" — confirmed by decompiling spring-security-web 7.1.0 — so
            // this catch only ever fires for something outside that (a bug here, an unexpected
            // NPE, a future Spring Security behavior change). Kept anyway as a second layer: fail
            // open, never log the password itself. The throw below is deliberately outside this
            // try block so it can never be swallowed by this catch, regardless of clause order.
            log.warn("Compromised password check failed, allowing registration to proceed", e);
            return;
        }
        if (compromised) {
            throw ApiException.passwordCompromised();
        }
    }

    // Not @Transactional, deliberately called from the controller before checkPasswordNotCompromised()
    // — same reasoning as that method's comment above: a request that's already invalid on these
    // cheap, local criteria (in-memory comparison, indexed SELECTs) shouldn't pay for the HIBP
    // network round-trip first. register() re-runs the same checks inside its own transaction
    // regardless (see below) — that's not new work caused by this pre-check, it was already
    // required to close the TOCTOU race on username/email uniqueness.
    void checkNoCheapConflicts(RegisterRequest request) {
        var normalizedEmail = EmailNormalizer.normalize(request.email());
        requirePasswordDistinctFromIdentifiers(request.password(), request.username(), normalizedEmail);
        requireUsernameAndEmailAvailable(request.username(), normalizedEmail);
    }

    @Transactional
    UserResponse register(RegisterRequest request) {
        var normalizedEmail = EmailNormalizer.normalize(request.email());
        requirePasswordDistinctFromIdentifiers(request.password(), request.username(), normalizedEmail);
        requireUsernameAndEmailAvailable(request.username(), normalizedEmail);

        var passwordHash = passwordEncoder.encode(request.password());
        var uuid = repository.insert(request.username(), normalizedEmail, passwordHash);
        log.info("User registered: {}", request.username());

        emailVerificationService.sendVerification(uuid, normalizedEmail);

        return new UserResponse(uuid, request.username(), normalizedEmail, "USER", false);
    }

    private void requirePasswordDistinctFromIdentifiers(String password, String username, String normalizedEmail) {
        if (password.equalsIgnoreCase(username.trim()) || password.equalsIgnoreCase(normalizedEmail)) {
            throw ApiException.passwordMatchesIdentifier();
        }
    }

    private void requireUsernameAndEmailAvailable(String username, String normalizedEmail) {
        if (repository.existsByUsername(username)) {
            throw ApiException.usernameAlreadyExists();
        }
        if (repository.existsByEmail(normalizedEmail)) {
            throw ApiException.emailAlreadyExists();
        }
    }

    @Transactional(readOnly = true)
    Authentication authenticate(String username, String password) {
        var authentication = reauthenticate(username, password);
        log.info("User logged in: {}", username);
        return authentication;
    }

    // Same AuthenticationManager round-trip as authenticate(), without the "User logged in" log —
    // for callers re-verifying a password on an already-open session (e.g. PasswordChangeService),
    // where no new login actually happens and that log line would be misleading.
    @Transactional(readOnly = true)
    Authentication reauthenticate(String username, String password) {
        try {
            return authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (AuthenticationException e) {
            log.warn("Authentication failed for username: {}", username);
            throw ApiException.invalidCredentials();
        }
    }

    @Transactional(readOnly = true)
    UserResponse currentUser(String username) {
        var user = repository.findByUsername(username)
                .orElseThrow(ApiException::invalidCredentials);
        return new UserResponse(user.uuid(), user.username(), user.email(), user.role(), user.emailVerified());
    }
}
