package com.proustclub.quote;

import com.proustclub.common.LikePatterns;
import org.jooq.Condition;
import com.proustclub.jooq.tables.QuoteSelections;
import org.jooq.impl.DSL;

import java.util.UUID;

import static com.proustclub.jooq.Tables.PARAGRAPHS;
import static com.proustclub.jooq.Tables.QUOTE_SELECTION_TAGS;

final class QuoteQueryConditions {

    private QuoteQueryConditions() {}

    // Shared by paginated quote queries and the unpaginated timeline query.
    static Condition forUser(QuoteSelections quoteSelections, UUID userId, UUID tagId, String q, Integer volumeId) {
        Condition condition = quoteSelections.USER_ID.eq(userId);

        if (tagId != null) {
            condition = condition.and(quoteSelections.ID.in(
                    DSL.select(QUOTE_SELECTION_TAGS.QUOTE_SELECTION_ID)
                            .from(QUOTE_SELECTION_TAGS)
                            .where(QUOTE_SELECTION_TAGS.TAG_ID.eq(tagId))
            ));
        }

        if (q != null) {
            String pattern = "%" + LikePatterns.escape(q) + "%";
            condition = condition.and(quoteSelections.SELECTED_TEXT.likeIgnoreCase(pattern, '\\'));
        }

        if (volumeId != null) {
            condition = condition.and(quoteSelections.PARAGRAPH_ID.in(
                    DSL.select(PARAGRAPHS.ID)
                            .from(PARAGRAPHS)
                            .where(PARAGRAPHS.VOLUME_ID.eq(volumeId))
            ));
        }

        return condition;
    }
}
