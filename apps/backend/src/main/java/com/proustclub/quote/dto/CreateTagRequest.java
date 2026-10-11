package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to create a tag ahead of tagging any quote")
public record CreateTagRequest(
        @Schema(description = "Tag name, unique per user (case-insensitive after trimming)", example = "Combray")
        @NotBlank @Size(max = 50)
        String name,

        @Schema(description = "Position of the chosen display color in the predefined palette (0-9). Defaults to palette slot 0 when omitted.", example = "3")
        @Min(0) @Max(9)
        Integer colorIndex
) {}
