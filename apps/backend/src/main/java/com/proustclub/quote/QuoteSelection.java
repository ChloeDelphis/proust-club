package com.proustclub.quote;

import java.time.Instant;
import java.util.UUID;

record QuoteSelection(
        UUID id,
        int paragraphId,
        int startOffset,
        int endOffset,
        String selectedText,
        String comment,
        Instant createdAt
) {}
