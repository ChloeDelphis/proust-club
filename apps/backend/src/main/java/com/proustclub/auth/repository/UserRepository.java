package com.proustclub.auth.repository;


import com.proustclub.auth.model.AuthUser;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import static com.proustclub.jooq.Tables.USERS;

@Repository
public class UserRepository {

    private final DSLContext dsl;

    public UserRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean existsByUsername(String username) {
        return dsl.fetchExists(
                DSL.selectOne()
                        .from(USERS)
                        .where(USERS.USERNAME.eq(username))
        );
    }

    public boolean existsByEmail(String email) {
        return dsl.fetchExists(
                DSL.selectOne()
                        .from(USERS)
                        .where(USERS.EMAIL.eq(email))
        );
    }

    public Optional<UUID> insertIfAbsent(String email, String passwordHash) {
        return dsl.insertInto(USERS, USERS.EMAIL, USERS.PASSWORD_HASH)
                .values(email, passwordHash)
                .onConflictDoNothing()
                .returning(USERS.UUID)
                .fetchOptional(USERS.UUID);
    }

    public Optional<AuthUser> findByUuid(UUID uuid) {
        return findOneWhere(USERS.UUID.eq(uuid));
    }

    public Optional<AuthUser> findByEmail(String email) {
        return findOneWhere(USERS.EMAIL.eq(email));
    }

    private Optional<AuthUser> findOneWhere(Condition condition) {
        return dsl.select(
                        USERS.UUID,
                        USERS.USERNAME,
                        USERS.EMAIL,
                        USERS.PASSWORD_HASH,
                        USERS.ROLE,
                        USERS.EMAIL_VERIFIED
                )
                .from(USERS)
                .where(condition)
                .fetchOptional(r -> new AuthUser(
                        r.get(USERS.UUID),
                        r.get(USERS.USERNAME),
                        r.get(USERS.EMAIL),
                        r.get(USERS.PASSWORD_HASH),
                        r.get(USERS.ROLE),
                        r.get(USERS.EMAIL_VERIFIED)
                ));
    }

    public void markEmailVerified(UUID uuid) {
        dsl.update(USERS)
                .set(USERS.EMAIL_VERIFIED, true)
                .where(USERS.UUID.eq(uuid))
                .execute();
    }

    public void updatePasswordHash(UUID uuid, String passwordHash) {
        dsl.update(USERS)
                .set(USERS.PASSWORD_HASH, passwordHash)
                .where(USERS.UUID.eq(uuid))
                .execute();
    }

    public int deleteByUuid(UUID uuid) {
        return dsl.deleteFrom(USERS)
                .where(USERS.UUID.eq(uuid))
                .execute();
    }
}
