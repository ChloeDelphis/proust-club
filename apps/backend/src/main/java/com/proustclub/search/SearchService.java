package com.proustclub.search;

import com.proustclub.search.dto.SearchHit;
import com.proustclub.search.dto.SearchOverviewResponse;
import com.proustclub.search.dto.SearchResponse;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

@Service
class SearchService {

    private final SearchRepository repository;

    SearchService(SearchRepository repository) {
        this.repository = repository;
    }

    SearchResponse search(String query, Integer volumeId, Integer partId, int page, int size) {
        var results = repository.search(query, volumeId, partId, page, size).stream()
                .map(result -> new SearchHit(
                        result.paragraphId(),
                        result.text(),
                        result.startOffset(),
                        result.endOffset(),
                        result.volume(),
                        result.part(),
                        result.pageNumber()
                ))
                .toList();
        long total = repository.count(query, volumeId, partId);
        return new SearchResponse(results, total, page, size);
    }

    SearchOverviewResponse overview(String query) {
        var entries = repository.searchOverview(query);
        var markers = entries.stream()
                .map(entry -> {
                    String preview = SearchPreviewText.aroundMatch(
                            entry.previewWindow(),
                            entry.matchOffsetCodePoints(),
                            query.codePointCount(0, query.length())
                    );
                    return new SearchOverviewResponse.Marker(
                            entry.paragraphId(), entry.volumeId(), entry.partId(), entry.pageNumber(), preview
                    );
                })
                .toList();
        var volumeCounts = countsBy(entries, SearchOverviewEntry::volumeId).entrySet().stream()
                .map(count -> new SearchOverviewResponse.VolumeCount(count.getKey(), count.getValue()))
                .toList();
        var partCounts = countsBy(entries, SearchOverviewEntry::partId).entrySet().stream()
                .map(count -> new SearchOverviewResponse.PartCount(count.getKey(), count.getValue()))
                .toList();

        return new SearchOverviewResponse(markers.size(), markers, volumeCounts, partCounts);
    }

    private static <T> Map<Integer, Long> countsBy(Iterable<T> items, Function<T, Integer> key) {
        var counts = new LinkedHashMap<Integer, Long>();
        for (T item : items) counts.merge(key.apply(item), 1L, Long::sum);
        return counts;
    }
}
