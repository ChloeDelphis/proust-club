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

    void insert(String table, UUID userId, String tokenHash, Instant expiresAt) {
        dsl.insertInto(DSL.table(table))
                .set(DSL.field("user_id", UUID.class), userId)
                .set(DSL.field("token_hash", String.class), tokenHash)
                .set(DSL.field("expires_at", Instant.class), expiresAt)
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

    // Called before issuing a fresh token so a user never has more than one live link at once —
    // avoids confusion over which email is the real one and shrinks the attack surface.
    void invalidateAllUnusedForUser(String table, UUID userId) {
        dsl.update(DSL.table(table))
                .set(DSL.field("used_at", Instant.class), Instant.now())
                .where(DSL.field("user_id", UUID.class).eq(userId))
                .and(DSL.field("used_at", Instant.class).isNull())
                .execute();
    }
}
