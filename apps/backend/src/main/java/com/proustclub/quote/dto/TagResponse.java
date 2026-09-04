package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "A personal tag")
public record TagResponse(
        @Schema(description = "Tag identifier", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
        UUID id,

        @Schema(description = "Tag name, as entered by the user (trimmed, original casing preserved)", example = "Combray")
        String name
) {}
