package com.proustclub.paragraph;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.SortField;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import static com.proustclub.jooq.Tables.PARAGRAPHS;

@Repository
class ParagraphRepository {

    private final DSLContext dsl;

    ParagraphRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    record Anchor(int volumeId, int position) {}

    record Row(int id, String text, int pageNumber) {}

    private static final Field<Integer> ID = PARAGRAPHS.ID;
    private static final Field<String> TEXT = PARAGRAPHS.TEXT;
    private static final Field<Integer> PAGE_NUMBER = PARAGRAPHS.PAGE_NUMBER;
    private static final Field<Integer> POSITION = PARAGRAPHS.POSITION;
    private static final Field<Integer> VOLUME_ID = PARAGRAPHS.VOLUME_ID;

    Optional<Anchor> findAnchor(int paragraphId) {
        return dsl.select(VOLUME_ID, POSITION)
                .from(PARAGRAPHS)
                .where(ID.eq(paragraphId))
                .fetchOptional(r -> new Anchor(r.get(VOLUME_ID), r.get(POSITION)));
    }

    // Fetches one row more than `limit`, within the same volume as `volumeId` — crossing into a
    // different volume never happens, since `position` is global but this filter isn't. The extra
    // row (if present) tells the caller "more context exists" without a separate count query; it's
    // trimmed by the caller, never returned as-is. Ordered nearest-to-furthest from the center —
    // the caller reverses this to get reading order (oldest first).
    List<Row> findBefore(int volumeId, int position, int limit) {
        return findNeighbors(volumeId, POSITION.lt(position), POSITION.desc(), limit);
    }

    // Already in reading order (nearest-to-center first = earliest position first) — no reversal
    // needed by the caller, unlike findBefore.
    List<Row> findAfter(int volumeId, int position, int limit) {
        return findNeighbors(volumeId, POSITION.gt(position), POSITION.asc(), limit);
    }

    private List<Row> findNeighbors(int volumeId, Condition positionCondition, SortField<Integer> order, int limit) {
        return dsl.select(ID, TEXT, PAGE_NUMBER)
                .from(PARAGRAPHS)
                .where(VOLUME_ID.eq(volumeId))
                .and(positionCondition)
                .orderBy(order)
                .limit(limit + 1)
                .fetch(r -> new Row(r.get(ID), r.get(TEXT), r.get(PAGE_NUMBER)));
    }
}
