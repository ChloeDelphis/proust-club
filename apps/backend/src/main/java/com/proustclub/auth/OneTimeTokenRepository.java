package com.proustclub.auth;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

// Shared query shape for every one-time, hashed, single-use, expiring token tied to a user and
// delivered by email (password reset, email confirmation). Each flow keeps its own physical
// table — a bug in one flow's queries still can't touch the other flow's rows — but the queries
// themselves are identical, so they live here once, parameterized by table name.
@Repository
class OneTimeTokenRepository {

    private final DSLContext dsl;

    OneTimeTokenRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    // Upsert rather than a plain insert: a partial unique index (see migration V10) allows at
    // most one row per user with used_at IS NULL, so a still-live token from an earlier request
    // is the ON CONFLICT target and gets overwritten in place instead of inserted alongside it.
    // This is what actually guarantees "a user never has more than one live token at once" —
    // doing it as two separate statements (invalidate, then insert) left a race window between
    // concurrent requests where both could see no live token yet and both insert one.
    void insert(String table, UUID userId, String tokenHash, Instant expiresAt) {
        var userIdField = DSL.field("user_id", UUID.class);
        var tokenHashField = DSL.field("token_hash", String.class);
        var expiresAtField = DSL.field("expires_at", Instant.class);
        var usedAtField = DSL.field("used_at", Instant.class);

        dsl.insertInto(DSL.table(table))
                .set(userIdField, userId)
                .set(tokenHashField, tokenHash)
                .set(expiresAtField, expiresAt)
                .onConflict(userIdField)
                .where(usedAtField.isNull())
                .doUpdate()
                .set(tokenHashField, tokenHash)
                .set(expiresAtField, expiresAt)
                .execute();
    }

    // Validate-and-burn in a single statement rather than a SELECT followed by an UPDATE — one
    // DB round trip instead of two, and closes the race window a separate check-then-set would
    // leave open between two concurrent confirm attempts presenting the same token: whichever
    // UPDATE lands first is the only one that can ever match a still-unused, unexpired row.
    Optional<OneTimeToken> consumeValidToken(String table, String tokenHash) {
        var idField = DSL.field("id", Long.class);
        var userIdField = DSL.field("user_id", UUID.class);

        return dsl.update(DSL.table(table))
                .set(DSL.field("used_at", Instant.class), Instant.now())
                .where(DSL.field("token_hash", String.class).eq(tokenHash))
                .and(DSL.field("used_at", Instant.class).isNull())
                .and(DSL.field("expires_at", Instant.class).gt(Instant.now()))
                .returning(idField, userIdField)
                .fetchOptional(r -> new OneTimeToken(r.get(idField), r.get(userIdField)));
    }
}
