package com.proustclub.quote;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import static com.proustclub.jooq.Tables.PARAGRAPHS;
import static com.proustclub.jooq.Tables.QUOTE_SELECTIONS;

@Repository
class QuoteTimelineRepository {

    private final DSLContext dsl;

    QuoteTimelineRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    // Unpaginated by design: the timeline needs every saved quote to place every bookmark.
    List<TimelineEntry> findByUserId(UUID userId, UUID tagId, String q) {
        var quoteSelections = QUOTE_SELECTIONS.as("qs");
        var paragraphs = PARAGRAPHS.as("p");

        return dsl.select(quoteSelections.ID, quoteSelections.PARAGRAPH_ID, paragraphs.PAGE_NUMBER,
                        paragraphs.VOLUME_ID, quoteSelections.SELECTED_TEXT, quoteSelections.COMMENT,
                        quoteSelections.CREATED_AT)
                .from(quoteSelections)
                .join(paragraphs).on(quoteSelections.PARAGRAPH_ID.eq(paragraphs.ID))
                .where(QuoteQueryConditions.forUser(quoteSelections, userId, tagId, q, null))
                .orderBy(paragraphs.POSITION)
                .fetch(r -> new TimelineEntry(
                        r.get(quoteSelections.ID), r.get(quoteSelections.PARAGRAPH_ID), r.get(paragraphs.PAGE_NUMBER),
                        r.get(paragraphs.VOLUME_ID), r.get(quoteSelections.SELECTED_TEXT),
                        r.get(quoteSelections.COMMENT), r.get(quoteSelections.CREATED_AT).toInstant()
                ));
    }
}
