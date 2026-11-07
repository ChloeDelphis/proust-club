package com.proustclub.search;

record SearchOverviewEntry(
        int paragraphId,
        int volumeId,
        int partId,
        int pageNumber,
        String previewWindow,
        int matchOffsetCodePoints
) {}
