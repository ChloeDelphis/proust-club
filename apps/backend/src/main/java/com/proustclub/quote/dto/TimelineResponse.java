package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "The user's saved quotes positioned on the work's structure, for the personal timeline")
public record TimelineResponse(
        @Schema(description = "All 7 volumes, always present regardless of whether they contain any saved quote")
        List<TimelineVolume> volumes,

        @Schema(description = "The user's saved quotes, ordered by their position in the work")
        List<TimelineQuote> quotes
) {}
