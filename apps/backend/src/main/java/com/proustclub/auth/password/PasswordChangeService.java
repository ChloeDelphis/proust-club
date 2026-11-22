package com.proustclub.auth.password;

import com.proustclub.auth.AuthService;
import com.proustclub.auth.repository.UserRepository;
import com.proustclub.common.security.ProustClubPrincipal;
import com.proustclub.auth.SessionInvalidator;
import com.proustclub.auth.PasswordPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordChangeService {

    private static final Logger log = LoggerFactory.getLogger(PasswordChangeService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final SessionInvalidator sessionInvalidator;

    public PasswordChangeService(
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
    public void verifyCurrentPassword(String email, String currentPassword) {
        authService.reauthenticate(email, currentPassword);
    }

    // Not @Transactional — makes an external HTTP call (PasswordBreachChecker), same reasoning as
    // AuthService.checkNoCheapConflicts()/checkPasswordNotCompromised() for register(). Called from
    // the controller after verifyCurrentPassword() and before changePassword().
    public void checkNewPasswordNotCompromised(String newPassword) {
        authService.checkPasswordNotCompromised(newPassword);
    }

    public void checkNewPasswordDistinctFromIdentifiers(String newPassword, ProustClubPrincipal principal) {
        PasswordPolicy.requireDistinctFromIdentifiers(
                newPassword, principal.getDisplayUsername(), principal.getUsername()
        );
    }

    @Transactional
    public void changePassword(ProustClubPrincipal principal, String newPassword, String currentSessionId) {
        // Keep the policy beside the write as well as in the controller pre-check, which runs
        // before the external breach lookup.
        PasswordPolicy.requireDistinctFromIdentifiers(
                newPassword, principal.getDisplayUsername(), principal.getUsername()
        );
        userRepository.updatePasswordHash(principal.getUserId(), passwordEncoder.encode(newPassword));
        log.info("Password changed: {}", principal.getUserId());

        // The session backing this very request stays open; every other active session for the
        // account is swept, same policy as the "forgot password" reset flow. Passes the real
        // current-session principal straight through — see SessionInvalidator for why.
        sessionInvalidator.invalidateOtherSessions(principal, currentSessionId);
    }
}
