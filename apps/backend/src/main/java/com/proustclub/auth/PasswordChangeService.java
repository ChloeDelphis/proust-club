package com.proustclub.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class PasswordChangeService {

    private static final Logger log = LoggerFactory.getLogger(PasswordChangeService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SessionInvalidator sessionInvalidator;

    PasswordChangeService(
            UserRepository userRepository, PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager, SessionInvalidator sessionInvalidator
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.sessionInvalidator = sessionInvalidator;
    }

    @Transactional
    void changePassword(String username, String currentPassword, String newPassword, String currentSessionId) {
        // Re-verified through AuthenticationManager, same mechanism as login — never a change on
        // the strength of the session alone (protects a shared/unattended device left logged in).
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, currentPassword));
        } catch (AuthenticationException e) {
            log.warn("Password change rejected, current password incorrect for username: {}", username);
            throw ApiException.invalidCredentials();
        }

        var user = userRepository.findByUsername(username)
                .orElseThrow(ApiException::invalidCredentials);

        userRepository.updatePasswordHash(user.uuid(), passwordEncoder.encode(newPassword));
        log.info("Password changed: {}", username);

        // The session backing this very request stays open; every other active session for the
        // account is swept, same policy as the "forgot password" reset flow.
        sessionInvalidator.invalidateOtherSessions(username, currentSessionId);
    }
}
