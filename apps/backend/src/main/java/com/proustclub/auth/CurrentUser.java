package com.proustclub.auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {

    // The session principal carries the stable identity directly (see ProustClubPrincipal, ADR-013)
    // — no DB round-trip needed. Other feature packages that need the owning user's UUID resolve
    // it through here.
    public UUID resolveUuid(Authentication authentication) {
        return resolvePrincipal(authentication).getUserId();
    }

    // Package-private: callers within auth/ that need more than just the UUID (the display
    // username, or the whole principal to pass to SessionInvalidator) go through here too, rather
    // than each casting authentication.getPrincipal() independently.
    ProustClubPrincipal resolvePrincipal(Authentication authentication) {
        return (ProustClubPrincipal) authentication.getPrincipal();
    }
}
