package com.proustclub.search;

import com.proustclub.ratelimit.RateLimiter;
import com.proustclub.search.dto.SearchResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Search", description = "Search endpoints for À la recherche du temps perdu.")
@RestController
class SearchController {

    private final SearchService service;
    private final RateLimiter rateLimiter;

    SearchController(SearchService service, RateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    @Operation(
        summary = "Search the corpus",
        description = """
            Returns paragraphs containing the requested phrase (case-insensitive exact match).

            Each result includes the `startOffset` (inclusive) and `endOffset` (exclusive)
            using 0-based indexes, ready to use with `String.substring()` in Java or JavaScript.

            Results are paginated: `size` controls how many are returned at once, `page` selects \
            which batch. Both parameters are optional and default to the first 10 results."""
    )
    @ApiResponse(
        responseCode = "200",
        description = "Search results (empty list if no match found)",
        content = @Content(schema = @Schema(implementation = SearchResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "Invalid request parameters", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(value = "/api/search", produces = MediaType.APPLICATION_JSON_VALUE)
    SearchResponse search(
        @Parameter(description = "Phrase to search for (2–500 characters)", example = "petite madeleine")
        @RequestParam @NotBlank @Size(min = 2, max = 500) String q,

        @Parameter(description = "Zero-based page index (default: 0). This paginates the search results, not the book's page numbers.", example = "0")
        @RequestParam(defaultValue = "0") @Min(0) int page,

        @Parameter(description = "Number of results per batch (1–20, default 10).", example = "10")
        @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size,

        HttpServletRequest httpRequest
    ) {
        rateLimiter.checkSearchByIp(httpRequest);
        return service.search(q, page, size);
    }
}
