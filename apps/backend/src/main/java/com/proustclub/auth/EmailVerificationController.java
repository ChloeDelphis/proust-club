package com.proustclub.auth;

import com.proustclub.auth.dto.EmailVerificationConfirmRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "Account creation and session-based authentication.")
@RestController
class EmailVerificationController {

    private final EmailVerificationService service;

    EmailVerificationController(EmailVerificationService service) {
        this.service = service;
    }

    @Operation(
            summary = "Confirm an email address",
            description = "Marks the account's email as verified from a valid confirmation token. Does not "
                    + "require an active session — the link may be opened on a different device/browser than "
                    + "the one used to register."
    )
    @ApiResponse(responseCode = "204", description = "Email confirmed")
    @ApiResponse(responseCode = "400", description = "Invalid request body, or invalid/expired token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping("/api/auth/email/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void confirm(@Valid @RequestBody EmailVerificationConfirmRequest request) {
        service.confirmVerification(request.token());
    }
}
