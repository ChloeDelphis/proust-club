package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Paginated list of the current user's quote selections")
public record QuoteSelectionListResponse(
        @Schema(description = "List of quote selections")
        List<QuoteSelectionResponse> results,

        @Schema(description = "Total number of matches across all pages", example = "3")
        long total,

        @Schema(description = "Current page number (0-based)", example = "0")
        int page,

        @Schema(description = "Requested page size", example = "10")
        int size
) {}
