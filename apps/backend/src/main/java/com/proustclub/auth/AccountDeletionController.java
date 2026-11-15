package com.proustclub.auth;

import com.proustclub.auth.dto.AccountDeletionRequest;
import com.proustclub.ratelimit.RateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Auth", description = "Account creation and session-based authentication.")
@RestController
class AccountDeletionController {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionController.class);

    private final AuthService authService;
    private final AccountDeletionService accountDeletionService;
    private final RateLimiter rateLimiter;
    private final CurrentUser currentUser;
    private final SessionInvalidator sessionInvalidator;
    private final List<LogoutHandler> logoutHandlers;

    AccountDeletionController(
            AuthService authService,
            AccountDeletionService accountDeletionService,
            RateLimiter rateLimiter,
            CurrentUser currentUser,
            SessionInvalidator sessionInvalidator,
            List<LogoutHandler> logoutHandlers
    ) {
        this.authService = authService;
        this.accountDeletionService = accountDeletionService;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
        this.sessionInvalidator = sessionInvalidator;
        this.logoutHandlers = logoutHandlers;
    }

    @Operation(
            summary = "Delete the authenticated account",
            description = "Re-verifies the current password, permanently deletes the account and all personal data, "
                    + "then invalidates every active session. The fixed Proust corpus is retained."
    )
    @ApiResponse(responseCode = "204", description = "Account and personal data permanently deleted")
    @ApiResponse(responseCode = "400", description = "Current password is required", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Not authenticated or current password incorrect", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "429", description = "Too many account deletion attempts", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping("/api/auth/account/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAccount(
            @Valid @RequestBody AccountDeletionRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        var principal = currentUser.resolvePrincipal(authentication);
        rateLimiter.checkAccountDeletionByAccount(principal.getUserId());
        authService.reauthenticate(authentication.getName(), request.currentPassword());
        accountDeletionService.deleteAccount(principal.getUserId());
        sessionInvalidator.invalidateAllSessions(principal);
        logoutHandlers.forEach(handler -> handler.logout(httpRequest, httpResponse, authentication));
        // Log only after the transaction committed and every session was invalidated.
        log.info("Account deleted: {}", principal.getUserId());
    }
}
