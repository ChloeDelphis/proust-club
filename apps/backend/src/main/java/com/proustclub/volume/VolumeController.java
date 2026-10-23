package com.proustclub.volume;

import com.proustclub.volume.dto.VolumeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Volumes", description = "Public structure of the Proust corpus.")
@RestController
class VolumeController {

    private final VolumeService service;

    VolumeController(VolumeService service) {
        this.service = service;
    }

    @Operation(
            summary = "List corpus volumes",
            description = "Returns only the fixed public structure of the work. Contains no user quotes, bookmarks, or tags."
    )
    @ApiResponse(
            responseCode = "200",
            description = "Volumes in corpus order",
            content = @Content(array = @ArraySchema(schema = @Schema(implementation = VolumeResponse.class)))
    )
    @GetMapping(value = "/api/volumes", produces = MediaType.APPLICATION_JSON_VALUE)
    List<VolumeResponse> list() {
        return service.list();
    }
}
