package com.proustclub.auth;

import com.proustclub.auth.dto.RegisterRequest;
import com.proustclub.auth.dto.UserResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    AuthService(UserRepository repository, PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    UserResponse register(RegisterRequest request) {
        // Email is case-insensitive in practice (mail providers treat it that way); normalizing
        // before every check/insert makes the plain UNIQUE constraint on the column behave as a
        // case-insensitive one, without needing citext or a functional index.
        var normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);

        if (repository.existsByUsername(request.username())) {
            throw ApiException.usernameAlreadyExists();
        }
        if (repository.existsByEmail(normalizedEmail)) {
            throw ApiException.emailAlreadyExists();
        }

        var passwordHash = passwordEncoder.encode(request.password());
        var uuid = repository.insert(request.username(), normalizedEmail, passwordHash);
        log.info("User registered: {}", request.username());

        return new UserResponse(uuid, request.username(), normalizedEmail, "USER");
    }

    @Transactional(readOnly = true)
    Authentication authenticate(String username, String password) {
        try {
            var authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
            log.info("User logged in: {}", username);
            return authentication;
        } catch (AuthenticationException e) {
            log.warn("Authentication failed for username: {}", username);
            throw ApiException.invalidCredentials();
        }
    }

    @Transactional(readOnly = true)
    UserResponse currentUser(String username) {
        var user = repository.findByUsername(username)
                .orElseThrow(ApiException::invalidCredentials);
        return new UserResponse(user.uuid(), user.username(), user.email(), user.role());
    }
}
