package com.proustclub.quote.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to set or clear a quote's personal comment")
public record UpdateQuoteCommentRequest(
        @Schema(description = "New comment, or null/blank to clear it", example = "Passage qui résonne encore aujourd'hui")
        @Size(max = 2000)
        String comment
) {}
