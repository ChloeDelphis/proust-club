package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(description = "A saved quote selection with its location in the work")
public record QuoteSelectionListItemResponse(
        UUID id,
        int paragraphId,
        int startOffset,
        int endOffset,
        String selectedText,
        String comment,
        List<TagResponse> tags,
        Instant createdAt,
        QuoteLocationResponse location
) {}
