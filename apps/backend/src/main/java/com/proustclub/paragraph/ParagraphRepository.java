package com.proustclub.paragraph;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
class ParagraphRepository {

    private final DSLContext dsl;

    ParagraphRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    record Anchor(int volumeId, int position) {}

    record Row(int id, String text, int pageNumber) {}

    Optional<Anchor> findAnchor(int paragraphId) {
        var volumeIdField = DSL.field("volume_id", Integer.class);
        var positionField = DSL.field("position", Integer.class);

        return dsl.select(volumeIdField, positionField)
                .from(DSL.table("paragraphs"))
                .where(DSL.field("id", Integer.class).eq(paragraphId))
                .fetchOptional(r -> new Anchor(r.get(volumeIdField), r.get(positionField)));
    }

    // Fetches one row more than `limit`, within the same volume as `volumeId` — crossing into a
    // different volume never happens, since `position` is global but this filter isn't. The extra
    // row (if present) tells the caller "more context exists" without a separate count query; it's
    // trimmed by the caller, never returned as-is. Ordered nearest-to-furthest from the center —
    // the caller reverses this to get reading order (oldest first).
    List<Row> findBefore(int volumeId, int position, int limit) {
        var idField = DSL.field("id", Integer.class);
        var textField = DSL.field("text", String.class);
        var pageNumberField = DSL.field("page_number", Integer.class);
        var positionField = DSL.field("position", Integer.class);

        return dsl.select(idField, textField, pageNumberField)
                .from(DSL.table("paragraphs"))
                .where(DSL.field("volume_id", Integer.class).eq(volumeId))
                .and(positionField.lt(position))
                .orderBy(positionField.desc())
                .limit(limit + 1)
                .fetch(r -> new Row(r.get(idField), r.get(textField), r.get(pageNumberField)));
    }

    // Already in reading order (nearest-to-center first = earliest position first) — no reversal
    // needed by the caller, unlike findBefore.
    List<Row> findAfter(int volumeId, int position, int limit) {
        var idField = DSL.field("id", Integer.class);
        var textField = DSL.field("text", String.class);
        var pageNumberField = DSL.field("page_number", Integer.class);
        var positionField = DSL.field("position", Integer.class);

        return dsl.select(idField, textField, pageNumberField)
                .from(DSL.table("paragraphs"))
                .where(DSL.field("volume_id", Integer.class).eq(volumeId))
                .and(positionField.gt(position))
                .orderBy(positionField.asc())
                .limit(limit + 1)
                .fetch(r -> new Row(r.get(idField), r.get(textField), r.get(pageNumberField)));
    }
}
