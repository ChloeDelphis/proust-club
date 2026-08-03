package com.proustclub.quote;

import com.proustclub.auth.CurrentUser;
import com.proustclub.quote.dto.CreateTagRequest;
import com.proustclub.quote.dto.TagResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Tags", description = "Personal tags, independent of any quote selection.")
@RestController
class TagController {

    private final TagService service;
    private final CurrentUser currentUser;

    TagController(TagService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Create a tag", description = "Creates a tag ahead of tagging any quote. 409 if a tag with the same name (case-insensitive) already exists for this user.")
    @ApiResponse(responseCode = "201", description = "Tag created", content = @Content(schema = @Schema(implementation = TagResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Tag name already exists for this user", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/api/tags", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    TagResponse create(@Valid @RequestBody CreateTagRequest request, Authentication authentication) {
        return service.create(currentUser.resolveUuid(authentication), request.name());
    }

    @Operation(summary = "List my tags", description = "Returns the authenticated user's tags, ordered alphabetically (case-insensitive).")
    @ApiResponse(responseCode = "200", description = "Tags", content = @Content(schema = @Schema(implementation = TagResponse.class)))
    @GetMapping(value = "/api/tags", produces = MediaType.APPLICATION_JSON_VALUE)
    List<TagResponse> list(Authentication authentication) {
        return service.list(currentUser.resolveUuid(authentication));
    }
}
