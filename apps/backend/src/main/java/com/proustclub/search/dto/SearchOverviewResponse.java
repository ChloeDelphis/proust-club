package com.proustclub.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Lightweight corpus-wide distribution for a search query")
public record SearchOverviewResponse(
        @Schema(description = "Total number of matching paragraphs", example = "622")
        long total,

        @Schema(description = "Matching paragraph positions and short hover previews, in reading order")
        List<Marker> markers,

        @Schema(description = "Number of matching paragraphs in each volume; volumes without matches are omitted")
        List<VolumeCount> volumeCounts,

        @Schema(description = "Number of matching paragraphs in each part; parts without matches are omitted")
        List<PartCount> partCounts
) {
    @Schema(description = "A lightweight marker for one matching paragraph")
    public record Marker(
            int paragraphId,
            int volumeId,
            int partId,
            int pageNumber,
            String previewText
    ) {}

    @Schema(description = "Search result count for one volume")
    public record VolumeCount(int volumeId, long count) {}

    @Schema(description = "Search result count for one part")
    public record PartCount(int partId, long count) {}
}
