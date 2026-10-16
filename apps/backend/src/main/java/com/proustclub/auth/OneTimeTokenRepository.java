package com.proustclub.auth;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    void insert(OneTimeTokenTable tokenTable, UUID userId, String tokenHash, Instant expiresAt) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        // created_at has a DEFAULT NOW() for the plain-insert path, but a DO UPDATE bypasses
        // column defaults entirely — set it explicitly so a row that gets overwritten in place
        // still reflects when its (now current) token was actually issued, not the superseded one.
        dsl.insertInto(tokenTable.table)
                .set(tokenTable.userId, userId)
                .set(tokenTable.tokenHash, tokenHash)
                .set(tokenTable.expiresAt, expiresAt.atOffset(ZoneOffset.UTC))
                .onConflict(tokenTable.userId)
                .where(tokenTable.usedAt.isNull())
                .doUpdate()
                .set(tokenTable.tokenHash, tokenHash)
                .set(tokenTable.expiresAt, expiresAt.atOffset(ZoneOffset.UTC))
                .set(tokenTable.createdAt, now)
                .execute();
    }

    // Shared by findValidTokenUserId() and consumeValidToken() below — both need to agree on exactly
    // what "still valid" means, and a definition duplicated between a SELECT and an UPDATE would
    // silently drift if it ever changed (e.g. a future revoked_at column).
    private Condition validAndUnusedCondition(OneTimeTokenTable tokenTable, String tokenHash) {
        return tokenTable.tokenHash.eq(tokenHash)
                .and(tokenTable.usedAt.isNull())
                .and(tokenTable.expiresAt.gt(OffsetDateTime.now(ZoneOffset.UTC)));
    }

    // Read-only, no side effect — deliberately not consumeValidToken(). Lets a caller decide
    // whether a subsequent expensive step (e.g. an external HTTP call) is worth paying for before
    // touching the token at all. Does not weaken consumeValidToken()'s atomicity below: the only
    // state-changing statement stays that single UPDATE, executed unconditionally after this,
    // regardless of what this peek observed — two concurrent callers can both see "valid" here
    // and still only one of them will ever win the UPDATE.
    Optional<UUID> findValidTokenUserId(OneTimeTokenTable tokenTable, String tokenHash) {
        return dsl.select(tokenTable.userId)
                .from(tokenTable.table)
                .where(validAndUnusedCondition(tokenTable, tokenHash))
                .fetchOptional(tokenTable.userId);
    }

    // Validate-and-burn in a single statement rather than a SELECT followed by an UPDATE — one
    // DB round trip instead of two, and closes the race window a separate check-then-set would
    // leave open between two concurrent confirm attempts presenting the same token: whichever
    // UPDATE lands first is the only one that can ever match a still-unused, unexpired row.
    Optional<OneTimeToken> consumeValidToken(OneTimeTokenTable tokenTable, String tokenHash) {
        return dsl.update(tokenTable.table)
                .set(tokenTable.usedAt, OffsetDateTime.now(ZoneOffset.UTC))
                .where(validAndUnusedCondition(tokenTable, tokenHash))
                .returning(tokenTable.id, tokenTable.userId)
                .fetchOptional(r -> new OneTimeToken(r.get(tokenTable.id), r.get(tokenTable.userId)));
    }
}
