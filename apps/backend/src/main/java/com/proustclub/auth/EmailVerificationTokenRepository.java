package com.proustclub.auth;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
class EmailVerificationTokenRepository {

    private final DSLContext dsl;

    EmailVerificationTokenRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    void insert(UUID userId, String tokenHash, Instant expiresAt) {
        dsl.insertInto(DSL.table("email_verification_tokens"))
                .set(DSL.field("user_id", UUID.class), userId)
                .set(DSL.field("token_hash", String.class), tokenHash)
                .set(DSL.field("expires_at", Instant.class), expiresAt)
                .execute();
    }

    // Validate-and-burn in a single statement — same reasoning as
    // PasswordResetTokenRepository.consumeValidToken().
    Optional<EmailVerificationToken> consumeValidToken(String tokenHash) {
        var idField = DSL.field("id", Long.class);
        var userIdField = DSL.field("user_id", UUID.class);

        return dsl.update(DSL.table("email_verification_tokens"))
                .set(DSL.field("used_at", Instant.class), Instant.now())
                .where(DSL.field("token_hash", String.class).eq(tokenHash))
                .and(DSL.field("used_at", Instant.class).isNull())
                .and(DSL.field("expires_at", Instant.class).gt(Instant.now()))
                .returning(idField, userIdField)
                .fetchOptional(r -> new EmailVerificationToken(r.get(idField), r.get(userIdField)));
    }
}
