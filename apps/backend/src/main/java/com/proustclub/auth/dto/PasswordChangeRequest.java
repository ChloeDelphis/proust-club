package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Password change for the currently authenticated user")
public record PasswordChangeRequest(
        @Schema(description = "Current password, re-verified before any change")
        @NotBlank
        String currentPassword,

        @Schema(description = "New password (15-128 characters — length over composition rules; passphrases and spaces are welcome)", example = "Le temps retrouve enfin")
        @NotBlank @Size(min = 15, max = 128)
        String newPassword
) {}
