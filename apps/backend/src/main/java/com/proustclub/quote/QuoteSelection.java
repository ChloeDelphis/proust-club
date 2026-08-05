package com.proustclub.quote;

import java.time.Instant;

record QuoteSelection(
        int id,
        int paragraphId,
        int startOffset,
        int endOffset,
        String selectedText,
        Instant createdAt
) {}
