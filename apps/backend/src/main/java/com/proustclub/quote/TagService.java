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
    TagResponse create(UUID userId, String name) {
        String trimmed = name.trim();
        UUID id = repository.insertIfAbsent(userId, trimmed)
                .orElseThrow(ApiException::tagAlreadyExists);
        return new TagResponse(id, trimmed);
    }

    @Transactional(readOnly = true)
    List<TagResponse> list(UUID userId) {
        return repository.findByUserId(userId);
    }

    @Transactional
    TagResponse rename(UUID userId, UUID tagId, String name) {
        String trimmed = name.trim();
        RenameOutcome outcome = repository.renameForOwner(userId, tagId, trimmed);
        if (outcome == RenameOutcome.NOT_FOUND) {
            throw ApiException.tagNotFound();
        }
        if (outcome == RenameOutcome.NAME_TAKEN) {
            throw ApiException.tagAlreadyExists();
        }
        return new TagResponse(tagId, trimmed);
    }

    @Transactional
    void delete(UUID userId, UUID tagId) {
        if (!repository.deleteForOwner(userId, tagId)) {
            throw ApiException.tagNotFound();
        }
    }
}
