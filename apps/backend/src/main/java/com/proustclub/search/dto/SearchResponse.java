package com.proustclub.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Paginated response to a search query")
public record SearchResponse(
        @Schema(description = "List of matching paragraphs")
        List<SearchHit> results,

        @Schema(description = "Total number of matches across all pages", example = "7")
        long total,

        @Schema(description = "Current page number (0-based)", example = "0")
        int page,

        @Schema(description = "Requested page size", example = "10")
        int size
) {}
