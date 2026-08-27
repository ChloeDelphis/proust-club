package com.proustclub.auth;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
class AuthUserDetailsService implements UserDetailsService {

    private final UserRepository repository;

    AuthUserDetailsService(UserRepository repository) {
        this.repository = repository;
    }

    // The "username" parameter here is the login credential — an email under this project's
    // model (see ADR-013), despite the interface's naming. Never logged with the raw value: our
    // own exception message stays generic on purpose (see docs/architecture/ADR-013 for why —
    // Spring Security's own AbstractUserDetailsAuthenticationProvider separately logs the raw
    // value at DEBUG, a framework behavior we can't change, only avoid triggering by keeping that
    // logger below DEBUG in every environment).
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        var user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return toUserDetails(user);
    }

    // Extracted so callers that already hold an AuthUser (e.g. PasswordResetService, right after
    // writing a new password hash) can build the same UserDetails shape without a redundant
    // lookup — used to open a session without re-running AuthenticationManager. Callers on that
    // path never go through ProviderManager, so they must call eraseCredentials() themselves
    // (see PasswordResetController).
    static ProustClubPrincipal toUserDetails(AuthUser user) {
        return new ProustClubPrincipal(user.uuid(), user.username(), user.email(), user.passwordHash(), user.role());
    }
}
