package com.proustclub.auth;

import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.stereotype.Component;

// Shared by every flow that must invalidate a user's other active sessions while keeping the
// one just established or still in use (password reset confirmation, password change) — see
// docs/architecture/ADR-010-session-invalidation.md and ADR-013 (session identity).
@Component
class SessionInvalidator {

    private final SessionRegistry sessionRegistry;

    SessionInvalidator(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    // Takes a real, already-meaningful principal — never a fabricated lookup key. Both callers
    // already have one on hand: PasswordChangeController passes the current session's own
    // principal, PasswordResetController passes the one it just built (and is about to register)
    // for the new session. SessionRegistryImpl keys its principals map by equals()/hashCode(),
    // and ProustClubPrincipal bases both on userId alone — so this single O(1) lookup returns
    // every session for this user, not just the one the passed-in principal came from.
    void invalidateOtherSessions(ProustClubPrincipal principal, String currentSessionId) {
        sessionRegistry.getAllSessions(principal, false).stream()
                .filter(session -> !session.getSessionId().equals(currentSessionId))
                .forEach(SessionInformation::expireNow);
    }
}
