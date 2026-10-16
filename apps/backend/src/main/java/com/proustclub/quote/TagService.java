package com.proustclub.quote;

import com.proustclub.quote.dto.TagResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
class TagService {

    private final TagRepository repository;

    TagService(TagRepository repository) {
        this.repository = repository;
    }

    @Transactional
    TagResponse create(UUID userId, String name, Integer colorIndex) {
        String trimmed = name.trim();
        return repository.insertIfAbsent(userId, trimmed, colorIndex)
                .map(TagService::toResponse)
                .orElseThrow(ApiException::tagAlreadyExists);
    }

    @Transactional(readOnly = true)
    List<TagResponse> list(UUID userId) {
        return repository.findByUserId(userId).stream()
                .map(TagService::toResponse)
                .toList();
    }

    @Transactional
    TagResponse rename(UUID userId, UUID tagId, String name) {
        String trimmed = name.trim();
        var result = repository.renameForOwner(userId, tagId, trimmed);
        if (result.outcome() == RenameOutcome.NOT_FOUND) {
            throw ApiException.tagNotFound();
        }
        if (result.outcome() == RenameOutcome.NAME_TAKEN) {
            throw ApiException.tagAlreadyExists();
        }
        return new TagResponse(tagId, trimmed, result.colorIndex());
    }

    @Transactional
    void delete(UUID userId, UUID tagId) {
        if (!repository.deleteForOwner(userId, tagId)) {
            throw ApiException.tagNotFound();
        }
    }

    private static TagResponse toResponse(TagData tag) {
        return new TagResponse(tag.id(), tag.name(), tag.colorIndex());
    }
}
