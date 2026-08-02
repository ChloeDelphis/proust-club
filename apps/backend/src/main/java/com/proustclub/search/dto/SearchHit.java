package com.proustclub.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A paragraph matching the search query")
public record SearchHit(
        @Schema(description = "Paragraph identifier")
        int paragraphId,

        @Schema(description = "Full text of the paragraph")
        String text,

        @Schema(description = "Start index of the match in the text (0-based, inclusive)", example = "3")
        int startOffset,

        @Schema(description = "End index of the match in the text (0-based, exclusive)", example = "12")
        int endOffset,

        @Schema(description = "Volume title", example = "Du Côté de Chez Swann")
        String volume,

        @Schema(description = "Part title", example = "Combray")
        String part,

        @Schema(description = "Page number in the source corpus", example = "1")
        int pageNumber
) {}
