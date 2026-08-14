package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Password reset confirmation")
public record PasswordResetConfirmRequest(
        @Schema(description = "Reset token received by email")
        @NotBlank @Size(max = 200)
        String token,

        @Schema(description = "New password (15-128 characters — length over composition rules; passphrases and spaces are welcome)", example = "Les madeleines de Combray")
        @NotBlank @Size(min = 15, max = 128)
        String newPassword
) {}
