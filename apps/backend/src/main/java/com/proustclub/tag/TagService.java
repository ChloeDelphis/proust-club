package com.proustclub.tag;


import com.proustclub.tag.model.RenameOutcome;
import com.proustclub.tag.model.TagData;
import com.proustclub.tag.dto.TagResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TagService {

    private final TagRepository repository;

    public TagService(TagRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TagResponse create(UUID userId, String name, Integer colorIndex) {
        String trimmed = name.trim();
        return repository.insertIfAbsent(userId, trimmed, colorIndex)
                .map(TagService::toResponse)
                .orElseThrow(TagApiException::tagAlreadyExists);
    }

    @Transactional(readOnly = true)
    public List<TagResponse> list(UUID userId) {
        return repository.findByUserId(userId).stream()
                .map(TagService::toResponse)
                .toList();
    }

    @Transactional
    public TagResponse rename(UUID userId, UUID tagId, String name) {
        String trimmed = name.trim();
        var result = repository.renameForOwner(userId, tagId, trimmed);
        if (result.outcome() == RenameOutcome.NOT_FOUND) {
            throw TagApiException.tagNotFound();
        }
        if (result.outcome() == RenameOutcome.NAME_TAKEN) {
            throw TagApiException.tagAlreadyExists();
        }
        return new TagResponse(tagId, trimmed, result.colorIndex());
    }

    @Transactional
    public void delete(UUID userId, UUID tagId) {
        if (!repository.deleteForOwner(userId, tagId)) {
            throw TagApiException.tagNotFound();
        }
    }

    private static TagResponse toResponse(TagData tag) {
        return new TagResponse(tag.id(), tag.name(), tag.colorIndex());
    }
}
