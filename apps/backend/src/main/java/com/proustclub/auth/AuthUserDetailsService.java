package com.proustclub.auth;

import org.springframework.security.core.userdetails.User;
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

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var user = repository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        return toUserDetails(user);
    }

    // Extracted so callers that already hold an AuthUser (e.g. PasswordResetService, right after
    // writing a new password hash) can build the same UserDetails shape without a redundant
    // lookup — used to open a session without re-running AuthenticationManager.
    static UserDetails toUserDetails(AuthUser user) {
        return User.builder()
                .username(user.username())
                .password(user.passwordHash())
                .roles(user.role())
                .build();
    }
}
