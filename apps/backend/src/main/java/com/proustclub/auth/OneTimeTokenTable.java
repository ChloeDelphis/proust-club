package com.proustclub.auth;

import org.jooq.Field;
import org.jooq.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

import static com.proustclub.jooq.Tables.EMAIL_VERIFICATION_TOKENS;
import static com.proustclub.jooq.Tables.PASSWORD_RESET_TOKENS;

enum OneTimeTokenTable {
    EMAIL_VERIFICATION(
            EMAIL_VERIFICATION_TOKENS,
            EMAIL_VERIFICATION_TOKENS.ID,
            EMAIL_VERIFICATION_TOKENS.USER_ID,
            EMAIL_VERIFICATION_TOKENS.TOKEN_HASH,
            EMAIL_VERIFICATION_TOKENS.EXPIRES_AT,
            EMAIL_VERIFICATION_TOKENS.USED_AT,
            EMAIL_VERIFICATION_TOKENS.CREATED_AT
    ),
    PASSWORD_RESET(
            PASSWORD_RESET_TOKENS,
            PASSWORD_RESET_TOKENS.ID,
            PASSWORD_RESET_TOKENS.USER_ID,
            PASSWORD_RESET_TOKENS.TOKEN_HASH,
            PASSWORD_RESET_TOKENS.EXPIRES_AT,
            PASSWORD_RESET_TOKENS.USED_AT,
            PASSWORD_RESET_TOKENS.CREATED_AT
    );

    final Table<?> table;
    final Field<Long> id;
    final Field<UUID> userId;
    final Field<String> tokenHash;
    final Field<OffsetDateTime> expiresAt;
    final Field<OffsetDateTime> usedAt;
    final Field<OffsetDateTime> createdAt;

    OneTimeTokenTable(
            Table<?> table,
            Field<Long> id,
            Field<UUID> userId,
            Field<String> tokenHash,
            Field<OffsetDateTime> expiresAt,
            Field<OffsetDateTime> usedAt,
            Field<OffsetDateTime> createdAt
    ) {
        this.table = table;
        this.id = id;
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
        this.createdAt = createdAt;
    }
}
