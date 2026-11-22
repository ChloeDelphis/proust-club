package com.proustclub.quote.model;

import java.time.Instant;
import java.util.UUID;

public record TimelineEntry(
        UUID id,
        int paragraphId,
        int pageNumber,
        int volumeId,
        String selectedText,
        String comment,
        Instant createdAt
) {}
