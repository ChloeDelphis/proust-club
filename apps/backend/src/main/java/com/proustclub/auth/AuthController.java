package com.proustclub.auth;

import com.proustclub.auth.dto.LoginRequest;
import com.proustclub.auth.dto.RegisterRequest;
import com.proustclub.auth.dto.UserResponse;
import com.proustclub.ratelimit.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Auth", description = "Account creation and session-based authentication.")
@Validated
@RestController
class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService service;
    private final SessionPersister sessionPersister;
    private final List<LogoutHandler> logoutHandlers;
    private final RateLimiter rateLimiter;

    AuthController(
            AuthService service,
            SessionPersister sessionPersister,
            List<LogoutHandler> logoutHandlers,
            RateLimiter rateLimiter
    ) {
        this.service = service;
        this.sessionPersister = sessionPersister;
        this.logoutHandlers = logoutHandlers;
        this.rateLimiter = rateLimiter;
    }

    @Operation(summary = "Create an account", description = "Creates a new account and immediately opens a session (auto-login).")
    @ApiResponse(responseCode = "201", description = "Account created and session opened", content = @Content(schema = @Schema(implementation = UserResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Username or email already taken", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "422", description = "Password found in a known data breach", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/auth/register", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    UserResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        rateLimiter.checkRegisterByIp(httpRequest);
        service.checkNoCheapConflicts(request);
        service.checkPasswordNotCompromised(request.password());
        var created = service.register(request);
        var authentication = service.authenticate(request.email(), request.password());
        sessionPersister.persist(authentication, httpRequest, httpResponse);
        return created;
    }

    @Operation(summary = "Log in", description = "Authenticates and opens a session.")
    @ApiResponse(responseCode = "200", description = "Session opened", content = @Content(schema = @Schema(implementation = UserResponse.class)))
    @ApiResponse(responseCode = "401", description = "Invalid email or password", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/auth/login", produces = MediaType.APPLICATION_JSON_VALUE)
    UserResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        rateLimiter.checkLoginByIp(httpRequest);
        rateLimiter.checkLoginByAccount(request.email());
        var authentication = service.authenticate(request.email(), request.password());
        sessionPersister.persist(authentication, httpRequest, httpResponse);
        var userId = ((ProustClubPrincipal) authentication.getPrincipal()).getUserId();
        return service.currentUser(userId);
    }

    @Operation(summary = "Log out", description = "Invalidates the current session.")
    @ApiResponse(responseCode = "204", description = "Session invalidated")
    @PostMapping("/api/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // getDisplayUsername(), never getName() — the latter is the email under this project's
        // model (see ADR-013), and CLAUDE.md forbids logging emails unnecessarily.
        log.info("User logged out: {}", ((ProustClubPrincipal) authentication.getPrincipal()).getDisplayUsername());
        logoutHandlers.forEach(handler -> handler.logout(httpRequest, httpResponse, authentication));
    }

    @Operation(summary = "Current user", description = "Returns the authenticated user, or 401 if there is no active session.")
    @ApiResponse(responseCode = "200", description = "Authenticated user", content = @Content(schema = @Schema(implementation = UserResponse.class)))
    @ApiResponse(responseCode = "401", description = "No active session")
    @GetMapping(value = "/api/auth/me", produces = MediaType.APPLICATION_JSON_VALUE)
    UserResponse me(Authentication authentication) {
        return service.currentUser(((ProustClubPrincipal) authentication.getPrincipal()).getUserId());
    }
}
