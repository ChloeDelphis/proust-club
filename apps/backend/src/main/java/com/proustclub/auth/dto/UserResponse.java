package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "Public representation of an authenticated user")
public record UserResponse(
        @Schema(description = "User identifier")
        UUID uuid,

        @Schema(description = "Username", example = "marcel")
        String username,

        @Schema(description = "Email address", example = "marcel@example.com")
        String email,

        @Schema(description = "Role", example = "USER")
        String role
) {}
