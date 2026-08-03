package com.proustclub.auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {

    private final UserRepository repository;

    CurrentUser(UserRepository repository) {
        this.repository = repository;
    }

    // The session principal only carries the username (see AuthUserDetailsService); other
    // feature packages that need the owning user's UUID resolve it through here.
    public UUID resolveUuid(Authentication authentication) {
        return repository.findByUsername(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + authentication.getName()))
                .uuid();
    }
}
