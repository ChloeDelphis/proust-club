package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Login request")
public record LoginRequest(
        @Schema(description = "Username", example = "marcel")
        @NotBlank
        String username,

        @Schema(description = "Password", example = "hunter2222")
        @NotBlank
        String password
) {}
