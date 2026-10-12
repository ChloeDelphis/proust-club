package com.proustclub.paragraph.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Paragraphs surrounding a given paragraph, within the same volume")
public record ParagraphContextResponse(
        @Schema(description = "The paragraph this context is centered on", example = "42")
        int paragraphId,

        @Schema(description = "Paragraphs before the center, oldest first (reading order). Shorter than requested at the start of the volume.")
        List<ParagraphContextEntry> before,

        @Schema(description = "Paragraphs after the center, nearest first (reading order). Shorter than requested at the end of the volume.")
        List<ParagraphContextEntry> after,

        @Schema(description = "Whether more context exists before `before`, within the same volume")
        boolean hasMoreBefore,

        @Schema(description = "Whether more context exists after `after`, within the same volume")
        boolean hasMoreAfter
) {}
