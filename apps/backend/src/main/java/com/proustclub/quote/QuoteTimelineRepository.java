package com.proustclub.quote;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
class QuoteTimelineRepository {

    private final DSLContext dsl;

    QuoteTimelineRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    // Unpaginated by design: the timeline needs every saved quote to place every bookmark.
    List<TimelineEntry> findByUserId(UUID userId, UUID tagId, String q) {
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
                .where(QuoteQueryConditions.forUser("qs.", userId, tagId, q, null))
                .orderBy(positionField)
                .fetch(r -> new TimelineEntry(
                        r.get(idField), r.get(paragraphIdField), r.get(pageNumberField),
                        r.get(volumeIdField), r.get(selectedTextField), r.get(commentField), r.get(createdAtField)
                ));
    }

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
}
