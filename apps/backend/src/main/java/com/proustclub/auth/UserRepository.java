package com.proustclub.auth;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
class UserRepository {

    private final DSLContext dsl;

    UserRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    boolean existsByUsername(String username) {
        return dsl.fetchExists(
                DSL.selectOne()
                        .from(DSL.table("users"))
                        .where(DSL.field("username", String.class).eq(username))
        );
    }

    boolean existsByEmail(String email) {
        return dsl.fetchExists(
                DSL.selectOne()
                        .from(DSL.table("users"))
                        .where(DSL.field("email", String.class).eq(email))
        );
    }

    UUID insert(String username, String email, String passwordHash) {
        return dsl.insertInto(DSL.table("users"),
                        DSL.field("username"), DSL.field("email"), DSL.field("password_hash"))
                .values(username, email, passwordHash)
                .returning(DSL.field("uuid", UUID.class))
                .fetchOne(r -> r.get("uuid", UUID.class));
    }

    Optional<AuthUser> findByUsername(String username) {
        return findOneWhere(DSL.field("username", String.class).eq(username));
    }

    Optional<AuthUser> findByUuid(UUID uuid) {
        return findOneWhere(DSL.field("uuid", UUID.class).eq(uuid));
    }

    Optional<AuthUser> findByEmail(String email) {
        return findOneWhere(DSL.field("email", String.class).eq(email));
    }

    private Optional<AuthUser> findOneWhere(Condition condition) {
        return dsl.select(
                        DSL.field("uuid", UUID.class),
                        DSL.field("username", String.class),
                        DSL.field("email", String.class),
                        DSL.field("password_hash", String.class),
                        DSL.field("role", String.class)
                )
                .from(DSL.table("users"))
                .where(condition)
                .fetchOptional(r -> new AuthUser(
                        r.get("uuid", UUID.class),
                        r.get("username", String.class),
                        r.get("email", String.class),
                        r.get("password_hash", String.class),
                        r.get("role", String.class)
                ));
    }

    void updatePasswordHash(UUID uuid, String passwordHash) {
        dsl.update(DSL.table("users"))
                .set(DSL.field("password_hash", String.class), passwordHash)
                .where(DSL.field("uuid", UUID.class).eq(uuid))
                .execute();
    }
}
