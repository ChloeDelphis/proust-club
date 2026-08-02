package com.proustclub.search;

import com.proustclub.search.dto.SearchResponse;
import org.springframework.stereotype.Service;

@Service
class SearchService {

    private final SearchRepository repository;

    SearchService(SearchRepository repository) {
        this.repository = repository;
    }

    SearchResponse search(String query, int page, int size) {
        var results = repository.search(query, page, size);
        long total = repository.count(query);
        return new SearchResponse(results, total, page, size);
    }
}
