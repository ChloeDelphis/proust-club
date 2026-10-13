package com.proustclub.paragraph;

import com.proustclub.paragraph.dto.ParagraphContextResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Paragraphs", description = "Corpus paragraph context, for the progressive before/after reader.")
@RestController
class ParagraphController {

    private static final int MAX_CONTEXT = 20;

    private final ParagraphService service;

    ParagraphController(ParagraphService service) {
        this.service = service;
    }

    @Operation(
        summary = "Get the paragraphs surrounding a given paragraph",
        description = """
            Returns up to `before`/`after` neighboring paragraphs within the same volume as the \
            given paragraph, in reading order. Never crosses into a different volume: \
            `hasMoreBefore`/`hasMoreAfter` tell the caller whether more context exists within the \
            volume beyond what was returned, so a "load more" control can disable itself at the \
            volume's edge."""
    )
    @ApiResponse(responseCode = "200", description = "Context around the paragraph", content = @Content(schema = @Schema(implementation = ParagraphContextResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request parameters", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "Paragraph not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(value = "/api/paragraphs/{id}/context", produces = MediaType.APPLICATION_JSON_VALUE)
    ParagraphContextResponse getContext(
        @Parameter(description = "Paragraph id to center the context on", example = "42")
        @PathVariable int id,

        @Parameter(description = "How many paragraphs to return before it, within the same volume (0-20, default 0)", example = "1")
        @RequestParam(defaultValue = "0") @Min(value = 0, message = "before must be >= {value}") @Max(value = MAX_CONTEXT, message = "before must be <= {value}") int before,

        @Parameter(description = "How many paragraphs to return after it, within the same volume (0-20, default 0)", example = "1")
        @RequestParam(defaultValue = "0") @Min(value = 0, message = "after must be >= {value}") @Max(value = MAX_CONTEXT, message = "after must be <= {value}") int after
    ) {
        return service.getContext(id, before, after);
    }
}
