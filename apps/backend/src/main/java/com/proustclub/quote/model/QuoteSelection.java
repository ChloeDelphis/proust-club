package com.proustclub.quote.model;

import java.time.Instant;
import java.util.UUID;

public record QuoteSelection(
        UUID id,
        int paragraphId,
        int startOffset,
        int endOffset,
        String selectedText,
        String comment,
        Instant createdAt
) {}
