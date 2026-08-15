package com.proustclub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
import com.proustclub.auth.dto.LoginRequest;
import com.proustclub.auth.dto.RegisterRequest;
import com.proustclub.mail.MailService;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class PasswordResetControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @MockitoBean
    MailService mailService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        // Cascades to password_reset_tokens (ON DELETE CASCADE, see V8 migration).
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    @Test
    void requestResetSendsEmailForKnownAccount() throws Exception {
        register("marcel", "marcel@example.com", "hunter2222password");

        mockMvc.perform(requestReset("marcel@example.com"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").exists());

        verify(mailService).sendPasswordResetEmail(eq("marcel@example.com"), anyString());
    }

    // Anti-enumeration: the exact same response, whether or not the email matches an account.
    @Test
    void requestResetReturnsIdenticalResponseForUnknownAccount() throws Exception {
        register("identicalresponse", "identicalresponse@example.com", "hunter2222password");

        MvcResult known = mockMvc.perform(requestReset("identicalresponse@example.com"))
                .andExpect(status().isAccepted())
                .andReturn();

        MvcResult unknown = mockMvc.perform(requestReset("ghost-account@example.com"))
                .andExpect(status().isAccepted())
                .andReturn();

        assertThat(known.getResponse().getContentAsString())
                .isEqualTo(unknown.getResponse().getContentAsString());
        verify(mailService).sendPasswordResetEmail(eq("identicalresponse@example.com"), anyString());
        verify(mailService, never()).sendPasswordResetEmail(eq("ghost-account@example.com"), anyString());
    }

    @Test
    void requestResetInvalidEmailReturnsBadRequest() throws Exception {
        mockMvc.perform(requestReset("not-an-email"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmResetChangesPasswordAndOpensSession() throws Exception {
        register("confirmreset", "confirmreset@example.com", "old-password-long-enough");
        mockMvc.perform(requestReset("confirmreset@example.com")).andExpect(status().isAccepted());

        mockMvc.perform(confirmReset(capturedToken("confirmreset@example.com"), "new-password-long-enough"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("confirmreset"));

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("confirmreset", "new-password-long-enough")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("confirmreset", "old-password-long-enough")))
                .andExpect(status().isUnauthorized());
    }

    // Exercises the actual DB mechanism (upsert on the partial unique index from migration V10),
    // not just the observable request/response behavior — a second request must overwrite the
    // still-live token from the first rather than leave two rows behind.
    @Test
    void requestingResetTwiceLeavesExactlyOneLiveTokenAndInvalidatesTheFirst() throws Exception {
        register("tworequests", "tworequests@example.com", "old-password-long-enough");

        mockMvc.perform(requestReset("tworequests@example.com")).andExpect(status().isAccepted());
        mockMvc.perform(requestReset("tworequests@example.com")).andExpect(status().isAccepted());

        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService, times(2)).sendPasswordResetEmail(eq("tworequests@example.com"), tokenCaptor.capture());
        var firstToken = tokenCaptor.getAllValues().get(0);
        var secondToken = tokenCaptor.getAllValues().get(1);

        var liveTokenCount = dsl.selectCount()
                .from(DSL.table("password_reset_tokens"))
                .where(DSL.field("used_at", Instant.class).isNull())
                .fetchOne(0, int.class);
        assertThat(liveTokenCount).isEqualTo(1);

        mockMvc.perform(confirmReset(firstToken, "new-password-long-enough")).andExpect(status().isBadRequest());
        mockMvc.perform(confirmReset(secondToken, "new-password-long-enough")).andExpect(status().isOk());
    }

    @Test
    void confirmResetWithUnknownTokenReturnsBadRequest() throws Exception {
        mockMvc.perform(confirmReset("garbage-token-that-was-never-issued", "new-password-long-enough"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmResetWithAlreadyUsedTokenReturnsBadRequest() throws Exception {
        register("usedtoken", "usedtoken@example.com", "old-password-long-enough");
        mockMvc.perform(requestReset("usedtoken@example.com")).andExpect(status().isAccepted());
        var token = capturedToken("usedtoken@example.com");

        mockMvc.perform(confirmReset(token, "new-password-long-enough")).andExpect(status().isOk());

        mockMvc.perform(confirmReset(token, "yet-another-password-long-enough"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmResetWithExpiredTokenReturnsBadRequest() throws Exception {
        register("expiredtoken", "expiredtoken@example.com", "old-password-long-enough");
        mockMvc.perform(requestReset("expiredtoken@example.com")).andExpect(status().isAccepted());
        var token = capturedToken("expiredtoken@example.com");

        dsl.update(DSL.table("password_reset_tokens"))
                .set(DSL.field("expires_at", Instant.class), Instant.now().minusSeconds(60))
                .execute();

        mockMvc.perform(confirmReset(token, "new-password-long-enough"))
                .andExpect(status().isBadRequest());
    }

    // A password rejected by validation must not consume the token — the user gets to correct a
    // typo and resubmit the same link.
    @Test
    void confirmResetInvalidNewPasswordDoesNotBurnTheToken() throws Exception {
        register("retrytoken", "retrytoken@example.com", "old-password-long-enough");
        mockMvc.perform(requestReset("retrytoken@example.com")).andExpect(status().isAccepted());
        var token = capturedToken("retrytoken@example.com");

        mockMvc.perform(confirmReset(token, "short")).andExpect(status().isBadRequest());

        mockMvc.perform(confirmReset(token, "new-password-long-enough")).andExpect(status().isOk());
    }

    @Test
    void confirmResetInvalidatesOtherSessionsButKeepsTheNewOne() throws Exception {
        MvcResult registerResult = register("sweepsessions", "sweepsessions@example.com", "old-password-long-enough");
        MockHttpSession sessionA = (MockHttpSession) registerResult.getRequest().getSession(false);

        mockMvc.perform(requestReset("sweepsessions@example.com")).andExpect(status().isAccepted());
        var token = capturedToken("sweepsessions@example.com");

        MvcResult confirmResult = mockMvc.perform(confirmReset(token, "new-password-long-enough"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession sessionB = (MockHttpSession) confirmResult.getRequest().getSession(false);

        mockMvc.perform(get("/api/auth/me").session(sessionA))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me").session(sessionB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("sweepsessions"));
    }

    private MvcResult register(String username, String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new RegisterRequest(username, email, password));
        return mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private MockHttpServletRequestBuilder requestReset(String email) throws Exception {
        return post("/api/auth/password-reset/request").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}");
    }

    private MockHttpServletRequestBuilder confirmReset(String token, String newPassword) throws Exception {
        return post("/api/auth/password-reset/confirm").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + newPassword + "\"}");
    }

    private String capturedToken(String email) {
        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendPasswordResetEmail(eq(email), tokenCaptor.capture());
        return tokenCaptor.getValue();
    }

    private String loginJson(String username, String password) throws Exception {
        return objectMapper.writeValueAsString(new LoginRequest(username, password));
    }
}
