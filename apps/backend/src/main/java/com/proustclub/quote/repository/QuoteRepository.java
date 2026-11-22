package com.proustclub.quote.repository;

import com.proustclub.quote.model.QuoteListEntry;
import com.proustclub.quote.model.QuoteQueryConditions;
import com.proustclub.quote.model.QuoteSelection;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.proustclub.jooq.Tables.PARAGRAPHS;
import static com.proustclub.jooq.Tables.PARTS;
import static com.proustclub.jooq.Tables.QUOTE_SELECTIONS;
import static com.proustclub.jooq.Tables.VOLUMES;

@Repository
public class QuoteRepository {

    private final DSLContext dsl;

    public QuoteRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<String> findParagraphText(int paragraphId) {
        return dsl.select(PARAGRAPHS.TEXT)
                .from(PARAGRAPHS)
                .where(PARAGRAPHS.ID.eq(paragraphId))
                .fetchOptional(PARAGRAPHS.TEXT);
    }

    // Returns the inserted domain object without selecting the row again: every field is already
    // known except the generated id and created_at returned by the database.
    public QuoteSelection insert(UUID userId, int paragraphId, int startOffset, int endOffset, String selectedText) {
        return dsl.insertInto(QUOTE_SELECTIONS)
                .set(QUOTE_SELECTIONS.USER_ID, userId)
                .set(QUOTE_SELECTIONS.PARAGRAPH_ID, paragraphId)
                .set(QUOTE_SELECTIONS.START_OFFSET, startOffset)
                .set(QUOTE_SELECTIONS.END_OFFSET, endOffset)
                .set(QUOTE_SELECTIONS.SELECTED_TEXT, selectedText)
                .returning(QUOTE_SELECTIONS.ID, QUOTE_SELECTIONS.CREATED_AT)
                .fetchOne(r -> new QuoteSelection(
                        r.get(QUOTE_SELECTIONS.ID), paragraphId, startOffset, endOffset, selectedText, null,
                        r.get(QUOTE_SELECTIONS.CREATED_AT).toInstant()
                ));
    }

    public Optional<QuoteSelection> findByIdAndUserId(UUID quoteId, UUID userId) {
        // addTag() holds this lock through its count-and-insert transaction so concurrent tag
        // additions to the same quote cannot both claim the final slot.
        return dsl.select(QUOTE_SELECTIONS.ID, QUOTE_SELECTIONS.PARAGRAPH_ID,
                        QUOTE_SELECTIONS.START_OFFSET, QUOTE_SELECTIONS.END_OFFSET,
                        QUOTE_SELECTIONS.SELECTED_TEXT, QUOTE_SELECTIONS.COMMENT, QUOTE_SELECTIONS.CREATED_AT)
                .from(QUOTE_SELECTIONS)
                .where(QUOTE_SELECTIONS.ID.eq(quoteId))
                .and(QUOTE_SELECTIONS.USER_ID.eq(userId))
                .forUpdate()
                .fetchOptional(r -> new QuoteSelection(
                        r.get(QUOTE_SELECTIONS.ID), r.get(QUOTE_SELECTIONS.PARAGRAPH_ID),
                        r.get(QUOTE_SELECTIONS.START_OFFSET), r.get(QUOTE_SELECTIONS.END_OFFSET),
                        r.get(QUOTE_SELECTIONS.SELECTED_TEXT), r.get(QUOTE_SELECTIONS.COMMENT),
                        r.get(QUOTE_SELECTIONS.CREATED_AT).toInstant()
                ));
    }

    public List<QuoteListEntry> findByUserId(UUID userId, UUID tagId, String q, Integer volumeId, Integer partId, int page, int size) {
        var quoteSelections = QUOTE_SELECTIONS.as("qs");
        var paragraphs = PARAGRAPHS.as("p");
        var parts = PARTS.as("pt");
        var volumes = VOLUMES.as("v");
        // id DESC is a tiebreak for equal created_at values, which PostgreSQL can give to inserts
        // in the same transaction. It gives a stable total order; ties have no business ordering.
        return dsl.select(quoteSelections.ID, quoteSelections.PARAGRAPH_ID,
                        quoteSelections.START_OFFSET, quoteSelections.END_OFFSET,
                        quoteSelections.SELECTED_TEXT, quoteSelections.COMMENT, quoteSelections.CREATED_AT,
                        paragraphs.PAGE_NUMBER, paragraphs.VOLUME_ID, volumes.TITLE, parts.TITLE)
                .from(quoteSelections)
                .join(paragraphs).on(quoteSelections.PARAGRAPH_ID.eq(paragraphs.ID))
                .join(parts).on(paragraphs.PART_ID.eq(parts.ID))
                .join(volumes).on(paragraphs.VOLUME_ID.eq(volumes.ID))
                .where(QuoteQueryConditions.forUser(quoteSelections, userId, tagId, q, volumeId, partId))
                .orderBy(quoteSelections.CREATED_AT.desc(), quoteSelections.ID.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(r -> new QuoteListEntry(
                        new QuoteSelection(
                                r.get(quoteSelections.ID), r.get(quoteSelections.PARAGRAPH_ID),
                                r.get(quoteSelections.START_OFFSET), r.get(quoteSelections.END_OFFSET),
                                r.get(quoteSelections.SELECTED_TEXT), r.get(quoteSelections.COMMENT),
                                r.get(quoteSelections.CREATED_AT).toInstant()
                        ),
                        r.get(paragraphs.VOLUME_ID), r.get(paragraphs.PAGE_NUMBER),
                        r.get(volumes.TITLE), r.get(parts.TITLE)
                ));
    }

    // Mirrors insert()'s use of RETURNING: avoids a second SELECT after the UPDATE. Empty if
    // quoteId doesn't exist or isn't owned by userId — same semantics as findByIdAndUserId.
    public Optional<QuoteSelection> updateCommentForOwner(UUID userId, UUID quoteId, String comment) {
        return dsl.update(QUOTE_SELECTIONS)
                .set(QUOTE_SELECTIONS.COMMENT, comment)
                .where(QUOTE_SELECTIONS.ID.eq(quoteId))
                .and(QUOTE_SELECTIONS.USER_ID.eq(userId))
                .returning(QUOTE_SELECTIONS.ID, QUOTE_SELECTIONS.PARAGRAPH_ID,
                        QUOTE_SELECTIONS.START_OFFSET, QUOTE_SELECTIONS.END_OFFSET,
                        QUOTE_SELECTIONS.SELECTED_TEXT, QUOTE_SELECTIONS.COMMENT, QUOTE_SELECTIONS.CREATED_AT)
                .fetchOptional(r -> new QuoteSelection(
                        r.get(QUOTE_SELECTIONS.ID), r.get(QUOTE_SELECTIONS.PARAGRAPH_ID),
                        r.get(QUOTE_SELECTIONS.START_OFFSET), r.get(QUOTE_SELECTIONS.END_OFFSET),
                        r.get(QUOTE_SELECTIONS.SELECTED_TEXT), r.get(QUOTE_SELECTIONS.COMMENT),
                        r.get(QUOTE_SELECTIONS.CREATED_AT).toInstant()
                ));
    }

    public long countByUserId(UUID userId, UUID tagId, String q, Integer volumeId, Integer partId) {
        return dsl.selectCount()
                .from(QUOTE_SELECTIONS)
                .where(QuoteQueryConditions.forUser(QUOTE_SELECTIONS, userId, tagId, q, volumeId, partId))
                .fetchOne(0, Long.class);
    }

    public boolean deleteByIdAndUserId(UUID quoteId, UUID userId) {
        int affected = dsl.deleteFrom(QUOTE_SELECTIONS)
                .where(QUOTE_SELECTIONS.ID.eq(quoteId))
                .and(QUOTE_SELECTIONS.USER_ID.eq(userId))
                .execute();
        return affected > 0;
    }
}
