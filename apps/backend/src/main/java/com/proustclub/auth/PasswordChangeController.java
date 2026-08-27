package com.proustclub.auth;

import com.proustclub.auth.dto.PasswordChangeRequest;
import com.proustclub.ratelimit.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "Account creation and session-based authentication.")
@RestController
class PasswordChangeController {

    private final PasswordChangeService service;
    private final RateLimiter rateLimiter;

    PasswordChangeController(PasswordChangeService service, RateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    @Operation(
            summary = "Change password",
            description = "Changes the password of the currently authenticated user. Requires the current "
                    + "password to be re-supplied and re-verified — never a change on the session alone. "
                    + "Invalidates every other active session for the account; the current one stays open."
    )
    @ApiResponse(responseCode = "204", description = "Password changed")
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Not authenticated, or current password incorrect", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "422", description = "New password found in a known data breach", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping("/api/auth/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@Valid @RequestBody PasswordChangeRequest request, Authentication authentication, HttpServletRequest httpRequest) {
        var userId = ((ProustClubPrincipal) authentication.getPrincipal()).getUserId();
        rateLimiter.checkPasswordChangeByAccount(userId);
        var currentSessionId = httpRequest.getSession(false).getId();
        // authentication.getName() is the email — exactly what AuthService.reauthenticate() needs
        // to feed back into AuthenticationManager (see ADR-013).
        service.verifyCurrentPassword(authentication.getName(), request.currentPassword());
        service.checkNewPasswordNotCompromised(request.newPassword());
        service.changePassword(userId, request.newPassword(), currentSessionId);
    }
}
