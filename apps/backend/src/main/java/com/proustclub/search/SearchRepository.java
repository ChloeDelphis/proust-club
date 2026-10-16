package com.proustclub.search;

import com.proustclub.common.LikePatterns;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;

import static com.proustclub.jooq.Tables.PARAGRAPHS;
import static com.proustclub.jooq.Tables.PARTS;
import static com.proustclub.jooq.Tables.VOLUMES;

@Repository
class SearchRepository {

    private final DSLContext dsl;

    SearchRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<SearchResult> search(String query, Integer volumeId, int page, int size) {
        String pattern = "%" + LikePatterns.escape(query) + "%";
        var paragraph = PARAGRAPHS.as("p");
        var part = PARTS.as("pt");
        var volume = VOLUMES.as("v");
        var pText = paragraph.TEXT;
        var pVolumeId = paragraph.VOLUME_ID;

        return dsl
                .select(
                        paragraph.ID.as("paragraph_id"),
                        pText.as("text"),
                        paragraph.PAGE_NUMBER.as("page_number"),
                        volume.TITLE.as("volume_title"),
                        part.TITLE.as("part_title"),
                        DSL.function("strpos", Integer.class,
                                DSL.lower(pText),
                                DSL.lower(DSL.val(query))
                        ).sub(1).as("start_offset")
                )
                .from(paragraph)
                .join(part)
                        .on(paragraph.PART_ID.eq(part.ID))
                .join(volume)
                        .on(paragraph.VOLUME_ID.eq(volume.ID))
                .where(pText.likeIgnoreCase(pattern, '\\'))
                .and(volumeId == null ? DSL.noCondition() : pVolumeId.eq(volumeId))
                .orderBy(paragraph.POSITION)
                .limit(size)
                .offset((long) page * size)
                .fetch(r -> {
                    String text = r.get("text", String.class);
                    int startCharacterOffset = r.get("start_offset", Integer.class);
                    // PostgreSQL counts Unicode characters; Java and the frontend index strings
                    // in UTF-16 code units. Convert before returning offsets used by substring/slice.
                    int startOffset = text.offsetByCodePoints(0, startCharacterOffset);
                    return new SearchResult(
                            r.get("paragraph_id", Integer.class),
                            text,
                            startOffset,
                            startOffset + query.length(),
                            r.get("volume_title", String.class),
                            r.get("part_title", String.class),
                            r.get("page_number", Integer.class)
                    );
                });
    }

    long count(String query, Integer volumeId) {
        String pattern = "%" + LikePatterns.escape(query) + "%";
        var volumeCondition = volumeId == null
                ? DSL.noCondition()
                : PARAGRAPHS.VOLUME_ID.eq(volumeId);
        return dsl
                .selectCount()
                .from(PARAGRAPHS)
                .where(PARAGRAPHS.TEXT.likeIgnoreCase(pattern, '\\'))
                .and(volumeCondition)
                .fetchOne(0, Long.class);
    }
}
