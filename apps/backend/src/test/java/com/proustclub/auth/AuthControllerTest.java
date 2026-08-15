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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @MockitoBean
    MailService mailService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    @Test
    void registerCreatesAccountAndOpensSession() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("marcel"))
                .andExpect(jsonPath("$.email").value("marcel@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.uuid").exists())
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void registerSendsEmailConfirmation() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("emailconfirm", "emailconfirm@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        verify(mailService).sendEmailConfirmation(eq("emailconfirm@example.com"), anyString());
    }

    // Only the status is asserted, not the ProblemDetail body — see the comment on
    // ErrorHandlingIntegrationTest.malformedJsonReturnsBadRequest for why (MockMvc limitation for
    // this resolution path, manually verified correct against the real server).
    @Test
    void registerDuplicateUsernameReturnsConflict() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "other@example.com", "hunter2222password")))
                .andExpect(status().isConflict());
    }

    @Test
    void registerDuplicateEmailReturnsConflict() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("other", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isConflict());
    }

    @Test
    void registerDuplicateEmailIsCaseInsensitive() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("other", "Marcel@Example.com", "hunter2222password")))
                .andExpect(status().isConflict());
    }

    @Test
    void registerNormalizesEmailToLowercase() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "Marcel@Example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("marcel@example.com"));
    }

    @Test
    void registerBlankUsernameReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registerInvalidEmailReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "not-an-email", "hunter2222password")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registerPasswordTooShortReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "short")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registerPasswordMatchingUsernameReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcelproustcombray", "marcel@example.com", "marcelproustcombray")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registerPasswordMatchingEmailReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcelproust@example.com", "marcelproust@example.com")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registerPasswordMatchingUsernameCaseInsensitiveReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("MarcelProustCombray", "marcel@example.com", "marcelproustcombray")))
                .andExpect(status().isBadRequest());
    }

    // Non-regression for the "strict equality, not substring" decision (private/tickets/mot-de-passe-distinct-identifiants.md):
    // a passphrase that merely contains the username must stay accepted — the project actively
    // encourages long passphrases over composed passwords (RegisterRequest.password), and a
    // "contains" check would reject legitimate ones whenever the username is a common word.
    @Test
    void registerPasswordContainingUsernameIsAccepted() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "Marcel se souvient de Combray")))
                .andExpect(status().isCreated());
    }

    @Test
    void registerWithoutCsrfTokenIsForbidden() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isForbidden());
    }

    @Test
    void registerIgnoresClientSuppliedRole() throws Exception {
        String bodyWithRole = """
                {"username":"roleinject","email":"roleinject@example.com","password":"hunter2222password","role":"ADMIN"}""";

        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithRole))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void loginWithCorrectCredentialsOpensSession() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("marcel", "hunter2222password")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("marcel"));
    }

    // Status only, not the ProblemDetail body — see registerDuplicateUsernameReturnsConflict above.
    @Test
    void loginWithWrongPasswordReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("marcel", "wrong-password")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginWithUnknownUsernameReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("ghost", "whatever1")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownUsernameAndWrongPasswordReturnIdenticalBody() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("identicalbody", "identicalbody@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        MvcResult wrongPassword = mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("identicalbody", "wrong-password-xyz")))
                .andExpect(status().isUnauthorized())
                .andReturn();

        MvcResult unknownUser = mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("ghost-user-xyz", "whatever-password")))
                .andExpect(status().isUnauthorized())
                .andReturn();

        assertThat(wrongPassword.getResponse().getContentAsString())
                .isEqualTo(unknownUser.getResponse().getContentAsString());
    }

    @Test
    void loginResponseNeverContainsPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("loginnopass", "loginnopass@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("loginnopass", "hunter2222password")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void loginWithoutCsrfTokenIsForbidden() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("csrflogin", "csrflogin@example.com", "hunter2222password")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("csrflogin", "hunter2222password")))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutWithoutCsrfTokenIsForbidden() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("csrflogout", "csrflogout@example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);

        mockMvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    void loginRotatesSessionId() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("sessionrotation", "sessionrotation@example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession sessionAfterRegister = (MockHttpSession) registerResult.getRequest().getSession(false);
        String sessionIdAfterRegister = sessionAfterRegister.getId();

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login").with(csrf()).session(sessionAfterRegister)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("sessionrotation", "hunter2222password")))
                .andExpect(status().isOk())
                .andReturn();

        MockHttpSession sessionAfterLogin = (MockHttpSession) loginResult.getRequest().getSession(false);

        // Regression guard for the session-fixation fix: every successful authentication must
        // rotate the session id, even when a session already existed beforehand.
        assertThat(sessionAfterLogin.getId()).isNotEqualTo(sessionIdAfterRegister);
    }

    // A real bug found and fixed 2026-08-06 lived here (see private/impl/csrf-rotation-bug-1-analyse.md):
    // CsrfCookieFilter used to resolve the deferred CSRF token BEFORE the controller ran, so the
    // token rotated by CsrfAuthenticationStrategy during register's auto-login (see SecurityConfig)
    // never actually got written to a Set-Cookie — the client was left with a deleted CSRF cookie
    // and no valid replacement, so the very next mutating request was rejected 403 before reaching
    // any business logic. No MockMvc integration test for this here: a full cookie-round-trip
    // attempt (bootstrap GET → register → second mutating call, all via real Set-Cookie headers
    // rather than .with(csrf())) reproduced the bug correctly in isolation, but turned out exactly
    // as order-dependent under MockMvc as the rotation test the 2026-08-02 audit had already tried
    // and dropped for the same reason (see git history of this file for that comment) — some other
    // test in this class leaves MockMvc's deferred-cookie resolution in a state where a fresh
    // anonymous GET stops getting a Set-Cookie at all. Covered instead by a deterministic unit test
    // with no Spring context (CsrfCookieFilterTest, config package) that exercises the exact fixed
    // logic — resolving both before and after the chain, picking up an attribute swapped mid-chain —
    // plus manual verification against the real running server (curl, before/after comparison).

    @Test
    void meWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meWithActiveSessionReturnsCurrentUser() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("marcel"))
                .andExpect(jsonPath("$.emailVerified").value(false));
    }

    @Test
    void logoutInvalidatesSession() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("marcel", "marcel@example.com", "hunter2222password")))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);

        mockMvc.perform(post("/api/auth/logout").with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized());
    }

    private String registerJson(String username, String email, String password) throws Exception {
        return objectMapper.writeValueAsString(new RegisterRequest(username, email, password));
    }

    private String loginJson(String username, String password) throws Exception {
        return objectMapper.writeValueAsString(new LoginRequest(username, password));
    }
}
