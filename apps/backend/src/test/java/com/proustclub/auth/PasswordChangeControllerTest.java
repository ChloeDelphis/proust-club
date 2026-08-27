package com.proustclub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
import com.proustclub.auth.dto.LoginRequest;
import com.proustclub.auth.dto.RegisterRequest;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class PasswordChangeControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    // Local @MockitoBean rather than PasswordBreachCheckerTestConfig — per-test control over
    // compromised/not-compromised is needed here, same reasoning as AuthControllerTest.
    @MockitoBean
    PasswordBreachChecker passwordBreachChecker;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void stubPasswordAsNotCompromisedByDefault() {
        when(passwordBreachChecker.isCompromised(anyString())).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    @Test
    void changePasswordUpdatesPasswordAndKeepsCurrentSessionOpen() throws Exception {
        MockHttpSession session = registerAndGetSession("changepwd", "changepwd@example.com", "old-password-long-enough");

        mockMvc.perform(changePassword(session, "old-password-long-enough", "new-password-long-enough"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("changepwd"));

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("changepwd@example.com", "new-password-long-enough")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("changepwd@example.com", "old-password-long-enough")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordWithIncorrectCurrentPasswordReturnsUnauthorized() throws Exception {
        MockHttpSession session = registerAndGetSession("wrongcurrent", "wrongcurrent@example.com", "old-password-long-enough");

        mockMvc.perform(changePassword(session, "not-the-current-password", "new-password-long-enough"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("wrongcurrent@example.com", "old-password-long-enough")))
                .andExpect(status().isOk());
    }

    @Test
    void changePasswordWithCompromisedNewPasswordReturnsUnprocessableEntity() throws Exception {
        MockHttpSession session = registerAndGetSession("compromisednew", "compromisednew@example.com", "old-password-long-enough");
        when(passwordBreachChecker.isCompromised("compromised-new-password")).thenReturn(true);

        mockMvc.perform(changePassword(session, "old-password-long-enough", "compromised-new-password"))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("compromisednew@example.com", "old-password-long-enough")))
                .andExpect(status().isOk());
    }

    // Verifies the ordering decided in phase 0: a wrong current password should never pay for the
    // HIBP round trip.
    @Test
    void changePasswordWithIncorrectCurrentPasswordNeverCallsBreachChecker() throws Exception {
        MockHttpSession session = registerAndGetSession("skipbreachcheck", "skipbreachcheck@example.com", "old-password-long-enough");
        // register() itself already called the breach checker once, on the registration password
        // — reset so this assertion is scoped to changePassword() alone.
        clearInvocations(passwordBreachChecker);

        mockMvc.perform(changePassword(session, "not-the-current-password", "new-password-long-enough"))
                .andExpect(status().isUnauthorized());

        verify(passwordBreachChecker, never()).isCompromised(anyString());
    }

    @Test
    void changePasswordWithoutSessionIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/password").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(changePasswordJson("whatever-current", "new-password-long-enough")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordWithTooShortNewPasswordReturnsBadRequest() throws Exception {
        MockHttpSession session = registerAndGetSession("shortnew", "shortnew@example.com", "old-password-long-enough");

        mockMvc.perform(changePassword(session, "old-password-long-enough", "short"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changePasswordInvalidatesOtherSessionsButKeepsTheCurrentOne() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("sweepsessions", "sweepsessions@example.com", "old-password-long-enough")))
                .andExpect(status().isCreated())
                .andReturn();
        MockHttpSession sessionA = (MockHttpSession) registerResult.getRequest().getSession(false);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("sweepsessions@example.com", "old-password-long-enough")))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession sessionB = (MockHttpSession) loginResult.getRequest().getSession(false);

        mockMvc.perform(changePassword(sessionB, "old-password-long-enough", "new-password-long-enough"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").session(sessionA))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me").session(sessionB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("sweepsessions"));
    }

    private MockHttpSession registerAndGetSession(String username, String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new RegisterRequest(username, email, password));
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpServletRequestBuilder changePassword(MockHttpSession session, String currentPassword, String newPassword) {
        return post("/api/auth/password").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                .content(changePasswordJson(currentPassword, newPassword));
    }

    private String changePasswordJson(String currentPassword, String newPassword) {
        return "{\"currentPassword\":\"" + currentPassword + "\",\"newPassword\":\"" + newPassword + "\"}";
    }

    private String registerJson(String username, String email, String password) throws Exception {
        return objectMapper.writeValueAsString(new RegisterRequest(username, email, password));
    }

    private String loginJson(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(new LoginRequest(email, password));
    }
}
