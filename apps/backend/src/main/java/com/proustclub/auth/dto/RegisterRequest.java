package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Account creation request")
public record RegisterRequest(
        @Schema(description = "Unique username (3-50 characters)", example = "marcel")
        @NotBlank @Size(min = 3, max = 50)
        String username,

        @Schema(description = "Unique email address", example = "marcel@example.com")
        @NotBlank @Email @Size(max = 255)
        String email,

        @Schema(description = "Password (15-128 characters — length over composition rules; passphrases and spaces are welcome)", example = "Les madeleines de Combray")
        @NotBlank @Size(min = 15, max = 128)
        String password
) {}
