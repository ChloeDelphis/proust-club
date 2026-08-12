package com.proustclub.auth;

import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Component;

import java.util.List;

// Shared by every flow that must invalidate a user's other active sessions while keeping the
// one just established or still in use (password reset confirmation, password change) — see
// docs/architecture/ADR-010-session-invalidation.md.
@Component
class SessionInvalidator {

    private final SessionRegistry sessionRegistry;

    SessionInvalidator(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

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
}
