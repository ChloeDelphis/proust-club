package com.proustclub.search;

import com.proustclub.search.dto.SearchHit;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
class SearchRepository {

    private final DSLContext dsl;

    SearchRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<SearchHit> search(String query, int page, int size) {
        String pattern = "%" + escapeForLike(query) + "%";
        var pText = DSL.field("p.text", String.class);

        return dsl
                .select(
                        DSL.field("p.id", Integer.class).as("paragraph_id"),
                        pText.as("text"),
                        DSL.field("p.page_number", Integer.class).as("page_number"),
                        DSL.field("v.title", String.class).as("volume_title"),
                        DSL.field("pt.title", String.class).as("part_title"),
                        DSL.function("strpos", Integer.class,
                                DSL.lower(pText),
                                DSL.lower(DSL.val(query))
                        ).sub(1).as("start_offset")
                )
                .from(DSL.table("paragraphs").as("p"))
                .join(DSL.table("parts").as("pt"))
                        .on(DSL.field("p.part_id", Integer.class).eq(DSL.field("pt.id", Integer.class)))
                .join(DSL.table("volumes").as("v"))
                        .on(DSL.field("p.volume_id", Integer.class).eq(DSL.field("v.id", Integer.class)))
                .where(pText.likeIgnoreCase(pattern, '\\'))
                .orderBy(DSL.field("p.position"))
                .limit(size)
                .offset((long) page * size)
                .fetch(r -> {
                    int startOffset = r.get("start_offset", Integer.class);
                    return new SearchHit(
                            r.get("paragraph_id", Integer.class),
                            r.get("text", String.class),
                            startOffset,
                            startOffset + query.length(),
                            r.get("volume_title", String.class),
                            r.get("part_title", String.class),
                            r.get("page_number", Integer.class)
                    );
                });
    }

    long count(String query) {
        String pattern = "%" + escapeForLike(query) + "%";
        return dsl
                .selectCount()
                .from(DSL.table("paragraphs"))
                .where(DSL.field("text", String.class).likeIgnoreCase(pattern, '\\'))
                .fetchOne(0, Long.class);
    }

    // Escapes %, _ and \ which have special meaning in SQL LIKE patterns
    private static String escapeForLike(String q) {
        return q.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
