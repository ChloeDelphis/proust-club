package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Password reset request (forgot password)")
public record PasswordResetRequestRequest(
        @Schema(description = "Account email address", example = "marcel@example.com")
        @NotBlank @Email
        String email
) {}
