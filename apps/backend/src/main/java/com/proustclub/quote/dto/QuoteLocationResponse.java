package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Position of a saved quote in the work")
public record QuoteLocationResponse(
        @Schema(description = "Volume identifier, used to position the quote on the timeline", example = "1")
        int volumeId,

        @Schema(description = "Page containing the quote's paragraph", example = "145")
        int pageNumber,

        @Schema(description = "Volume title", example = "Du côté de chez Swann")
        String volume,

        @Schema(description = "Part title", example = "Combray")
        String part
) {}
