package com.proustclub.quote;

import com.proustclub.common.ParagraphExceptions;
import com.proustclub.quote.dto.CreateQuoteSelectionRequest;
import com.proustclub.quote.dto.QuoteSelectionListResponse;
import com.proustclub.quote.dto.QuoteSelectionResponse;
import com.proustclub.quote.dto.TagResponse;
import com.proustclub.quote.dto.TimelineQuote;
import com.proustclub.quote.dto.TimelineResponse;
import com.proustclub.volume.VolumeService;
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
    private final QuoteTimelineRepository timelineRepository;
    private final VolumeService volumeService;
    private final QuoteTagRepository quoteTagRepository;
    private final TagRepository tagRepository;

    QuoteService(
            QuoteRepository quoteRepository,
            QuoteTimelineRepository timelineRepository,
            VolumeService volumeService,
            QuoteTagRepository quoteTagRepository,
            TagRepository tagRepository
    ) {
        this.quoteRepository = quoteRepository;
        this.timelineRepository = timelineRepository;
        this.volumeService = volumeService;
        this.quoteTagRepository = quoteTagRepository;
        this.tagRepository = tagRepository;
    }

    @Transactional
    QuoteSelectionResponse create(UUID userId, CreateQuoteSelectionRequest request) {
        int requestedTagCount = (request.tagNames() == null ? 0 : request.tagNames().size())
                + (request.newTagName() == null ? 0 : 1);
        if (requestedTagCount > CreateQuoteSelectionRequest.MAX_TAGS_PER_QUOTE) {
            throw ApiException.tooManyTagsInRequest();
        }

        var paragraphText = quoteRepository.findParagraphText(request.paragraphId())
                .orElseThrow(ParagraphExceptions::notFound);

        validateSelection(paragraphText, request.startOffset(), request.endOffset(), request.selectedText());

        var quote = quoteRepository.insert(
                userId, request.paragraphId(), request.startOffset(), request.endOffset(), request.selectedText());

        attachTags(userId, quote, request);

        log.info("Quote saved: user={} paragraphId={}", userId, request.paragraphId());

        return toResponse(quote, tagsFor(quote.id()));
    }

    private void attachTags(UUID userId, QuoteSelection quote, CreateQuoteSelectionRequest request) {
        var tagNames = request.tagNames() == null ? List.<String>of() : request.tagNames();
        for (String tagName : tagNames) {
            UUID tagId = tagRepository.upsertByName(userId, tagName);
            quoteTagRepository.addForOwner(userId, quote.id(), tagId);
        }

        if (request.newTagName() == null) return;
        String trimmedName = request.newTagName().trim();
        if (trimmedName.isEmpty()) throw ApiException.tagNameBlank();
        UUID tagId = tagRepository.insertIfAbsent(userId, trimmedName, null)
                .map(TagData::id)
                .orElseThrow(ApiException::tagAlreadyExists);
        quoteTagRepository.addForOwner(userId, quote.id(), tagId);
    }

    @Transactional(readOnly = true)
    QuoteSelectionListResponse list(UUID userId, UUID tagId, String q, Integer volumeId, int page, int size) {
        String normalizedQ = blankToNull(q);
        var quotes = quoteRepository.findByUserId(userId, tagId, normalizedQ, volumeId, page, size);
        long total = quoteRepository.countByUserId(userId, tagId, normalizedQ, volumeId);

        var quoteIds = quotes.stream().map(QuoteSelection::id).toList();
        var tagsByQuoteId = quoteTagRepository.findByQuoteIds(quoteIds);

        var results = quotes.stream()
                .map(quote -> toResponse(
                        quote, toTagResponses(tagsByQuoteId.getOrDefault(quote.id(), List.of()))))
                .toList();

        return new QuoteSelectionListResponse(results, total, page, size);
    }

    @Transactional(readOnly = true)
    TimelineResponse getTimeline(UUID userId, UUID tagId, String q) {
        var entries = timelineRepository.findByUserId(userId, tagId, blankToNull(q));
        var quoteIds = entries.stream().map(TimelineEntry::id).toList();
        var tagsByQuoteId = quoteTagRepository.findByQuoteIds(quoteIds);

        var quotes = entries.stream()
                .map(entry -> new TimelineQuote(
                        entry.id(), entry.paragraphId(), entry.pageNumber(), entry.volumeId(),
                        entry.selectedText(), entry.comment(),
                        toTagResponses(tagsByQuoteId.getOrDefault(entry.id(), List.of())), entry.createdAt()
                ))
                .toList();

        return new TimelineResponse(volumeService.list(), quotes);
    }

    @Transactional
    QuoteSelectionResponse updateComment(UUID userId, UUID quoteId, String rawComment) {
        String comment = blankToNull(rawComment);
        var quote = quoteRepository.updateCommentForOwner(userId, quoteId, comment)
                .orElseThrow(ApiException::quoteNotFound);

        return toResponse(quote, tagsFor(quoteId));
    }

    @Transactional
    void delete(UUID userId, UUID quoteId) {
        if (!quoteRepository.deleteByIdAndUserId(quoteId, userId)) {
            throw ApiException.quoteNotFound();
        }
    }

    @Transactional
    QuoteSelectionResponse addTag(UUID userId, UUID quoteId, String tagName) {
        var quote = quoteRepository.findByIdAndUserId(quoteId, userId).orElseThrow(ApiException::quoteNotFound);

        if (quoteTagRepository.countForQuote(quoteId) >= CreateQuoteSelectionRequest.MAX_TAGS_PER_QUOTE) {
            var existingTagId = tagRepository.findIdByUserIdAndNormalizedName(userId, tagName.trim());
            if (existingTagId.isPresent() && quoteTagRepository.hasForOwner(userId, quoteId, existingTagId.get())) {
                return toResponse(quote, tagsFor(quoteId));
            }
            throw ApiException.quoteTagLimitReached();
        }

        UUID tagId = tagRepository.upsertByName(userId, tagName);
        quoteTagRepository.addForOwner(userId, quoteId, tagId);

        return toResponse(quote, tagsFor(quoteId));
    }

    @Transactional
    void removeTag(UUID userId, UUID quoteId, UUID tagId) {
        if (quoteTagRepository.removeForOwner(userId, quoteId, tagId) == 0) {
            throw ApiException.tagNotFound();
        }
    }

    private List<TagResponse> tagsFor(UUID quoteId) {
        return toTagResponses(quoteTagRepository.findByQuoteIds(List.of(quoteId)).getOrDefault(quoteId, List.of()));
    }

    private static List<TagResponse> toTagResponses(List<QuoteTag> tags) {
        return tags.stream()
                .map(tag -> new TagResponse(tag.id(), tag.name(), tag.colorIndex()))
                .toList();
    }

    // Blank (empty/whitespace-only) means "absent" — NULL, not an empty string. Used both to clear
    // a comment and to normalize the `q` search filter to "no filter".
    private static String blankToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
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
