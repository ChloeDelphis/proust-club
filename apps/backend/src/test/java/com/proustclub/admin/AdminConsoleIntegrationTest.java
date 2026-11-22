package com.proustclub.admin;

import com.proustclub.admin.auth.AdminMfaService;
import com.proustclub.admin.notifications.AdminNotificationPreferences;
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
import java.time.ZoneOffset;
import java.util.UUID;

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
