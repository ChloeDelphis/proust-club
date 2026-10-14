package com.proustclub.quote;

import com.proustclub.quote.dto.TagResponse;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Repository
class TagRepository {

    private final DSLContext dsl;

    TagRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<TagResponse> findByUserId(UUID userId) {
        var idField = DSL.field("id", UUID.class);
        var nameField = DSL.field("name", String.class);
        var colorIndexField = DSL.field("color_index", Integer.class);

        return dsl.select(idField, nameField, colorIndexField)
                .from(DSL.table("tags"))
                .where(DSL.field("user_id", UUID.class).eq(userId))
                .orderBy(DSL.lower(nameField), idField)
                .fetch(r -> new TagResponse(r.get(idField), r.get(nameField), r.get(colorIndexField)));
    }

    // Shared primitive for TagService.create() (409 on conflict) and upsertByName() (reuse on
    // conflict) — targets the exact (user_id, LOWER(name)) unique index rather than catching any
    // DuplicateKeyException, which would also mask an unrelated PK collision. `colorIndex` is only
    // ever non-null from the explicit "create a tag" endpoint — upsertByName()'s implicit creation
    // (while tagging a quote) never has a color to choose, and omitting the column (rather than
    // passing an explicit NULL) lets the DB's own DEFAULT 0 apply.
    Optional<TagResponse> insertIfAbsent(UUID userId, String trimmedName, Integer colorIndex) {
        var userIdField = DSL.field("user_id", UUID.class);
        var nameField = DSL.field("name", String.class);
        var idField = DSL.field("id", UUID.class);
        var colorIndexField = DSL.field("color_index", Integer.class);

        var insert = dsl.insertInto(DSL.table("tags"))
                .set(userIdField, userId)
                .set(nameField, trimmedName);
        if (colorIndex != null) {
            insert = insert.set(colorIndexField, colorIndex);
        }

        return insert
                .onConflict(userIdField, DSL.lower(nameField))
                .doNothing()
                .returning(idField, colorIndexField)
                .fetchOptional(r -> new TagResponse(r.get(idField), trimmedName, r.get(colorIndexField)));
    }

    Optional<UUID> findIdByUserIdAndNormalizedName(UUID userId, String trimmedName) {
        var idField = DSL.field("id", UUID.class);
        var nameField = DSL.field("name", String.class);

        return dsl.select(idField)
                .from(DSL.table("tags"))
                .where(DSL.field("user_id", UUID.class).eq(userId))
                .and(DSL.lower(nameField).eq(trimmedName.toLowerCase(Locale.ROOT)))
                .fetchOptional(idField);
    }

    UUID upsertByName(UUID userId, String rawName) {
        String trimmed = rawName.trim();
        return insertIfAbsent(userId, trimmed, null)
                .map(TagResponse::id)
                .orElseGet(() -> findIdByUserIdAndNormalizedName(userId, trimmed)
                        .orElseThrow(() -> new IllegalStateException("Tag conflict detected but row not found: " + trimmed)));
    }

    record RenameResult(RenameOutcome outcome, Integer colorIndex) {}

    // UPDATE has no ON CONFLICT equivalent, so the conflict check is expressed as a NOT EXISTS
    // in the WHERE clause itself rather than caught from a unique constraint violation.
    // `other.id <> tagId` excludes the row being renamed, so re-casing a tag's own name never
    // trips this. Renaming never changes the color, but RETURNING it directly off this UPDATE
    // (rather than a follow-up SELECT) is free — TagService.rename() needs it to build the response.
    RenameResult renameForOwner(UUID userId, UUID tagId, String trimmedName) {
        var idField = DSL.field("id", UUID.class);
        var userIdField = DSL.field("user_id", UUID.class);
        var nameField = DSL.field("name", String.class);
        var colorIndexField = DSL.field("color_index", Integer.class);
        var otherTags = DSL.table("tags").as("other");
        var otherIdField = DSL.field("other.id", UUID.class);
        var otherUserIdField = DSL.field("other.user_id", UUID.class);
        var otherNameField = DSL.field("other.name", String.class);

        var updated = dsl.update(DSL.table("tags"))
                .set(nameField, trimmedName)
                .where(idField.eq(tagId))
                .and(userIdField.eq(userId))
                .and(DSL.notExists(
                        dsl.selectOne().from(otherTags)
                                .where(otherUserIdField.eq(userId))
                                .and(DSL.lower(otherNameField).eq(trimmedName.toLowerCase(Locale.ROOT)))
                                .and(otherIdField.ne(tagId))
                ))
                .returning(colorIndexField)
                .fetch();

        if (!updated.isEmpty()) {
            return new RenameResult(RenameOutcome.RENAMED, updated.get(0).get(colorIndexField));
        }

        boolean ownedByUser = dsl.fetchExists(
                dsl.selectFrom(DSL.table("tags")).where(idField.eq(tagId)).and(userIdField.eq(userId)));
        return new RenameResult(ownedByUser ? RenameOutcome.NAME_TAKEN : RenameOutcome.NOT_FOUND, null);
    }

    // The cascade on quote_selection_tags.tag_id (ON DELETE CASCADE, V5) handles detaching this
    // tag from every quote — no application-level cleanup needed here.
    boolean deleteForOwner(UUID userId, UUID tagId) {
        int affected = dsl.deleteFrom(DSL.table("tags"))
                .where(DSL.field("id", UUID.class).eq(tagId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .execute();
        return affected > 0;
    }
}
