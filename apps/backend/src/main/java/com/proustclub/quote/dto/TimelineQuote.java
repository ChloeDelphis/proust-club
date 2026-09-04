package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(description = "A saved quote positioned on the personal timeline")
public record TimelineQuote(
        @Schema(description = "Quote selection identifier", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
        UUID id,

        @Schema(description = "Paragraph the selection belongs to", example = "42")
        int paragraphId,

        @Schema(description = "Page this quote's paragraph appears on, used to position its bookmark", example = "145")
        int pageNumber,

        @Schema(description = "Volume this quote's paragraph belongs to", example = "2")
        int volumeId,

        @Schema(description = "Selected text")
        String selectedText,

        @Schema(description = "Personal comment on this quote, or null if none", example = "Passage qui résonne encore aujourd'hui")
        String comment,

        @Schema(description = "Tags attached to this quote (possibly empty — tagging is optional)")
        List<TagResponse> tags,

        @Schema(description = "When this quote was saved")
        Instant createdAt
) {}
