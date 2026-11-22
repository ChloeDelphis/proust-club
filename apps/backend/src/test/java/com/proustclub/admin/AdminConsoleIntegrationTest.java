package com.proustclub.admin;

import com.proustclub.admin.auth.AdminMfaService;
import com.proustclub.admin.notifications.AdminNotificationPreferences;
import com.proustclub.admin.notifications.AdminNotificationRetentionJob;
import com.proustclub.admin.notifications.AdminNotificationWorker;
import com.proustclub.admin.provisioning.AdminProvisioningService;
import com.proustclub.TestcontainersConfiguration;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import dev.samstevens.totp.code.DefaultCodeGenerator;

import static com.proustclub.jooq.admin.Tables.*;
import static com.proustclub.jooq.identity.Tables.*;
import static com.proustclub.jooq.library.Tables.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.admin.mfa-encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
class AdminConsoleIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired DSLContext dsl;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired AdminDataRepository repository;
    @Autowired AdminNotificationRetentionJob notificationRetentionJob;
    @Autowired AdminMfaService mfaService;
    @Autowired AdminProvisioningService provisioningService;
    @org.springframework.test.context.bean.override.mockito.MockitoBean AdminNotificationWorker notificationWorker;

    @BeforeEach
    void cleanAdminState() {
        dsl.deleteFrom(ADMIN_NOTIFICATION_OUTBOX).execute();
        dsl.deleteFrom(ADMIN_DAILY_METRICS).execute();
        dsl.deleteFrom(ADMIN_NOTIFICATION_SETTINGS).execute();
        dsl.deleteFrom(USERS).execute();
    }

    @Test
    void onlyAdminRoleCanReadDashboardAndPreferencesPersist() throws Exception {
        var userId = insertUser("person@example.com", "USER", "user-password");
        var adminId = insertUser("admin@example.com", "ADMIN", "admin-password");
        dsl.insertInto(TAGS).set(TAGS.ID, UUID.randomUUID()).set(TAGS.USER_ID, userId)
                .set(TAGS.NAME, "Combray").set(TAGS.COLOR_INDEX, (short) 0).execute();
        repository.recordRegistration();
        repository.recordDeletion(userId);
        repository.recordDeletion(adminId);

        mockMvc.perform(get("/api/admin/dashboard"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/dashboard").with(user("person@example.com").roles("USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/dashboard").with(user("admin@example.com").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registeredUsers").value(1))
                .andExpect(jsonPath("$.savedQuotes").value(0))
                .andExpect(jsonPath("$.tags").value(1))
                .andExpect(jsonPath("$.dailyMetrics[0].registrations").value(1))
                .andExpect(jsonPath("$.dailyMetrics[0].deletions").value(1));

        mockMvc.perform(patch("/api/admin/notifications").with(user("admin@example.com").roles("ADMIN")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"registrationsEnabled\":false,\"deletionsEnabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationsEnabled").value(false))
                .andExpect(jsonPath("$.deletionsEnabled").value(true));
        assertThat(repository.notificationPreferences()).isEqualTo(new AdminNotificationPreferences(false, true));

        repository.recordRegistration();
        assertThat(dsl.fetchCount(ADMIN_NOTIFICATION_OUTBOX, ADMIN_NOTIFICATION_OUTBOX.SENT_AT.isNull())).isEqualTo(1);
        assertThat(dsl.select(ADMIN_DAILY_METRICS.REGISTRATIONS).from(ADMIN_DAILY_METRICS)
                .where(ADMIN_DAILY_METRICS.METRIC_DATE.eq(LocalDate.now(ZoneOffset.UTC)))
                .fetchOne(ADMIN_DAILY_METRICS.REGISTRATIONS)).isEqualTo(2);

        var claim = repository.claimNotification().orElseThrow();
        repository.scheduleNotificationRetry(claim, "TestMailFailure");
        assertThat(repository.claimNotification()).isEmpty();
        assertThat(dsl.select(ADMIN_NOTIFICATION_OUTBOX.LAST_ERROR_TYPE).from(ADMIN_NOTIFICATION_OUTBOX)
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(claim.id())).fetchOne(0, String.class)).isEqualTo("TestMailFailure");
    }

    @Test
    void concurrentWorkersCannotClaimTheSameNotification() throws Exception {
        var eventId = dsl.insertInto(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.EVENT_TYPE, "REGISTRATION")
                .returningResult(ADMIN_NOTIFICATION_OUTBOX.ID)
                .fetchOne(ADMIN_NOTIFICATION_OUTBOX.ID);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);

        try (var workers = Executors.newFixedThreadPool(2)) {
            var first = workers.submit(() -> claimWhenReleased(ready, start));
            var second = workers.submit(() -> claimWhenReleased(ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var firstClaim = first.get(5, TimeUnit.SECONDS);
            var secondClaim = second.get(5, TimeUnit.SECONDS);

            assertThat(java.util.stream.Stream.of(firstClaim, secondClaim)
                    .filter(java.util.Optional::isPresent).count()).isEqualTo(1);
            assertThat(java.util.stream.Stream.of(firstClaim, secondClaim)
                    .flatMap(java.util.Optional::stream)
                    .map(AdminDataRepository.AdminNotificationClaim::id))
                    .containsExactly(eventId);
            assertThat(dsl.select(ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS)
                    .from(ADMIN_NOTIFICATION_OUTBOX)
                    .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(eventId))
                    .fetchOne(ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS)).isEqualTo(1);
        }
    }

    @Test
    void expiredNotificationLeaseCanBeClaimedAgain() {
        var eventId = UUID.randomUUID();
        dsl.insertInto(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.ID, eventId)
                .set(ADMIN_NOTIFICATION_OUTBOX.EVENT_TYPE, "REGISTRATION")
                .set(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL, OffsetDateTime.now().minusMinutes(1))
                .set(ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS, 1)
                .execute();

        var claim = repository.claimNotification().orElseThrow();

        assertThat(claim.id()).isEqualTo(eventId);
        assertThat(claim.attempts()).isEqualTo(2);
        assertThat(dsl.select(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL)
                .from(ADMIN_NOTIFICATION_OUTBOX)
                .where(ADMIN_NOTIFICATION_OUTBOX.ID.eq(eventId))
                .fetchOne(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL)).isAfter(OffsetDateTime.now());
    }

    @Test
    void retentionPurgesOnlyCompletedNotificationsOlderThanThirtyDays() {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var expiredSent = insertNotification(now.minusDays(60), now.minusDays(31), now.minusDays(40), null, 1, null);
        var expiredSuppressed = insertNotification(now.minusDays(60), now.minusDays(32), now.minusDays(40), null, 1, "PreviousFailure");
        var recentlyCompleted = insertNotification(now.minusDays(60), now.minusDays(29), now.minusDays(40), null, 1, null);
        var pending = insertNotification(now.minusDays(60), null, now.minusDays(40), null, 0, null);
        var retrying = insertNotification(now.minusDays(60), null, now.minusDays(31), null, 3, "MailSendException");
        var unresolved = insertNotification(now.minusDays(60), null, now.minusDays(31), null, 8, "PermanentDeliveryFailure");

        notificationRetentionJob.purgeExpiredNotifications();

        assertThat(notificationExists(expiredSent)).isFalse();
        assertThat(notificationExists(expiredSuppressed)).isFalse();
        assertThat(notificationExists(recentlyCompleted)).isTrue();
        assertThat(notificationExists(pending)).isTrue();
        assertThat(notificationExists(retrying)).isTrue();
        assertThat(notificationExists(unresolved)).isTrue();

        notificationRetentionJob.purgeExpiredNotifications();

        assertThat(notificationExists(expiredSent)).isFalse();
        assertThat(notificationExists(pending)).isTrue();
        assertThat(notificationExists(retrying)).isTrue();
        assertThat(notificationExists(unresolved)).isTrue();
    }

    private java.util.Optional<AdminDataRepository.AdminNotificationClaim> claimWhenReleased(
            CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent claim test timed out");
        return repository.claimNotification();
    }

    private UUID insertNotification(OffsetDateTime createdAt, OffsetDateTime sentAt,
                                    OffsetDateTime nextAttemptAt, OffsetDateTime claimedUntil,
                                    int attempts, String lastErrorType) {
        var id = UUID.randomUUID();
        var insert = dsl.insertInto(ADMIN_NOTIFICATION_OUTBOX)
                .set(ADMIN_NOTIFICATION_OUTBOX.ID, id)
                .set(ADMIN_NOTIFICATION_OUTBOX.EVENT_TYPE, "REGISTRATION")
                .set(ADMIN_NOTIFICATION_OUTBOX.CREATED_AT, createdAt)
                .set(ADMIN_NOTIFICATION_OUTBOX.NEXT_ATTEMPT_AT, nextAttemptAt)
                .set(ADMIN_NOTIFICATION_OUTBOX.ATTEMPTS, attempts);
        if (sentAt != null) insert.set(ADMIN_NOTIFICATION_OUTBOX.SENT_AT, sentAt);
        if (claimedUntil != null) insert.set(ADMIN_NOTIFICATION_OUTBOX.CLAIMED_UNTIL, claimedUntil);
        if (lastErrorType != null) insert.set(ADMIN_NOTIFICATION_OUTBOX.LAST_ERROR_TYPE, lastErrorType);
        insert.execute();
        return id;
    }

    private boolean notificationExists(UUID id) {
        return dsl.fetchExists(ADMIN_NOTIFICATION_OUTBOX, ADMIN_NOTIFICATION_OUTBOX.ID.eq(id));
    }

    @Test
    void provisionsFirstVerifiedAccountAndCanReplaceItsMfaCredential() {
        var userId = insertUser("first-admin@example.com", "USER", "admin-password");

        var setup = provisioningService.provision(" FIRST-ADMIN@EXAMPLE.COM ");

        assertThat(setup.email()).isEqualTo("first-admin@example.com");
        assertThat(setup.provisioningUri()).startsWith("otpauth://totp/");
        assertThat(setup.recoveryCodes()).hasSize(10);
        assertThat(dsl.select(USERS.ROLE).from(USERS).where(USERS.UUID.eq(userId)).fetchOne(0, String.class)).isEqualTo("ADMIN");
        assertThat(repository.notificationPreferences()).isEqualTo(new AdminNotificationPreferences(true, true));
        var originalCipherText = repository.encryptedSecret(userId).orElseThrow();
        var originalRecoveryCode = setup.recoveryCodes().getFirst();
        assertThat(mfaService.verifyAndConsume(userId, originalRecoveryCode)).isTrue();
        assertThat(mfaService.verifyAndConsume(userId, originalRecoveryCode)).isFalse();

        var reset = provisioningService.resetMfa("first-admin@example.com");

        assertThat(reset.recoveryCodes()).hasSize(10);
        assertThat(repository.encryptedSecret(userId).orElseThrow()).isNotEqualTo(originalCipherText);
        assertThat(repository.adminEmail()).contains("first-admin@example.com");
        assertThatThrownByProvisioningAgain();
    }

    @Test
    void adminLoginRequiresTotpAndOrdinaryLoginDoesNotCreateAdminSession() throws Exception {
        var userId = insertUser("mfa-admin@example.com", "ADMIN", "admin-password");
        var secret = mfaService.generateSecret();
        dsl.insertInto(ADMIN_MFA_CREDENTIALS).set(ADMIN_MFA_CREDENTIALS.USER_ID, userId)
                .set(ADMIN_MFA_CREDENTIALS.SECRET_CIPHERTEXT, mfaService.encrypt(secret)).execute();
        var code = new DefaultCodeGenerator().generate(secret, System.currentTimeMillis() / 30_000);

        String invalidCode = code.equals("000000") ? "000001" : "000000";
        mockMvc.perform(post("/api/admin/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"mfa-admin@example.com\",\"password\":\"admin-password\",\"code\":\"" + invalidCode + "\"}"))
                .andExpect(status().isUnauthorized());
        var login = mockMvc.perform(post("/api/admin/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"mfa-admin@example.com\",\"password\":\"admin-password\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN")).andReturn();
        var session = (MockHttpSession) login.getRequest().getSession(false);

        mockMvc.perform(get("/api/admin/dashboard").session(session)).andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"mfa-admin@example.com\",\"password\":\"admin-password\"}"))
                .andExpect(status().isUnauthorized());
    }

    private UUID insertUser(String email, String role, String password) {
        var userId = UUID.randomUUID();
        dsl.insertInto(USERS).set(USERS.UUID, userId).set(USERS.EMAIL, email)
                .set(USERS.PASSWORD_HASH, passwordEncoder.encode(password))
                .set(USERS.ROLE, role).set(USERS.EMAIL_VERIFIED, true).execute();
        return userId;
    }

    private void assertThatThrownByProvisioningAgain() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> provisioningService.provision("first-admin@example.com"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("first-admin-only");
    }
}
