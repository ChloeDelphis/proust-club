package com.proustclub.paragraph;

import com.proustclub.common.ParagraphExceptions;
import com.proustclub.paragraph.dto.ParagraphContextEntry;
import com.proustclub.paragraph.dto.ParagraphContextResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
class ParagraphService {

    private final ParagraphRepository repository;

    ParagraphService(ParagraphRepository repository) {
        this.repository = repository;
    }

    ParagraphContextResponse getContext(int paragraphId, int before, int after) {
        var anchor = repository.findAnchor(paragraphId).orElseThrow(ParagraphExceptions::notFound);

        var beforeTrimmed = trim(repository.findBefore(anchor.volumeId(), anchor.position(), before), before);
        var beforeEntries = new ArrayList<>(beforeTrimmed.entries());
        Collections.reverse(beforeEntries);

        var afterTrimmed = trim(repository.findAfter(anchor.volumeId(), anchor.position(), after), after);

        return new ParagraphContextResponse(paragraphId, beforeEntries, afterTrimmed.entries(), beforeTrimmed.hasMore(), afterTrimmed.hasMore());
    }

    // `fetched` carries one row more than `limit` when more context exists beyond it (see
    // ParagraphRepository.findNeighbors) — trimming that extra row here is what turns it into the
    // hasMore flag, shared between the before/after sides rather than duplicated per side.
    private record Trimmed(List<ParagraphContextEntry> entries, boolean hasMore) {}

    private static Trimmed trim(List<ParagraphRepository.Row> fetched, int limit) {
        boolean hasMore = fetched.size() > limit;
        var rows = hasMore ? fetched.subList(0, limit) : fetched;
        return new Trimmed(rows.stream().map(ParagraphService::toEntry).toList(), hasMore);
    }

    private static ParagraphContextEntry toEntry(ParagraphRepository.Row row) {
        return new ParagraphContextEntry(row.id(), row.text(), row.pageNumber());
    }
}
