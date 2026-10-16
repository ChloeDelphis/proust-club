package com.proustclub.quote;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

        var quoteIdField = DSL.field("qst.quote_selection_id", UUID.class);
        var tagIdField = DSL.field("t.id", UUID.class);
        var nameField = DSL.field("t.name", String.class);
        var colorIndexField = DSL.field("t.color_index", Integer.class);

        var rows = dsl.select(quoteIdField, tagIdField, nameField, colorIndexField)
                .from(DSL.table("quote_selection_tags").as("qst"))
                .join(DSL.table("tags").as("t"))
                        .on(tagIdField.eq(DSL.field("qst.tag_id", UUID.class)))
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

    int countForQuote(UUID quoteId) {
        return dsl.selectCount()
                .from(DSL.table("quote_selection_tags"))
                .where(DSL.field("quote_selection_id", UUID.class).eq(quoteId))
                .fetchOne(0, int.class);
    }

    boolean hasForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quoteTags = DSL.table("quote_selection_tags").as("qst");
        var quotes = DSL.table("quote_selections").as("q");

        return dsl.fetchExists(dsl.selectOne()
                .from(quoteTags)
                .join(quotes).on(DSL.field("qst.quote_selection_id", UUID.class).eq(DSL.field("q.id", UUID.class)))
                .where(DSL.field("q.id", UUID.class).eq(quoteId))
                .and(DSL.field("q.user_id", UUID.class).eq(userId))
                .and(DSL.field("qst.tag_id", UUID.class).eq(tagId)));
    }

    // user_id is part of the DELETE itself; callers cannot detach another user's association.
    int removeForOwner(UUID userId, UUID quoteId, UUID tagId) {
        var quoteTags = DSL.table("quote_selection_tags").as("qst");
        var quotes = DSL.table("quote_selections").as("q");

        return dsl.deleteFrom(quoteTags)
                .using(quotes)
                .where(DSL.field("qst.quote_selection_id", UUID.class).eq(DSL.field("q.id", UUID.class)))
                .and(DSL.field("q.id", UUID.class).eq(quoteId))
                .and(DSL.field("q.user_id", UUID.class).eq(userId))
                .and(DSL.field("qst.tag_id", UUID.class).eq(tagId))
                .execute();
    }
}
