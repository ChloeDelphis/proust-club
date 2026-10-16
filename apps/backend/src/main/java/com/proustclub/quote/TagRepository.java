package com.proustclub.quote;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.proustclub.jooq.Tables.TAGS;

@Repository
class TagRepository {

    private final DSLContext dsl;

    TagRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<TagData> findByUserId(UUID userId) {
        return dsl.select(TAGS.ID, TAGS.NAME, TAGS.COLOR_INDEX)
                .from(TAGS)
                .where(TAGS.USER_ID.eq(userId))
                .orderBy(DSL.lower(TAGS.NAME), TAGS.ID)
                .fetch(r -> new TagData(r.get(TAGS.ID), r.get(TAGS.NAME), r.get(TAGS.COLOR_INDEX).intValue()));
    }

    // Shared primitive for TagService.create() (409 on conflict) and upsertByName() (reuse on
    // conflict) — targets the exact (user_id, LOWER(name)) unique index rather than catching any
    // DuplicateKeyException, which would also mask an unrelated PK collision. `colorIndex` is only
    // ever non-null from the explicit "create a tag" endpoint — upsertByName()'s implicit creation
    // (while tagging a quote) never has a color to choose, and omitting the column (rather than
    // passing an explicit NULL) lets the DB's own DEFAULT 0 apply.
    Optional<TagData> insertIfAbsent(UUID userId, String trimmedName, Integer colorIndex) {
        var insert = dsl.insertInto(TAGS)
                .set(TAGS.USER_ID, userId)
                .set(TAGS.NAME, trimmedName);
        if (colorIndex != null) {
            insert = insert.set(TAGS.COLOR_INDEX, colorIndex.shortValue());
        }

        return insert
                .onConflict(TAGS.USER_ID, DSL.lower(TAGS.NAME))
                .doNothing()
                .returning(TAGS.ID, TAGS.COLOR_INDEX)
                .fetchOptional(r -> new TagData(r.get(TAGS.ID), trimmedName, r.get(TAGS.COLOR_INDEX).intValue()));
    }

    Optional<UUID> findIdByUserIdAndNormalizedName(UUID userId, String trimmedName) {
        return dsl.select(TAGS.ID)
                .from(TAGS)
                .where(TAGS.USER_ID.eq(userId))
                .and(DSL.lower(TAGS.NAME).eq(trimmedName.toLowerCase(Locale.ROOT)))
                .fetchOptional(TAGS.ID);
    }

    UUID upsertByName(UUID userId, String rawName) {
        String trimmed = rawName.trim();
        return insertIfAbsent(userId, trimmed, null)
                .map(TagData::id)
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
        var otherTags = TAGS.as("other");

        var updated = dsl.update(TAGS)
                .set(TAGS.NAME, trimmedName)
                .where(TAGS.ID.eq(tagId))
                .and(TAGS.USER_ID.eq(userId))
                .and(DSL.notExists(
                        dsl.selectOne().from(otherTags)
                                .where(otherTags.USER_ID.eq(userId))
                                .and(DSL.lower(otherTags.NAME).eq(trimmedName.toLowerCase(Locale.ROOT)))
                                .and(otherTags.ID.ne(tagId))
                ))
                .returning(TAGS.COLOR_INDEX)
                .fetch();

        if (!updated.isEmpty()) {
            return new RenameResult(RenameOutcome.RENAMED, updated.get(0).get(TAGS.COLOR_INDEX).intValue());
        }

        boolean ownedByUser = dsl.fetchExists(
                dsl.selectFrom(TAGS).where(TAGS.ID.eq(tagId)).and(TAGS.USER_ID.eq(userId)));
        return new RenameResult(ownedByUser ? RenameOutcome.NAME_TAKEN : RenameOutcome.NOT_FOUND, null);
    }

    // The cascade on quote_selection_tags.tag_id (ON DELETE CASCADE, V5) handles detaching this
    // tag from every quote — no application-level cleanup needed here.
    boolean deleteForOwner(UUID userId, UUID tagId) {
        int affected = dsl.deleteFrom(TAGS)
                .where(TAGS.ID.eq(tagId))
                .and(TAGS.USER_ID.eq(userId))
                .execute();
        return affected > 0;
    }
}
