package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Login request")
public record LoginRequest(
        @Schema(description = "Account email address", example = "marcel@example.com")
        @NotBlank @Email @Size(max = 255)
        String email,

        @Schema(description = "Password", example = "hunter2222")
        @NotBlank
        String password
) {}
