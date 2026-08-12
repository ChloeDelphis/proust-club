package com.proustclub.auth;

import com.proustclub.auth.dto.MessageResponse;
import com.proustclub.auth.dto.PasswordResetConfirmRequest;
import com.proustclub.auth.dto.PasswordResetRequestRequest;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "Account creation and session-based authentication.")
@RestController
class PasswordResetController {

    // Same response regardless of whether the email matched an account — the endpoint must
    // never let a caller distinguish "sent" from "no such account" (see ApiException-style
    // anti-enumeration reasoning already applied to login).
    private static final MessageResponse GENERIC_REQUEST_RESPONSE =
            new MessageResponse("If an account exists for this email, a reset link has been sent.");

    private final PasswordResetService service;
    private final SessionPersister sessionPersister;
    private final SessionInvalidator sessionInvalidator;
    private final RateLimiter rateLimiter;

    PasswordResetController(
            PasswordResetService service, SessionPersister sessionPersister,
            SessionInvalidator sessionInvalidator, RateLimiter rateLimiter
    ) {
        this.service = service;
        this.sessionPersister = sessionPersister;
        this.sessionInvalidator = sessionInvalidator;
        this.rateLimiter = rateLimiter;
    }

    @Operation(
            summary = "Request a password reset",
            description = "Sends a reset link by email if the address matches an account. Always returns the same "
                    + "generic response, whether or not it does — this endpoint never reveals account existence."
    )
    @ApiResponse(responseCode = "202", description = "Request accepted (generic response)", content = @Content(schema = @Schema(implementation = MessageResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/auth/password-reset/request", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    MessageResponse requestReset(@Valid @RequestBody PasswordResetRequestRequest request, HttpServletRequest httpRequest) {
        rateLimiter.checkPasswordResetByIp(httpRequest);
        rateLimiter.checkPasswordResetByAccount(request.email());
        service.requestReset(request.email());
        return GENERIC_REQUEST_RESPONSE;
    }

    @Operation(
            summary = "Confirm a password reset",
            description = "Sets a new password from a valid reset token and opens a session (auto-login, same "
                    + "pattern as register). Invalidates every other active session for the account."
    )
    @ApiResponse(responseCode = "200", description = "Password changed, session opened", content = @Content(schema = @Schema(implementation = UserResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body, or invalid/expired token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/auth/password-reset/confirm", produces = MediaType.APPLICATION_JSON_VALUE)
    UserResponse confirmReset(@Valid @RequestBody PasswordResetConfirmRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        var user = service.confirmReset(request.token(), request.newPassword());

        // Built directly from the user this method just updated — no need to round-trip through
        // AuthenticationManager to re-verify a password confirmReset() itself just wrote.
        var userDetails = AuthUserDetailsService.toUserDetails(user);
        var authentication = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        sessionPersister.persist(authentication, httpRequest, httpResponse);

        // Read after persist(): ChangeSessionIdAuthenticationStrategy may have rotated the id,
        // and RegisterSessionAuthenticationStrategy has by now registered this exact id as the
        // session to keep — everything else for this user gets swept.
        var newSessionId = httpRequest.getSession(false).getId();
        sessionInvalidator.invalidateOtherSessions(user.username(), newSessionId);

        return new UserResponse(user.uuid(), user.username(), user.email(), user.role());
    }
}
