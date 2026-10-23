package com.proustclub.volume.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Public structural information for one volume of the corpus")
public record VolumeResponse(
        @Schema(description = "Volume identifier", example = "2")
        int id,

        @Schema(description = "Volume title", example = "À l'ombre des jeunes filles en fleurs")
        String title,

        @Schema(description = "Order of this volume in the work (1-based)", example = "2")
        int position,

        @Schema(description = "First page of this volume", example = "104")
        int minPage,

        @Schema(description = "Last page of this volume", example = "183")
        int maxPage
) {}
