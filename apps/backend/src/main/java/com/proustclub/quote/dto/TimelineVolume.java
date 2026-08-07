package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A volume of the work, with the page range it spans (used to draw delimiters and position bookmarks)")
public record TimelineVolume(
        @Schema(description = "Volume identifier", example = "2")
        int id,

        @Schema(description = "Volume title", example = "À l'Ombre des Jeunes Filles en Fleurs")
        String title,

        @Schema(description = "Order of this volume in the work (1-based)", example = "2")
        int position,

        @Schema(description = "First page of this volume", example = "104")
        int minPage,

        @Schema(description = "Last page of this volume", example = "183")
        int maxPage
) {}
