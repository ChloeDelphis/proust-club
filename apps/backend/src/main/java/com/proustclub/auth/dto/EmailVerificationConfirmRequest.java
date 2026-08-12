package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Email confirmation")
public record EmailVerificationConfirmRequest(
        @Schema(description = "Confirmation token received by email")
        @NotBlank
        String token
) {}
