package com.proustclub.quote;

import com.proustclub.auth.CurrentUser;
import com.proustclub.quote.dto.AddTagRequest;
import com.proustclub.quote.dto.CreateQuoteSelectionRequest;
import com.proustclub.quote.dto.QuoteSelectionListResponse;
import com.proustclub.quote.dto.QuoteSelectionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Quotes", description = "Personal quote selections and their tags.")
@RestController
class QuoteController {

    private final QuoteService service;
    private final CurrentUser currentUser;

    QuoteController(QuoteService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @Operation(
        summary = "Save a quote selection",
        description = """
            Saves a selection of text found in a paragraph (whole paragraph or a substring),
            with optional tags. The server re-validates that `selectedText` matches the \
            paragraph's actual text at the given offsets, rejecting the request otherwise."""
    )
    @ApiResponse(responseCode = "201", description = "Quote saved", content = @Content(schema = @Schema(implementation = QuoteSelectionResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body, or selectedText/offsets don't match the paragraph", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "Paragraph not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/quotes", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    QuoteSelectionResponse create(@Valid @RequestBody CreateQuoteSelectionRequest request, Authentication authentication) {
        return service.create(currentUser.resolveUuid(authentication), request);
    }

    @Operation(summary = "List my quote selections", description = "Returns the authenticated user's quotes, most recent first. Filterable by tagId.")
    @ApiResponse(responseCode = "200", description = "Quote selections (empty list if none match)", content = @Content(schema = @Schema(implementation = QuoteSelectionListResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request parameters", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(value = "/api/quotes", produces = MediaType.APPLICATION_JSON_VALUE)
    QuoteSelectionListResponse list(
        @Parameter(description = "Only return quotes tagged with this tag id. A tagId that doesn't exist or belongs to another user yields an empty list, not an error.", example = "12")
        @RequestParam(required = false) @Min(value = 1, message = "tagId must be >= 1") Integer tagId,

        @Parameter(description = "Zero-based page index (default: 0)", example = "0")
        @RequestParam(defaultValue = "0") @Min(value = 0, message = "page must be >= 0") int page,

        @Parameter(description = "Number of results per batch (1–20, default 10)", example = "10")
        @RequestParam(defaultValue = "10") @Min(value = 1, message = "size must be >= 1") @Max(value = 20, message = "size must be <= 20") int size,

        Authentication authentication
    ) {
        return service.list(currentUser.resolveUuid(authentication), tagId, page, size);
    }

    @Operation(summary = "Delete a quote selection", description = "Deletes a quote and all its tag associations. 404 if it doesn't exist or doesn't belong to the authenticated user.")
    @ApiResponse(responseCode = "204", description = "Quote deleted")
    @ApiResponse(responseCode = "404", description = "Quote not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @DeleteMapping("/api/quotes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable int id, Authentication authentication) {
        service.delete(currentUser.resolveUuid(authentication), id);
    }

    @Operation(summary = "Add a tag to a quote", description = "Attaches a tag (by name, created if it doesn't exist yet) to an existing quote. Idempotent: adding a tag already attached does nothing.")
    @ApiResponse(responseCode = "200", description = "Updated quote selection", content = @Content(schema = @Schema(implementation = QuoteSelectionResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "Quote not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/quotes/{id}/tags", produces = MediaType.APPLICATION_JSON_VALUE)
    QuoteSelectionResponse addTag(@PathVariable int id, @Valid @RequestBody AddTagRequest request, Authentication authentication) {
        return service.addTag(currentUser.resolveUuid(authentication), id, request.name());
    }

    @Operation(summary = "Remove a tag from a quote", description = "Detaches a tag from a quote. No floor on the number of tags — a quote can end up with zero.")
    @ApiResponse(responseCode = "204", description = "Tag removed")
    @ApiResponse(responseCode = "404", description = "Quote not found, or tag not attached to this quote", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @DeleteMapping("/api/quotes/{id}/tags/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeTag(@PathVariable int id, @PathVariable int tagId, Authentication authentication) {
        service.removeTag(currentUser.resolveUuid(authentication), id, tagId);
    }
}
