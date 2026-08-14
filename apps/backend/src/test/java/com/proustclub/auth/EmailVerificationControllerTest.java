package com.proustclub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class EmailVerificationControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @MockitoBean
    MailService mailService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        // Cascades to email_verification_tokens (ON DELETE CASCADE, see V9 migration).
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    @Test
    void confirmWithValidTokenMarksEmailVerified() throws Exception {
        register("confirmvalid", "confirmvalid@example.com", "hunter2222password");

        mockMvc.perform(confirm(capturedToken("confirmvalid@example.com")))
                .andExpect(status().isNoContent());

        var verified = dsl.select(DSL.field("email_verified", Boolean.class))
                .from(DSL.table("users"))
                .where(DSL.field("username", String.class).eq("confirmvalid"))
                .fetchOne(r -> r.get("email_verified", Boolean.class));
        assertThat(verified).isTrue();
    }

    @Test
    void confirmWithUnknownTokenReturnsBadRequest() throws Exception {
        mockMvc.perform(confirm("garbage-token-that-was-never-issued"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void confirmWithAlreadyUsedTokenReturnsBadRequest() throws Exception {
        register("usedtoken", "usedtoken@example.com", "hunter2222password");
        var token = capturedToken("usedtoken@example.com");

        mockMvc.perform(confirm(token)).andExpect(status().isNoContent());

        mockMvc.perform(confirm(token)).andExpect(status().isBadRequest());
    }

    @Test
    void confirmWithExpiredTokenReturnsBadRequest() throws Exception {
        register("expiredtoken", "expiredtoken@example.com", "hunter2222password");
        var token = capturedToken("expiredtoken@example.com");

        dsl.update(DSL.table("email_verification_tokens"))
                .set(DSL.field("expires_at", Instant.class), Instant.now().minusSeconds(60))
                .execute();

        mockMvc.perform(confirm(token)).andExpect(status().isBadRequest());
    }

    @Test
    void confirmDoesNotRequireAnActiveSession() throws Exception {
        register("noSessionNeeded", "nosessionneeded@example.com", "hunter2222password");

        // No .session(...) attached — confirming must work from a browser that never registered.
        mockMvc.perform(confirm(capturedToken("nosessionneeded@example.com")))
                .andExpect(status().isNoContent());
    }

    @Test
    void resendIssuesFreshTokenAndInvalidatesThePreviousOne() throws Exception {
        MvcResult registerResult = register("resendfresh", "resendfresh@example.com", "hunter2222password");
        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);
        String firstToken = capturedToken("resendfresh@example.com");

        mockMvc.perform(resend(session)).andExpect(status().isNoContent());

        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService, times(2)).sendEmailConfirmation(eq("resendfresh@example.com"), tokenCaptor.capture());
        String secondToken = tokenCaptor.getAllValues().get(1);

        mockMvc.perform(confirm(firstToken)).andExpect(status().isBadRequest());
        mockMvc.perform(confirm(secondToken)).andExpect(status().isNoContent());
    }

    @Test
    void resendWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/email/confirm/resend").with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void resendForAnAlreadyVerifiedAccountReturnsConflict() throws Exception {
        MvcResult registerResult = register("resendverified", "resendverified@example.com", "hunter2222password");
        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);
        mockMvc.perform(confirm(capturedToken("resendverified@example.com"))).andExpect(status().isNoContent());

        mockMvc.perform(resend(session)).andExpect(status().isConflict());
    }

    private MockHttpServletRequestBuilder resend(MockHttpSession session) {
        return post("/api/auth/email/confirm/resend").with(csrf()).session(session);
    }

    private MvcResult register(String username, String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new RegisterRequest(username, email, password));
        return mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private MockHttpServletRequestBuilder confirm(String token) {
        return post("/api/auth/email/confirm").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}");
    }

    private String capturedToken(String email) {
        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendEmailConfirmation(eq(email), tokenCaptor.capture());
        return tokenCaptor.getValue();
    }
}
