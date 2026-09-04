package com.proustclub.quote;

import com.proustclub.auth.CurrentUser;
import com.proustclub.quote.dto.CreateTagRequest;
import com.proustclub.quote.dto.RenameTagRequest;
import com.proustclub.quote.dto.TagResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    @ApiResponse(responseCode = "200", description = "Tags")
    @GetMapping(value = "/api/tags", produces = MediaType.APPLICATION_JSON_VALUE)
    List<TagResponse> list(Authentication authentication) {
        return service.list(currentUser.resolveUuid(authentication));
    }

    @Operation(summary = "Rename a tag", description = "Renames a tag. 409 if another tag with the same name (case-insensitive) already exists for this user; renaming to the same tag's own name with different casing succeeds.")
    @ApiResponse(responseCode = "200", description = "Tag renamed", content = @Content(schema = @Schema(implementation = TagResponse.class)))
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "Tag not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Another tag with this name already exists for this user", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @PatchMapping(value = "/api/tags/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    TagResponse rename(@PathVariable UUID id, @Valid @RequestBody RenameTagRequest request, Authentication authentication) {
        return service.rename(currentUser.resolveUuid(authentication), id, request.name());
    }

    @Operation(summary = "Delete a tag", description = "Deletes a tag and detaches it from every quote that had it (cascade). Quotes themselves are not affected — only this tag disappears from their tag list.")
    @ApiResponse(responseCode = "204", description = "Tag deleted")
    @ApiResponse(responseCode = "404", description = "Tag not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @DeleteMapping("/api/tags/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID id, Authentication authentication) {
        service.delete(currentUser.resolveUuid(authentication), id);
    }
}
