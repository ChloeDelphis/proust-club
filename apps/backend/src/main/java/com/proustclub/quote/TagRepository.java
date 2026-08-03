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
}
