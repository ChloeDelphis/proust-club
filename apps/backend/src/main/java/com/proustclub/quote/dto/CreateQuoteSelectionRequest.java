package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(description = "Request to save a quote selection, with optional tags")
public record CreateQuoteSelectionRequest(
        @Schema(description = "Paragraph the selection belongs to", example = "42")
        @Min(0)
        int paragraphId,

        @Schema(description = "Start offset within the paragraph text (inclusive, 0-based)", example = "0")
        @Min(0)
        int startOffset,

        @Schema(description = "End offset within the paragraph text (exclusive, 0-based)", example = "120")
        @Min(0)
        int endOffset,

        @Schema(description = "Selected text — must match the paragraph exactly at the given offsets; can be the whole paragraph")
        @NotBlank
        String selectedText,

        @Schema(description = "Tag names to attach, created if they don't exist yet for this user. Optional — a quote can be saved without any tag.")
        List<@NotBlank @Size(max = 50) String> tagNames
) {}
