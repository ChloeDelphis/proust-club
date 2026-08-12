package com.proustclub.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    void changePassword(String username, String currentPassword, String newPassword, String currentSessionId) {
        // Re-verified through the same AuthenticationManager round-trip as login — never a change
        // on the strength of the session alone (protects a shared/unattended device left logged in).
        authService.reauthenticate(username, currentPassword);

        userRepository.updatePasswordHash(username, passwordEncoder.encode(newPassword));
        log.info("Password changed: {}", username);

        // The session backing this very request stays open; every other active session for the
        // account is swept, same policy as the "forgot password" reset flow.
        sessionInvalidator.invalidateOtherSessions(username, currentSessionId);
    }
}
