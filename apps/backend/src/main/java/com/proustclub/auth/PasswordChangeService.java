package com.proustclub.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
class PasswordChangeService {

    private static final Logger log = LoggerFactory.getLogger(PasswordChangeService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final SessionInvalidator sessionInvalidator;

    PasswordChangeService(
            UserRepository userRepository, PasswordEncoder passwordEncoder,
            AuthService authService, SessionInvalidator sessionInvalidator
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.sessionInvalidator = sessionInvalidator;
    }

    // Not @Transactional, deliberately called from the controller before checkNewPasswordNotCompromised()
    // — a wrong current password should never pay for the HIBP round-trip that follows. Re-verified
    // through the same AuthenticationManager round-trip as login — never a change on the strength
    // of the session alone (protects a shared/unattended device left logged in).
    void verifyCurrentPassword(String email, String currentPassword) {
        authService.reauthenticate(email, currentPassword);
    }

    // Not @Transactional — makes an external HTTP call (PasswordBreachChecker), same reasoning as
    // AuthService.checkNoCheapConflicts()/checkPasswordNotCompromised() for register(). Called from
    // the controller after verifyCurrentPassword() and before changePassword().
    void checkNewPasswordNotCompromised(String newPassword) {
        authService.checkPasswordNotCompromised(newPassword);
    }

    @Transactional
    void changePassword(UUID userId, String newPassword, String currentSessionId) {
        userRepository.updatePasswordHash(userId, passwordEncoder.encode(newPassword));
        log.info("Password changed: {}", userId);

        // The session backing this very request stays open; every other active session for the
        // account is swept, same policy as the "forgot password" reset flow.
        sessionInvalidator.invalidateOtherSessions(userId, currentSessionId);
    }
}
