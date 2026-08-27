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
        return ((ProustClubPrincipal) authentication.getPrincipal()).getUserId();
    }
}
