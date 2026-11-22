package com.proustclub.admin;

import com.proustclub.admin.dashboard.AdminDailyMetric;
import com.proustclub.admin.notifications.AdminNotificationPreferences;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static com.proustclub.jooq.admin.Tables.*;
import static com.proustclub.jooq.identity.Tables.*;
import static com.proustclub.jooq.library.Tables.*;
import static org.jooq.impl.DSL.currentOffsetDateTime;

@Repository
public class AdminDataRepository {

    public record AdminNotificationClaim(UUID id, String eventType, OffsetDateTime createdAt, int attempts) {}

    private final DSLContext dsl;

    public AdminDataRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public long registeredUserCount() {
        return dsl.fetchCount(USERS, USERS.ROLE.eq("USER"));
    }

    public long quoteCount() {
        return dsl.selectCount().from(QUOTE_SELECTIONS)
                .join(USERS).on(USERS.UUID.eq(QUOTE_SELECTIONS.USER_ID))
                .where(USERS.ROLE.eq("USER")).fetchOne(0, long.class);
    }

    public long tagCount() {
        return dsl.selectCount().from(TAGS)
                .join(USERS).on(USERS.UUID.eq(TAGS.USER_ID))
                .where(USERS.ROLE.eq("USER")).fetchOne(0, long.class);
    }

    public java.util.List<AdminDailyMetric> recentMetrics(LocalDate since) {
        return dsl.select(ADMIN_DAILY_METRICS.METRIC_DATE, ADMIN_DAILY_METRICS.REGISTRATIONS,
                        ADMIN_DAILY_METRICS.ACCOUNT_DELETIONS)
                .from(ADMIN_DAILY_METRICS)
                .where(ADMIN_DAILY_METRICS.METRIC_DATE.ge(since))
                .orderBy(ADMIN_DAILY_METRICS.METRIC_DATE.asc())
                .fetch(r -> new AdminDailyMetric(
                        r.get(ADMIN_DAILY_METRICS.METRIC_DATE),
                        r.get(ADMIN_DAILY_METRICS.REGISTRATIONS),
                        r.get(ADMIN_DAILY_METRICS.ACCOUNT_DELETIONS)));
    }

    public AdminNotificationPreferences notificationPreferences() {
        var row = dsl.selectFrom(ADMIN_NOTIFICATION_SETTINGS)
                .where(ADMIN_NOTIFICATION_SETTINGS.ID.eq((short) 1)).fetchOne();
        if (row == null) return new AdminNotificationPreferences(true, true);
        return new AdminNotificationPreferences(row.getRegistrationsEnabled(), row.getDeletionsEnabled());
    }

    public void updateNotificationPreferences(boolean registrations, boolean deletions) {
        dsl.insertInto(ADMIN_NOTIFICATION_SETTINGS)
                .set(ADMIN_NOTIFICATION_SETTINGS.ID, (short) 1)
                .set(ADMIN_NOTIFICATION_SETTINGS.REGISTRATIONS_ENABLED, registrations)
                .set(ADMIN_NOTIFICATION_SETTINGS.DELETIONS_ENABLED, deletions)
                .onConflict(ADMIN_NOTIFICATION_SETTINGS.ID)
                .doUpdate()
                .set(ADMIN_NOTIFICATION_SETTINGS.REGISTRATIONS_ENABLED, registrations)
                .set(ADMIN_NOTIFICATION_SETTINGS.DELETIONS_ENABLED, deletions)
                .set(ADMIN_NOTIFICATION_SETTINGS.UPDATED_AT, currentOffsetDateTime())
                .execute();
        if (!registrations) suppressPendingNotifications("REGISTRATION");
        if (!deletions) suppressPendingNotifications("ACCOUNT_DELETION");
    }

    private void suppressPendingNotifications(String eventType) {
        dsl.update(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.SENT_AT, OffsetDateTime.now())
                .setNull(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL)
                .where(ADMIN_NOTIFICATION_OUTBOX.EVENT_TYPE.eq(eventType)
                        .and(ADMIN_NOTIFICATION_OUTBOX.SENT_AT.isNull()))
                .execute();
    }

    public void recordRegistration() {
        dsl.insertInto(ADMIN_DAILY_METRICS)
                .set(ADMIN_DAILY_METRICS.METRIC_DATE, LocalDate.now(ZoneOffset.UTC))
                .set(ADMIN_DAILY_METRICS.REGISTRATIONS, 1)
                .onConflict(ADMIN_DAILY_METRICS.METRIC_DATE)
                .doUpdate().set(ADMIN_DAILY_METRICS.REGISTRATIONS, ADMIN_DAILY_METRICS.REGISTRATIONS.plus(1))
                .execute();
        if (notificationPreferences().registrationsEnabled()) enqueueNotification("REGISTRATION");
    }

    public void recordDeletion(UUID userId) {
        boolean ordinaryUser = dsl.fetchExists(USERS, USERS.UUID.eq(userId).and(USERS.ROLE.eq("USER")));
        if (!ordinaryUser) return;
        dsl.insertInto(ADMIN_DAILY_METRICS)
                .set(ADMIN_DAILY_METRICS.METRIC_DATE, LocalDate.now(ZoneOffset.UTC))
                .set(ADMIN_DAILY_METRICS.ACCOUNT_DELETIONS, 1)
                .onConflict(ADMIN_DAILY_METRICS.METRIC_DATE)
                .doUpdate().set(ADMIN_DAILY_METRICS.ACCOUNT_DELETIONS, ADMIN_DAILY_METRICS.ACCOUNT_DELETIONS.plus(1))
                .execute();
        if (notificationPreferences().deletionsEnabled()) enqueueNotification("ACCOUNT_DELETION");
    }

    private void enqueueNotification(String type) {
        dsl.insertInto(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.EVENT_TYPE, type)
                .execute();
    }

    public java.util.Optional<UUID> userToProvision(String email) {
        return dsl.select(USERS.UUID).from(USERS)
                .where(USERS.EMAIL.eq(email).and(USERS.EMAIL_VERIFIED).and(USERS.ROLE.eq("USER")))
                .fetchOptional(USERS.UUID);
    }

    public boolean hasAdmin() {
        return dsl.fetchExists(USERS, USERS.ROLE.eq("ADMIN"));
    }

    public void promoteAndProvision(UUID userId, byte[] encryptedSecret, java.util.List<String> recoveryHashes) {
        dsl.update(USERS).set(USERS.ROLE, "ADMIN")
                .where(USERS.UUID.eq(userId).and(USERS.ROLE.eq("USER")).and(USERS.EMAIL_VERIFIED))
                .execute();
        dsl.insertInto(ADMIN_MFA_CREDENTIALS)
                .set(ADMIN_MFA_CREDENTIALS.USER_ID, userId)
                .set(ADMIN_MFA_CREDENTIALS.SECRET_CIPHERTEXT, encryptedSecret)
                .execute();
        recoveryHashes.forEach(hash -> dsl.insertInto(ADMIN_MFA_RECOVERY_CODES)
                .set(ADMIN_MFA_RECOVERY_CODES.USER_ID, userId)
                .set(ADMIN_MFA_RECOVERY_CODES.CODE_HASH, hash)
                .execute());
        updateNotificationPreferences(true, true);
    }

    public java.util.Optional<UUID> adminToReset(String email) {
        return dsl.select(USERS.UUID).from(USERS)
                .where(USERS.EMAIL.eq(email).and(USERS.EMAIL_VERIFIED).and(USERS.ROLE.eq("ADMIN")))
                .fetchOptional(USERS.UUID);
    }

    public void replaceMfa(UUID userId, byte[] encryptedSecret, java.util.List<String> recoveryHashes) {
        int updated = dsl.update(ADMIN_MFA_CREDENTIALS)
                .set(ADMIN_MFA_CREDENTIALS.SECRET_CIPHERTEXT, encryptedSecret)
                .setNull(ADMIN_MFA_CREDENTIALS.LAST_TOTP_COUNTER)
                .where(ADMIN_MFA_CREDENTIALS.USER_ID.eq(userId)).execute();
        if (updated != 1) throw new IllegalStateException("Admin MFA credential is missing; refusing to reset.");
        dsl.deleteFrom(ADMIN_MFA_RECOVERY_CODES).where(ADMIN_MFA_RECOVERY_CODES.USER_ID.eq(userId)).execute();
        recoveryHashes.forEach(hash -> dsl.insertInto(ADMIN_MFA_RECOVERY_CODES)
                .set(ADMIN_MFA_RECOVERY_CODES.USER_ID, userId)
                .set(ADMIN_MFA_RECOVERY_CODES.CODE_HASH, hash).execute());
    }

    public java.util.Optional<byte[]> encryptedSecret(UUID userId) {
        return dsl.select(ADMIN_MFA_CREDENTIALS.SECRET_CIPHERTEXT)
                .from(ADMIN_MFA_CREDENTIALS)
                .where(ADMIN_MFA_CREDENTIALS.USER_ID.eq(userId))
                .fetchOptional(ADMIN_MFA_CREDENTIALS.SECRET_CIPHERTEXT);
    }

    public boolean consumeRecoveryCode(UUID userId, String hash) {
        return dsl.update(ADMIN_MFA_RECOVERY_CODES)
                .set(ADMIN_MFA_RECOVERY_CODES.USED_AT, currentOffsetDateTime())
                .where(ADMIN_MFA_RECOVERY_CODES.USER_ID.eq(userId)
                        .and(ADMIN_MFA_RECOVERY_CODES.CODE_HASH.eq(hash))
                        .and(ADMIN_MFA_RECOVERY_CODES.USED_AT.isNull()))
                .execute() == 1;
    }

    public boolean claimTotpCounter(UUID userId, long counter) {
        return dsl.update(ADMIN_MFA_CREDENTIALS)
                .set(ADMIN_MFA_CREDENTIALS.LAST_TOTP_COUNTER, counter)
                .where(ADMIN_MFA_CREDENTIALS.USER_ID.eq(userId)
                        .and(ADMIN_MFA_CREDENTIALS.LAST_TOTP_COUNTER.isNull()
                                .or(ADMIN_MFA_CREDENTIALS.LAST_TOTP_COUNTER.lt(counter))))
                .execute() == 1;
    }

    public java.util.Optional<String> adminEmail() {
        return dsl.select(USERS.EMAIL).from(USERS).where(USERS.ROLE.eq("ADMIN")).orderBy(USERS.CREATED_AT.asc())
                .limit(1).fetchOptional(USERS.EMAIL);
    }

    @Transactional
    public java.util.Optional<AdminNotificationClaim> claimNotification() {
        var now = OffsetDateTime.now();
        var row = dsl.selectFrom(ADMIN_NOTIFICATION_OUTBOX)
                .where(ADMIN_NOTIFICATION_OUTBOX.SENT_AT.isNull()
                        .and(ADMIN_NOTIFICATION_OUTBOX.NEXT_ATTEMPT_AT.le(now))
                        .and(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL.isNull()
                                .or(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL.lt(now))))
                .orderBy(ADMIN_NOTIFICATION_OUTBOX.CREATED_AT.asc())
                .limit(1).forUpdate().skipLocked().fetchOne();
        if (row == null) return java.util.Optional.empty();
        dsl.update(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL, now.plusMinutes(3))
                .set(ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS, ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS.plus(1))
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(row.getId())).execute();
        return java.util.Optional.of(new AdminNotificationClaim(
                row.getId(), row.getEventType(), row.getCreatedAt(), row.getAttempts() + 1));
    }

    public void markNotificationSent(UUID id) {
        dsl.update(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.SENT_AT, OffsetDateTime.now())
                .setNull(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL)
                .setNull(ADMIN_NOTIFICATION_OUTBOX.LAST_ERROR_TYPE)
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(id)).execute();
    }

    public void scheduleNotificationRetry(AdminNotificationClaim claim, String errorType) {
        long delayMinutes = Math.min(60, 1L << Math.min(6, claim.attempts()));
        dsl.update(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.NEXT_ATTEMPT_AT, OffsetDateTime.now().plusMinutes(delayMinutes))
                .setNull(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL)
                .set(ADMIN_NOTIFICATION_OUTBOX.LAST_ERROR_TYPE, errorType)
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(claim.id())).execute();
    }

    @Transactional
    public int purgeCompletedNotificationsBefore(OffsetDateTime completedBefore, int batchSize) {
        var expiredIds = dsl.select(ADMIN_NOTIFICATION_OUTBOX.ID)
                .from(ADMIN_NOTIFICATION_OUTBOX)
                // Uniquement les événements terminés (envoyés ou neutralisés). Les états
                // en attente, en reprise ou à examiner conservent sent_at à NULL.
                .where(ADMIN_NOTIFICATION_OUTBOX.SENT_AT.isNotNull()
                        .and(ADMIN_NOTIFICATION_OUTBOX.SENT_AT.lt(completedBefore)))
                .orderBy(ADMIN_NOTIFICATION_OUTBOX.SENT_AT.asc())
                .limit(batchSize)
                .forUpdate()
                .skipLocked();
        return dsl.deleteFrom(ADMIN_NOTIFICATION_OUTBOX)
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.in(expiredIds))
                .execute();
    }
}
