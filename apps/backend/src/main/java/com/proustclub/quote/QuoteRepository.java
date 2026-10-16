package com.proustclub.quote;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class QuoteRepository {

    private final DSLContext dsl;

    QuoteRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    Optional<String> findParagraphText(int paragraphId) {
        var textField = DSL.field("text", String.class);
        return dsl.select(textField)
                .from(DSL.table("paragraphs"))
                .where(DSL.field("id", Integer.class).eq(paragraphId))
                .fetchOptional(textField);
    }

    // Returns the inserted domain object without selecting the row again: every field is already
    // known except the generated id and created_at returned by the database.
    QuoteSelection insert(UUID userId, int paragraphId, int startOffset, int endOffset, String selectedText) {
        var idField = DSL.field("id", UUID.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        return dsl.insertInto(DSL.table("quote_selections"))
                .set(DSL.field("user_id", UUID.class), userId)
                .set(DSL.field("paragraph_id", Integer.class), paragraphId)
                .set(DSL.field("start_offset", Integer.class), startOffset)
                .set(DSL.field("end_offset", Integer.class), endOffset)
                .set(DSL.field("selected_text", String.class), selectedText)
                .returning(idField, createdAtField)
                .fetchOne(r -> new QuoteSelection(
                        r.get(idField), paragraphId, startOffset, endOffset, selectedText, null, r.get(createdAtField)
                ));
    }

    Optional<QuoteSelection> findByIdAndUserId(UUID quoteId, UUID userId) {
        var idField = DSL.field("id", UUID.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var commentField = DSL.field("comment", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        // addTag() holds this lock through its count-and-insert transaction so concurrent tag
        // additions to the same quote cannot both claim the final slot.
        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, commentField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(idField.eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .forUpdate()
                .fetchOptional(r -> new QuoteSelection(
                        r.get(idField), r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

    List<QuoteSelection> findByUserId(UUID userId, UUID tagId, String q, Integer volumeId, int page, int size) {
        var idField = DSL.field("id", UUID.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var commentField = DSL.field("comment", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        // id DESC is a tiebreak for equal created_at values, which PostgreSQL can give to inserts
        // in the same transaction. It gives a stable total order; ties have no business ordering.
        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, commentField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(QuoteQueryConditions.forUser("", userId, tagId, q, volumeId))
                .orderBy(createdAtField.desc(), idField.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(r -> new QuoteSelection(
                        r.get(idField), r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

    // Mirrors insert()'s use of RETURNING: avoids a second SELECT after the UPDATE. Empty if
    // quoteId doesn't exist or isn't owned by userId — same semantics as findByIdAndUserId.
    Optional<QuoteSelection> updateCommentForOwner(UUID userId, UUID quoteId, String comment) {
        var idField = DSL.field("id", UUID.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var commentField = DSL.field("comment", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        return dsl.update(DSL.table("quote_selections"))
                .set(commentField, comment)
                .where(idField.eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .returning(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, commentField, createdAtField)
                .fetchOptional(r -> new QuoteSelection(
                        r.get(idField), r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

    long countByUserId(UUID userId, UUID tagId, String q, Integer volumeId) {
        return dsl.selectCount()
                .from(DSL.table("quote_selections"))
                .where(QuoteQueryConditions.forUser("", userId, tagId, q, volumeId))
                .fetchOne(0, Long.class);
    }

    boolean deleteByIdAndUserId(UUID quoteId, UUID userId) {
        int affected = dsl.deleteFrom(DSL.table("quote_selections"))
                .where(DSL.field("id", UUID.class).eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .execute();
        return affected > 0;
    }
}
