package com.proustclub.quote;

import java.time.Instant;
import java.util.UUID;

record TimelineEntry(
        UUID id,
        int paragraphId,
        int pageNumber,
        int volumeId,
        String selectedText,
        String comment,
        Instant createdAt
) {}
