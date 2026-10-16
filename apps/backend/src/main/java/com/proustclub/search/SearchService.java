package com.proustclub.search;

import com.proustclub.search.dto.SearchResponse;
import org.springframework.stereotype.Service;

@Service
class SearchService {

    private final SearchRepository repository;

    SearchService(SearchRepository repository) {
        this.repository = repository;
    }

    SearchResponse search(String query, Integer volumeId, int page, int size) {
        var results = repository.search(query, volumeId, page, size);
        long total = repository.count(query, volumeId);
        return new SearchResponse(results, total, page, size);
    }
}
