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

    private static final int PREVIEW_CONTEXT_CODE_POINTS = 60;

    private final DSLContext dsl;

    SearchRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<SearchResult> search(String query, Integer volumeId, Integer partId, int page, int size) {
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
                .and(partId == null ? DSL.noCondition() : part.ID.eq(partId))
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

    List<SearchOverviewEntry> searchOverview(String query) {
        String pattern = "%" + LikePatterns.escape(query) + "%";
        var paragraph = PARAGRAPHS.as("p");
        var pText = paragraph.TEXT;
        var matchStart = DSL.function("strpos", Integer.class, DSL.lower(pText), DSL.lower(DSL.val(query)));
        var windowStart = DSL.function(
                "greatest",
                Integer.class,
                DSL.val(1),
                matchStart.sub(PREVIEW_CONTEXT_CODE_POINTS)
        );
        int queryLengthCodePoints = query.codePointCount(0, query.length());
        var previewWindow = DSL.function(
                "substring",
                String.class,
                pText,
                windowStart,
                DSL.val(queryLengthCodePoints + 2 * PREVIEW_CONTEXT_CODE_POINTS)
        );

        return dsl.select(
                        paragraph.ID,
                        paragraph.VOLUME_ID,
                        paragraph.PART_ID,
                        paragraph.PAGE_NUMBER,
                        previewWindow.as("preview_window"),
                        matchStart.sub(windowStart).as("match_offset")
                )
                .from(paragraph)
                .where(pText.likeIgnoreCase(pattern, '\\'))
                .orderBy(paragraph.POSITION)
                .fetch(r -> new SearchOverviewEntry(
                        r.get(paragraph.ID),
                        r.get(paragraph.VOLUME_ID),
                        r.get(paragraph.PART_ID),
                        r.get(paragraph.PAGE_NUMBER),
                        r.get("preview_window", String.class),
                        r.get("match_offset", Integer.class)
                ));
    }

    long count(String query, Integer volumeId, Integer partId) {
        String pattern = "%" + LikePatterns.escape(query) + "%";
        var volumeCondition = volumeId == null
                ? DSL.noCondition()
                : PARAGRAPHS.VOLUME_ID.eq(volumeId);
        var partCondition = partId == null ? DSL.noCondition() : PARAGRAPHS.PART_ID.eq(partId);
        return dsl
                .selectCount()
                .from(PARAGRAPHS)
                .where(PARAGRAPHS.TEXT.likeIgnoreCase(pattern, '\\'))
                .and(volumeCondition)
                .and(partCondition)
                .fetchOne(0, Long.class);
    }
}
