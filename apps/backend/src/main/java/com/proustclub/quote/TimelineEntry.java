package com.proustclub.quote;

import java.time.Instant;

record TimelineEntry(
        int id,
        int paragraphId,
        int pageNumber,
        int volumeId,
        String selectedText,
        Instant createdAt
) {}
