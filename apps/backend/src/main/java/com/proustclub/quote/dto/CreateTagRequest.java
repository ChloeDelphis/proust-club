package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to create a tag ahead of tagging any quote")
public record CreateTagRequest(
        @Schema(description = "Tag name, unique per user (case-insensitive after trimming)", example = "Combray")
        @NotBlank @Size(max = 50)
        String name
) {}
