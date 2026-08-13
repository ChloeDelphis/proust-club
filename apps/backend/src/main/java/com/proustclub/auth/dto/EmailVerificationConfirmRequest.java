package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Email confirmation")
public record EmailVerificationConfirmRequest(
        @Schema(description = "Confirmation token received by email")
        @NotBlank @Size(max = 200)
        String token
) {}
