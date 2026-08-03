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
        int id = repository.insertIfAbsent(userId, trimmed)
                .orElseThrow(ApiException::tagAlreadyExists);
        return new TagResponse(id, trimmed);
    }

    @Transactional(readOnly = true)
    List<TagResponse> list(UUID userId) {
        return repository.findByUserId(userId).stream()
                .map(tag -> new TagResponse(tag.id(), tag.name()))
                .toList();
    }
}
