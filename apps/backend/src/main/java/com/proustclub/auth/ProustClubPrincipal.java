package com.proustclub.auth;

import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

// Replaces org.springframework.security.core.userdetails.User as the session principal (see
// ADR-013). getUsername() returns the login credential (the normalized email — UserDetails'
// contract is "the username used to authenticate", which Spring accepts being an email; it is
// not required to be the app's public username), never the app's username field — callers that
// need the stable identity or the public display name use getUserId()/getDisplayUsername()
// explicitly, never getUsername()/getName(). equals()/hashCode() are on userId alone: this is
// what makes every login for the same account collapse onto a single SessionRegistryImpl entry
// (see SessionInvalidator), not just an implementation detail.
final class ProustClubPrincipal implements UserDetails, CredentialsContainer {

    private static final long serialVersionUID = 1L;

    private final UUID userId;
    private final String username;
    private final String email;
    private String passwordHash;
    private final String role;

    ProustClubPrincipal(UUID userId, String username, String email, String passwordHash, String role) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    UUID getUserId() {
        return userId;
    }

    // The public display identity (Header, etc.) — never fed into anything security-sensitive
    // (SessionRegistry lookups, rate-limit bucket keys, DB lookups). Use getUserId() for those.
    String getDisplayUsername() {
        return username;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    // Called by ProviderManager after a successful AuthenticationManager.authenticate() call —
    // not on the PasswordResetService.confirmReset() path, which builds an already-authenticated
    // token directly and must call this explicitly (see PasswordResetController).
    @Override
    public void eraseCredentials() {
        this.passwordHash = null;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ProustClubPrincipal other && userId.equals(other.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }

    // Deliberately excludes email and passwordHash — never let a generic log.debug(principal) or
    // similar leak either, even by accident.
    @Override
    public String toString() {
        return "ProustClubPrincipal{userId=" + userId + ", username='" + username + "', role='" + role + "'}";
    }
}
