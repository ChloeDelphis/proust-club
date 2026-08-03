package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A personal tag")
public record TagResponse(
        @Schema(description = "Tag identifier", example = "12")
        int id,

        @Schema(description = "Tag name, as entered by the user (trimmed, original casing preserved)", example = "Combray")
        String name
) {}
