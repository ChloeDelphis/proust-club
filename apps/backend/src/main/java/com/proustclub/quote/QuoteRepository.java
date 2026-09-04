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

    // Returns the full domain object built from the INSERT ... RETURNING row (id + the
    // DB-generated created_at) rather than just the id — every other field is already known from
    // the arguments, so there's no need for the caller to re-SELECT the row it just wrote.
    // comment is hardcoded to null here (not a DB round-trip): a freshly inserted quote never has
    // one yet — it's only set later via updateCommentForOwner.
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

        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, commentField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(idField.eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .fetchOptional(r -> new QuoteSelection(
                        r.get(idField), r.get(paragraphIdField),
                        r.get(startOffsetField), r.get(endOffsetField),
                        r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

    List<QuoteSelection> findByUserId(UUID userId, UUID tagId, int page, int size) {
        var idField = DSL.field("id", UUID.class);
        var paragraphIdField = DSL.field("paragraph_id", Integer.class);
        var startOffsetField = DSL.field("start_offset", Integer.class);
        var endOffsetField = DSL.field("end_offset", Integer.class);
        var selectedTextField = DSL.field("selected_text", String.class);
        var commentField = DSL.field("comment", String.class);
        var createdAtField = DSL.field("created_at", Instant.class);

        // id DESC is a tiebreak for equal created_at (same-transaction inserts share Postgres's
        // now(), so ties aren't just a theoretical microsecond coincidence). Since the UUID
        // migration this only guarantees a stable, total order — it no longer approximates
        // insertion order the way the previous SERIAL id incidentally did. No business rule
        // specifies the order among ties, so this is intentionally left as-is.
        return dsl.select(idField, paragraphIdField, startOffsetField, endOffsetField, selectedTextField, commentField, createdAtField)
                .from(DSL.table("quote_selections"))
                .where(conditions("", userId, tagId))
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

    // Flat, unpaginated: the personal timeline needs every one of the user's quotes at once to
    // place all bookmarks — there is no page size that makes sense here, unlike findByUserId.
    List<TimelineEntry> findTimelineByUserId(UUID userId, UUID tagId) {
        var idField = DSL.field("qs.id", UUID.class);
        var paragraphIdField = DSL.field("qs.paragraph_id", Integer.class);
        var selectedTextField = DSL.field("qs.selected_text", String.class);
        var commentField = DSL.field("qs.comment", String.class);
        var createdAtField = DSL.field("qs.created_at", Instant.class);
        var positionField = DSL.field("p.position", Integer.class);
        var pageNumberField = DSL.field("p.page_number", Integer.class);
        var volumeIdField = DSL.field("p.volume_id", Integer.class);

        return dsl.select(idField, paragraphIdField, pageNumberField, volumeIdField, selectedTextField, commentField, createdAtField)
                .from(DSL.table("quote_selections").as("qs"))
                .join(DSL.table("paragraphs").as("p"))
                        .on(paragraphIdField.eq(DSL.field("p.id", Integer.class)))
                .where(conditions("qs.", userId, tagId))
                .orderBy(positionField)
                .fetch(r -> new TimelineEntry(
                        r.get(idField), r.get(paragraphIdField), r.get(pageNumberField),
                        r.get(volumeIdField), r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

    // 7 rows, pre-computed at import time (see CorpusImportService) — no aggregation here, at
    // any scale.
    List<VolumeRange> findVolumesWithPageRange() {
        var idField = DSL.field("id", Integer.class);
        var titleField = DSL.field("title", String.class);
        var positionField = DSL.field("position", Integer.class);
        var minPageField = DSL.field("min_page", Integer.class);
        var maxPageField = DSL.field("max_page", Integer.class);

        return dsl.select(idField, titleField, positionField, minPageField, maxPageField)
                .from(DSL.table("volumes"))
                .orderBy(positionField)
                .fetch(r -> new VolumeRange(
                        r.get(idField), r.get(titleField), r.get(positionField),
                        r.get(minPageField), r.get(maxPageField)
                ));
    }

    long countByUserId(UUID userId, UUID tagId) {
        return dsl.selectCount()
                .from(DSL.table("quote_selections"))
                .where(conditions("", userId, tagId))
                .fetchOne(0, Long.class);
    }

    // Filtering by tagId is a subquery rather than a join: it keeps this method's return type
    // identical whether or not a filter is applied, and reads clearly as "id is among the quotes
    // tagged with tagId" rather than juggling join/no-join branches. `alias` qualifies the
    // quote_selections columns for callers that join it under an alias (e.g. findTimelineByUserId
    // joining "qs") — pass "" for callers selecting from quote_selections unaliased.
    private List<Condition> conditions(String alias, UUID userId, UUID tagId) {
        var conditions = new ArrayList<Condition>();
        conditions.add(DSL.field(alias + "user_id", UUID.class).eq(userId));

        if (tagId != null) {
            conditions.add(DSL.field(alias + "id", UUID.class).in(
                    DSL.select(DSL.field("quote_selection_id", UUID.class))
                            .from(DSL.table("quote_selection_tags"))
                            .where(DSL.field("tag_id", UUID.class).eq(tagId))
            ));
        }

        return conditions;
    }

    boolean deleteByIdAndUserId(UUID quoteId, UUID userId) {
        int affected = dsl.deleteFrom(DSL.table("quote_selections"))
                .where(DSL.field("id", UUID.class).eq(quoteId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .execute();
        return affected > 0;
    }

    Map<UUID, List<TagResponse>> tagsForQuoteIds(List<UUID> quoteIds) {
        if (quoteIds.isEmpty()) {
            return Map.of();
        }

        var quoteIdField = DSL.field("qst.quote_selection_id", UUID.class);
        var tagIdField = DSL.field("t.id", UUID.class);
        var nameField = DSL.field("t.name", String.class);

        var rows = dsl.select(quoteIdField, tagIdField, nameField)
                .from(DSL.table("quote_selection_tags").as("qst"))
                .join(DSL.table("tags").as("t"))
                        .on(DSL.field("t.id", UUID.class).eq(DSL.field("qst.tag_id", UUID.class)))
                .where(quoteIdField.in(quoteIds))
                .orderBy(DSL.lower(nameField), tagIdField)
                .fetch();

        Map<UUID, List<TagResponse>> result = new LinkedHashMap<>();
        for (var row : rows) {
            result.computeIfAbsent(row.get(quoteIdField), k -> new ArrayList<>())
                    .add(new TagResponse(row.get(tagIdField), row.get(nameField)));
        }
        return result;
    }

    // user_id is embedded in the mutation's own SELECT, not just checked by a separate read
    // beforehand — a quoteId that doesn't belong to userId simply has nothing to insert.
    void addTagForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quotes = DSL.table("quote_selections").as("q");
        var qIdField = DSL.field("q.id", UUID.class);
        var qUserIdField = DSL.field("q.user_id", UUID.class);

        dsl.insertInto(DSL.table("quote_selection_tags"),
                        DSL.field("quote_selection_id", UUID.class), DSL.field("tag_id", UUID.class))
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
    int removeTagForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var qst = DSL.table("quote_selection_tags").as("qst");
        var q = DSL.table("quote_selections").as("q");

        return dsl.deleteFrom(qst)
                .using(q)
                .where(DSL.field("qst.quote_selection_id", UUID.class).eq(DSL.field("q.id", UUID.class)))
                .and(DSL.field("q.id", UUID.class).eq(quoteId))
                .and(DSL.field("q.user_id", UUID.class).eq(userId))
                .and(DSL.field("qst.tag_id", UUID.class).eq(tagId))
                .execute();
    }
}
