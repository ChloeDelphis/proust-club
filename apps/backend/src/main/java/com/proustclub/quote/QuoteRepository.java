package com.proustclub.quote;

import com.proustclub.quote.dto.TagResponse;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    int insert(UUID userId, int paragraphId, int startOffset, int endOffset, String selectedText) {
        var idField = DSL.field("id", Integer.class);

        return dsl.insertInto(DSL.table("quote_selections"))
                .set(DSL.field("user_id", UUID.class), userId)
                .set(DSL.field("paragraph_id", Integer.class), paragraphId)
                .set(DSL.field("start_offset", Integer.class), startOffset)
                .set(DSL.field("end_offset", Integer.class), endOffset)
                .set(DSL.field("selected_text", String.class), selectedText)
                .returning(idField)
                .fetchOne(idField);
    }

    Optional<QuoteSelection> findByIdAndUserId(int quoteId, UUID userId) {
        var idField = DSL.field("id", Integer.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(idField.eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .fetchOptional(r -> new QuoteSelection(
                        r.get(idField), userId, r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(createdAtField)
                ));
    }

    List<QuoteSelection> findByUserId(UUID userId, Integer tagId, int page, int size) {
        var idField = DSL.field("id", Integer.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(conditions(userId, tagId))
                .orderBy(createdAtField.desc(), idField.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(r -> new QuoteSelection(
                        r.get(idField), userId, r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(createdAtField)
                ));
    }

    long countByUserId(UUID userId, Integer tagId) {
        return dsl.selectCount()
                .from(DSL.table("quote_selections"))
                .where(conditions(userId, tagId))
                .fetchOne(0, Long.class);
    }

    // Filtering by tagId is a subquery rather than a join: it keeps this method's return type
    // identical whether or not a filter is applied, and reads clearly as "id is among the quotes
    // tagged with tagId" rather than juggling join/no-join branches.
    private List<Condition> conditions(UUID userId, Integer tagId) {
        var conditions = new ArrayList<Condition>();
        conditions.add(DSL.field("user_id", UUID.class).eq(userId));

        if (tagId != null) {
            conditions.add(DSL.field("id", Integer.class).in(
                    DSL.select(DSL.field("quote_selection_id", Integer.class))
                            .from(DSL.table("quote_selection_tags"))
                            .where(DSL.field("tag_id", Integer.class).eq(tagId))
            ));
        }

        return conditions;
    }

    boolean deleteByIdAndUserId(int quoteId, UUID userId) {
        int affected = dsl.deleteFrom(DSL.table("quote_selections"))
                .where(DSL.field("id", Integer.class).eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .execute();
        return affected > 0;
    }

    Map<Integer, List<TagResponse>> tagsForQuoteIds(List<Integer> quoteIds) {
        if (quoteIds.isEmpty()) {
            return Map.of();
        }

        var quoteIdField = DSL.field("qst.quote_selection_id", Integer.class);
        var tagIdField = DSL.field("t.id", Integer.class);
        var nameField = DSL.field("t.name", String.class);

        var rows = dsl.select(quoteIdField, tagIdField, nameField)
                .from(DSL.table("quote_selection_tags").as("qst"))
                .join(DSL.table("tags").as("t"))
                        .on(DSL.field("t.id", Integer.class).eq(DSL.field("qst.tag_id", Integer.class)))
                .where(quoteIdField.in(quoteIds))
                .orderBy(DSL.lower(nameField), tagIdField)
                .fetch();

        Map<Integer, List<TagResponse>> result = new LinkedHashMap<>();
        for (var row : rows) {
            result.computeIfAbsent(row.get(quoteIdField), k -> new ArrayList<>())
                    .add(new TagResponse(row.get(tagIdField), row.get(nameField)));
        }
        return result;
    }

    // user_id is embedded in the mutation's own SELECT, not just checked by a separate read
    // beforehand — a quoteId that doesn't belong to userId simply has nothing to insert.
    void addTagForOwner(UUID userId, int quoteId, int tagId) {
        var quotes = DSL.table("quote_selections").as("q");
        var qIdField = DSL.field("q.id", Integer.class);
        var qUserIdField = DSL.field("q.user_id", UUID.class);

        dsl.insertInto(DSL.table("quote_selection_tags"),
                        DSL.field("quote_selection_id", Integer.class), DSL.field("tag_id", Integer.class))
                .select(dsl.select(qIdField, DSL.val(tagId))
                        .from(quotes)
                        .where(qIdField.eq(quoteId))
                        .and(qUserIdField.eq(userId)))
                .onConflictDoNothing()
                .execute();
    }

    // Same principle as addTagForOwner: user_id is part of the DELETE itself. A quoteId not
    // owned by userId and a tagId not associated with this quote both simply affect 0 rows —
    // the caller cannot and need not distinguish the two (see QuoteService.removeTag).
    int removeTagForOwner(UUID userId, int quoteId, int tagId) {
        var qst = DSL.table("quote_selection_tags").as("qst");
        var q = DSL.table("quote_selections").as("q");

        return dsl.deleteFrom(qst)
                .using(q)
                .where(DSL.field("qst.quote_selection_id", Integer.class).eq(DSL.field("q.id", Integer.class)))
                .and(DSL.field("q.id", Integer.class).eq(quoteId))
                .and(DSL.field("q.user_id", UUID.class).eq(userId))
                .and(DSL.field("qst.tag_id", Integer.class).eq(tagId))
                .execute();
    }
}
