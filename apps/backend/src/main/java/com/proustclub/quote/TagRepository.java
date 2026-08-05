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
        var idField = DSL.field("id", Integer.class);
        var nameField = DSL.field("name", String.class);

        return dsl.select(idField, nameField)
                .from(DSL.table("tags"))
                .where(DSL.field("user_id", UUID.class).eq(userId))
                .orderBy(DSL.lower(nameField), idField)
                .fetch(r -> new TagResponse(r.get(idField), r.get(nameField)));
    }

    private Optional<Integer> findIdByUserIdAndNormalizedName(UUID userId, String trimmedName) {
        var idField = DSL.field("id", Integer.class);
        var nameField = DSL.field("name", String.class);

        return dsl.select(idField)
                .from(DSL.table("tags"))
                .where(DSL.field("user_id", UUID.class).eq(userId))
                .and(DSL.lower(nameField).eq(trimmedName.toLowerCase(Locale.ROOT)))
                .fetchOptional(idField);
    }

    // Shared primitive for TagService.create() (409 on conflict) and upsertByName() (reuse on
    // conflict) — targets the exact (user_id, LOWER(name)) unique index rather than catching any
    // DuplicateKeyException, which would also mask an unrelated PK collision.
    Optional<Integer> insertIfAbsent(UUID userId, String trimmedName) {
        var userIdField = DSL.field("user_id", UUID.class);
        var nameField = DSL.field("name", String.class);
        var idField = DSL.field("id", Integer.class);

        return dsl.insertInto(DSL.table("tags"))
                .set(userIdField, userId)
                .set(nameField, trimmedName)
                .onConflict(userIdField, DSL.lower(nameField))
                .doNothing()
                .returning(idField)
                .fetchOptional(idField);
    }

    int upsertByName(UUID userId, String rawName) {
        String trimmed = rawName.trim();
        return insertIfAbsent(userId, trimmed)
                .orElseGet(() -> findIdByUserIdAndNormalizedName(userId, trimmed)
                        .orElseThrow(() -> new IllegalStateException("Tag conflict detected but row not found: " + trimmed)));
    }

    // UPDATE has no ON CONFLICT equivalent, so the conflict check is expressed as a NOT EXISTS
    // in the WHERE clause itself rather than caught from a unique constraint violation. `id <> id`
    // excludes the row being renamed, so re-casing a tag's own name never trips this.
    RenameOutcome renameForOwner(UUID userId, int tagId, String trimmedName) {
        var idField = DSL.field("id", Integer.class);
        var userIdField = DSL.field("user_id", UUID.class);
        var nameField = DSL.field("name", String.class);
        var otherTags = DSL.table("tags").as("other");
        var otherIdField = DSL.field("other.id", Integer.class);
        var otherUserIdField = DSL.field("other.user_id", UUID.class);
        var otherNameField = DSL.field("other.name", String.class);

        int affected = dsl.update(DSL.table("tags"))
                .set(nameField, trimmedName)
                .where(idField.eq(tagId))
                .and(userIdField.eq(userId))
                .and(DSL.notExists(
                        dsl.selectOne().from(otherTags)
                                .where(otherUserIdField.eq(userId))
                                .and(DSL.lower(otherNameField).eq(trimmedName.toLowerCase(Locale.ROOT)))
                                .and(otherIdField.ne(tagId))
                ))
                .execute();

        if (affected > 0) {
            return RenameOutcome.RENAMED;
        }

        boolean ownedByUser = dsl.fetchExists(
                dsl.selectFrom(DSL.table("tags")).where(idField.eq(tagId)).and(userIdField.eq(userId)));
        return ownedByUser ? RenameOutcome.NAME_TAKEN : RenameOutcome.NOT_FOUND;
    }

    // The cascade on quote_selection_tags.tag_id (ON DELETE CASCADE, V5) handles detaching this
    // tag from every quote — no application-level cleanup needed here.
    boolean deleteForOwner(UUID userId, int tagId) {
        int affected = dsl.deleteFrom(DSL.table("tags"))
                .where(DSL.field("id", Integer.class).eq(tagId))
                .and(DSL.field("user_id", UUID.class).eq(userId))
                .execute();
        return affected > 0;
    }
}
