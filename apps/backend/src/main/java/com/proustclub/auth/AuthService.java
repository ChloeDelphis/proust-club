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
        var normalizedEmail = EmailNormalizer.normalize(request.email());

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
        var authentication = reauthenticate(username, password);
        log.info("User logged in: {}", username);
        return authentication;
    }

    // Same AuthenticationManager round-trip as authenticate(), without the "User logged in" log —
    // for callers re-verifying a password on an already-open session (e.g. PasswordChangeService),
    // where no new login actually happens and that log line would be misleading.
    @Transactional(readOnly = true)
    Authentication reauthenticate(String username, String password) {
        try {
            return authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
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
