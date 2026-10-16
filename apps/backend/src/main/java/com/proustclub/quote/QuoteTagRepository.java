package com.proustclub.quote;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.proustclub.jooq.Tables.QUOTE_SELECTIONS;
import static com.proustclub.jooq.Tables.QUOTE_SELECTION_TAGS;
import static com.proustclub.jooq.Tables.TAGS;

@Repository
class QuoteTagRepository {

    private final DSLContext dsl;

    QuoteTagRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    Map<UUID, List<QuoteTag>> findByQuoteIds(List<UUID> quoteIds) {
        if (quoteIds.isEmpty()) {
            return Map.of();
        }

        var quoteSelectionTags = QUOTE_SELECTION_TAGS.as("qst");
        var tags = TAGS.as("t");
        var quoteIdField = quoteSelectionTags.QUOTE_SELECTION_ID;
        var tagIdField = tags.ID;
        var nameField = tags.NAME;
        var colorIndexField = tags.COLOR_INDEX;

        var rows = dsl.select(quoteIdField, tagIdField, nameField, colorIndexField)
                .from(quoteSelectionTags)
                .join(tags).on(tagIdField.eq(quoteSelectionTags.TAG_ID))
                .where(quoteIdField.in(quoteIds))
                .orderBy(DSL.lower(nameField), tagIdField)
                .fetch();

        Map<UUID, List<QuoteTag>> result = new LinkedHashMap<>();
        for (var row : rows) {
            result.computeIfAbsent(row.get(quoteIdField), k -> new ArrayList<>())
                    .add(new QuoteTag(row.get(tagIdField), row.get(nameField), row.get(colorIndexField)));
        }
        return result;
    }

    // user_id is embedded in the mutation's own SELECT, not just checked by a separate read.
    void addForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quotes = QUOTE_SELECTIONS.as("q");

        dsl.insertInto(QUOTE_SELECTION_TAGS, QUOTE_SELECTION_TAGS.QUOTE_SELECTION_ID, QUOTE_SELECTION_TAGS.TAG_ID)
                .select(dsl.select(quotes.ID, DSL.val(tagId))
                        .from(quotes)
                        .where(quotes.ID.eq(quoteId))
                        .and(quotes.USER_ID.eq(userId)))
                .onConflictDoNothing()
                .execute();
    }

    int countForQuote(UUID quoteId) {
        return dsl.selectCount()
                .from(QUOTE_SELECTION_TAGS)
                .where(QUOTE_SELECTION_TAGS.QUOTE_SELECTION_ID.eq(quoteId))
                .fetchOne(0, int.class);
    }

    boolean hasForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quoteTags = QUOTE_SELECTION_TAGS.as("qst");
        var quotes = QUOTE_SELECTIONS.as("q");

        return dsl.fetchExists(dsl.selectOne()
                .from(quoteTags)
                .join(quotes).on(quoteTags.QUOTE_SELECTION_ID.eq(quotes.ID))
                .where(quotes.ID.eq(quoteId))
                .and(quotes.USER_ID.eq(userId))
                .and(quoteTags.TAG_ID.eq(tagId)));
    }

    // user_id is part of the DELETE itself; callers cannot detach another user's association.
    int removeForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quoteTags = QUOTE_SELECTION_TAGS.as("qst");
        var quotes = QUOTE_SELECTIONS.as("q");

        return dsl.deleteFrom(quoteTags)
                .using(quotes)
                .where(quoteTags.QUOTE_SELECTION_ID.eq(quotes.ID))
                .and(quotes.ID.eq(quoteId))
                .and(quotes.USER_ID.eq(userId))
                .and(quoteTags.TAG_ID.eq(tagId))
                .execute();
    }
}
