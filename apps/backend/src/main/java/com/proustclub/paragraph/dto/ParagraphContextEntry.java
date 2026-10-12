package com.proustclub.paragraph.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A single neighboring paragraph returned as context")
public record ParagraphContextEntry(
        @Schema(description = "Paragraph identifier", example = "43")
        int paragraphId,

        @Schema(description = "Paragraph text")
        String text,

        @Schema(description = "Page this paragraph appears on", example = "145")
        int pageNumber
) {}
