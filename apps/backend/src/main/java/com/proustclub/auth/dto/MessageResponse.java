package com.proustclub.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Generic confirmation message")
public record MessageResponse(
        @Schema(description = "Human-readable message", example = "If an account exists for this email, a reset link has been sent.")
        String message
) {}
