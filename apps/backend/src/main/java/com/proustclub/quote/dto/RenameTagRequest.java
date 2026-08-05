package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to rename an existing tag")
public record RenameTagRequest(
        @Schema(description = "New tag name, unique per user (case-insensitive after trimming)", example = "Jalousie")
        @NotBlank @Size(max = 50)
        String name
) {}
