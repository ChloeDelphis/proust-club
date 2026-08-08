package com.proustclub.quote;

import com.proustclub.quote.dto.CreateQuoteSelectionRequest;
import com.proustclub.quote.dto.QuoteSelectionListResponse;
import com.proustclub.quote.dto.QuoteSelectionResponse;
import com.proustclub.quote.dto.TagResponse;
import com.proustclub.quote.dto.TimelineQuote;
import com.proustclub.quote.dto.TimelineResponse;
import com.proustclub.quote.dto.TimelineVolume;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
class QuoteService {

    private static final Logger log = LoggerFactory.getLogger(QuoteService.class);

    private final QuoteRepository quoteRepository;
    private final TagRepository tagRepository;

    QuoteService(QuoteRepository quoteRepository, TagRepository tagRepository) {
        this.quoteRepository = quoteRepository;
        this.tagRepository = tagRepository;
    }

    @Transactional
    QuoteSelectionResponse create(UUID userId, CreateQuoteSelectionRequest request) {
        var paragraphText = quoteRepository.findParagraphText(request.paragraphId())
                .orElseThrow(ApiException::paragraphNotFound);

        validateSelection(paragraphText, request.startOffset(), request.endOffset(), request.selectedText());

        var quote = quoteRepository.insert(
                userId, request.paragraphId(), request.startOffset(), request.endOffset(), request.selectedText());

        var tagNames = request.tagNames() == null ? List.<String>of() : request.tagNames();
        for (String tagName : tagNames) {
            int tagId = tagRepository.upsertByName(userId, tagName);
            quoteRepository.addTagForOwner(userId, quote.id(), tagId);
        }

        log.info("Quote saved: user={} paragraphId={}", userId, request.paragraphId());

        return toResponse(quote, tagsFor(quote.id()));
    }

    @Transactional(readOnly = true)
    QuoteSelectionListResponse list(UUID userId, Integer tagId, int page, int size) {
        var quotes = quoteRepository.findByUserId(userId, tagId, page, size);
        long total = quoteRepository.countByUserId(userId, tagId);

        var quoteIds = quotes.stream().map(QuoteSelection::id).toList();
        var tagsByQuoteId = quoteRepository.tagsForQuoteIds(quoteIds);

        var results = quotes.stream()
                .map(quote -> toResponse(quote, tagsByQuoteId.getOrDefault(quote.id(), List.of())))
                .toList();

        return new QuoteSelectionListResponse(results, total, page, size);
    }

    @Transactional(readOnly = true)
    TimelineResponse getTimeline(UUID userId, Integer tagId) {
        var entries = quoteRepository.findTimelineByUserId(userId, tagId);
        var volumes = quoteRepository.findVolumesWithPageRange();

        var quoteIds = entries.stream().map(TimelineEntry::id).toList();
        var tagsByQuoteId = quoteRepository.tagsForQuoteIds(quoteIds);

        var quotes = entries.stream()
                .map(entry -> new TimelineQuote(
                        entry.id(), entry.paragraphId(), entry.pageNumber(), entry.volumeId(),
                        entry.selectedText(), entry.comment(), tagsByQuoteId.getOrDefault(entry.id(), List.of()), entry.createdAt()
                ))
                .toList();

        var volumeResponses = volumes.stream()
                .map(v -> new TimelineVolume(v.id(), v.title(), v.position(), v.minPage(), v.maxPage()))
                .toList();

        return new TimelineResponse(volumeResponses, quotes);
    }

    @Transactional
    QuoteSelectionResponse updateComment(UUID userId, int quoteId, String rawComment) {
        String comment = normalizeComment(rawComment);
        var quote = quoteRepository.updateCommentForOwner(userId, quoteId, comment)
                .orElseThrow(ApiException::quoteNotFound);

        return toResponse(quote, tagsFor(quoteId));
    }

    @Transactional
    void delete(UUID userId, int quoteId) {
        if (!quoteRepository.deleteByIdAndUserId(quoteId, userId)) {
            throw ApiException.quoteNotFound();
        }
    }

    @Transactional
    QuoteSelectionResponse addTag(UUID userId, int quoteId, String tagName) {
        var quote = quoteRepository.findByIdAndUserId(quoteId, userId).orElseThrow(ApiException::quoteNotFound);

        int tagId = tagRepository.upsertByName(userId, tagName);
        quoteRepository.addTagForOwner(userId, quoteId, tagId);

        return toResponse(quote, tagsFor(quoteId));
    }

    @Transactional
    void removeTag(UUID userId, int quoteId, int tagId) {
        if (quoteRepository.removeTagForOwner(userId, quoteId, tagId) == 0) {
            throw ApiException.tagNotFound();
        }
    }

    private List<TagResponse> tagsFor(int quoteId) {
        return quoteRepository.tagsForQuoteIds(List.of(quoteId)).getOrDefault(quoteId, List.of());
    }

    // Blank (empty/whitespace-only) clears the comment — NULL, not an empty string stored.
    private static String normalizeComment(String rawComment) {
        if (rawComment == null) {
            return null;
        }
        String trimmed = rawComment.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void validateSelection(String paragraphText, int startOffset, int endOffset, String selectedText) {
        if (startOffset < 0 || endOffset > paragraphText.length() || startOffset >= endOffset
                || !paragraphText.substring(startOffset, endOffset).equals(selectedText)) {
            throw ApiException.selectionMismatch();
        }
    }

    private static QuoteSelectionResponse toResponse(QuoteSelection quote, List<TagResponse> tags) {
        return new QuoteSelectionResponse(
                quote.id(), quote.paragraphId(), quote.startOffset(), quote.endOffset(),
                quote.selectedText(), quote.comment(), tags, quote.createdAt()
        );
    }
}
