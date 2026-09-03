package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(description = "A saved quote selection")
public record QuoteSelectionResponse(
        @Schema(description = "Quote selection identifier", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
        UUID id,

        @Schema(description = "Paragraph the selection belongs to", example = "42")
        int paragraphId,

        @Schema(description = "Start offset within the paragraph text (inclusive, 0-based)", example = "0")
        int startOffset,

        @Schema(description = "End offset within the paragraph text (exclusive, 0-based)", example = "120")
        int endOffset,

        @Schema(description = "Selected text")
        String selectedText,

        @Schema(description = "Personal comment on this quote, or null if none", example = "Passage qui résonne encore aujourd'hui")
        String comment,

        @Schema(description = "Tags attached to this quote (possibly empty — tagging is optional)")
        List<TagResponse> tags,

        @Schema(description = "When this quote was saved")
        Instant createdAt
) {}
