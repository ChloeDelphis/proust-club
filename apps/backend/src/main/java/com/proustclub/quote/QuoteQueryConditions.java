package com.proustclub.quote;

import com.proustclub.common.LikePatterns;
import org.jooq.Condition;
import org.jooq.impl.DSL;

import java.util.UUID;

final class QuoteQueryConditions {

    private QuoteQueryConditions() {}

    // Shared by paginated quote queries and the unpaginated timeline query.
    static Condition forUser(String alias, UUID userId, UUID tagId, String q, Integer volumeId) {
        Condition condition = DSL.field(alias + "user_id", UUID.class).eq(userId);

        if (tagId != null) {
            condition = condition.and(DSL.field(alias + "id", UUID.class).in(
                    DSL.select(DSL.field("quote_selection_id", UUID.class))
                            .from(DSL.table("quote_selection_tags"))
                            .where(DSL.field("tag_id", UUID.class).eq(tagId))
            ));
        }

        if (q != null) {
            String pattern = "%" + LikePatterns.escape(q) + "%";
            condition = condition.and(DSL.field(alias + "selected_text", String.class).likeIgnoreCase(pattern, '\\'));
        }

        if (volumeId != null) {
            condition = condition.and(DSL.field(alias + "paragraph_id", Integer.class).in(
                    DSL.select(DSL.field("id", Integer.class))
                            .from(DSL.table("paragraphs"))
                            .where(DSL.field("volume_id", Integer.class).eq(volumeId))
            ));
        }

        return condition;
    }
}
