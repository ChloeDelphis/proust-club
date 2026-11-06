package com.proustclub.volume.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

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
        int maxPage,

        @Schema(description = "Named parts in reading order")
        List<PartResponse> parts
) {
    public VolumeResponse(int id, String title, int position, int minPage, int maxPage) {
        this(id, title, position, minPage, maxPage, List.of());
    }

    @Schema(description = "A named part within a volume")
    public record PartResponse(
            @Schema(description = "Part identifier", example = "4")
            int id,
            @Schema(description = "Part title", example = "Autour de Mme Swann")
            String title,
            @Schema(description = "Order of this part within its volume (1-based)", example = "1")
            int position,
            @Schema(description = "First page of this part", example = "104")
            int startPage
    ) {}
}
