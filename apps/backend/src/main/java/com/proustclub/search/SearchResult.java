package com.proustclub.search;

record SearchResult(
        int paragraphId,
        String text,
        int startOffset,
        int endOffset,
        String volume,
        String part,
        int pageNumber
) {}
