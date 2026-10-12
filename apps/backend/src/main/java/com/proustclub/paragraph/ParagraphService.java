package com.proustclub.paragraph;

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
        var anchor = repository.findAnchor(paragraphId).orElseThrow(ApiException::paragraphNotFound);

        var beforeFetched = repository.findBefore(anchor.volumeId(), anchor.position(), before);
        boolean hasMoreBefore = beforeFetched.size() > before;
        var beforeRows = hasMoreBefore ? beforeFetched.subList(0, before) : beforeFetched;
        var beforeEntries = new ArrayList<>(beforeRows.stream().map(ParagraphService::toEntry).toList());
        Collections.reverse(beforeEntries);

        var afterFetched = repository.findAfter(anchor.volumeId(), anchor.position(), after);
        boolean hasMoreAfter = afterFetched.size() > after;
        var afterRows = hasMoreAfter ? afterFetched.subList(0, after) : afterFetched;
        List<ParagraphContextEntry> afterEntries = afterRows.stream().map(ParagraphService::toEntry).toList();

        return new ParagraphContextResponse(paragraphId, beforeEntries, afterEntries, hasMoreBefore, hasMoreAfter);
    }

    private static ParagraphContextEntry toEntry(ParagraphRepository.Row row) {
        return new ParagraphContextEntry(row.id(), row.text(), row.pageNumber());
    }
}
