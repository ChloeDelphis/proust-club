package com.proustclub.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record AccountDeletionRequest(
        @NotBlank String currentPassword
) {}
