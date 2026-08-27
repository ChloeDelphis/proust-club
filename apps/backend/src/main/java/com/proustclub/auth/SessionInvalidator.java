package com.proustclub.auth;

import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Shared by every flow that must invalidate a user's other active sessions while keeping the
// one just established or still in use (password reset confirmation, password change) — see
// docs/architecture/ADR-010-session-invalidation.md and ADR-013 (session identity).
@Component
class SessionInvalidator {

    private final SessionRegistry sessionRegistry;

    SessionInvalidator(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    void invalidateOtherSessions(UUID userId, String currentSessionId) {
        // SessionRegistryImpl keys its principals map by equals()/hashCode() — ProustClubPrincipal
        // bases both on userId alone, so every login for this account collapses onto the same
        // registered entry regardless of which instance registered it (see ProustClubPrincipal).
        // We can't build a lookalike throwaway principal the way the old User-based code did:
        // UserDetails.getUsername() can never return null, and this principal's getUsername() is
        // the email — a placeholder value here would be a structurally meaningless object. Instead,
        // look up the real, already-registered principal for this user and use it.
        sessionRegistry.getAllPrincipals().stream()
                .filter(ProustClubPrincipal.class::isInstance)
                .map(ProustClubPrincipal.class::cast)
                .filter(principal -> principal.getUserId().equals(userId))
                .flatMap(principal -> sessionRegistry.getAllSessions(principal, false).stream())
                .filter(session -> !session.getSessionId().equals(currentSessionId))
                .forEach(SessionInformation::expireNow);
    }
}
