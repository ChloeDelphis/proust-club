package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to attach a tag to a quote selection, by name")
public record AddTagRequest(
        @Schema(description = "Tag name — reused if it already exists for this user, created otherwise", example = "Combray")
        @NotBlank @Size(max = 50)
        String name
) {}
