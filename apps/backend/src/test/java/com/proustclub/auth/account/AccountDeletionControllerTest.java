package com.proustclub.auth.account;

import com.proustclub.auth.PasswordBreachChecker;
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

import java.util.UUID;
import java.time.OffsetDateTime;

import static com.proustclub.jooq.identity.Tables.EMAIL_VERIFICATION_TOKENS;
import static com.proustclub.jooq.corpus.Tables.PARAGRAPHS;
import static com.proustclub.jooq.identity.Tables.PASSWORD_RESET_TOKENS;
import static com.proustclub.jooq.library.Tables.QUOTE_SELECTIONS;
import static com.proustclub.jooq.library.Tables.QUOTE_SELECTION_TAGS;
import static com.proustclub.jooq.library.Tables.TAGS;
import static com.proustclub.jooq.identity.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AccountDeletionControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @MockitoBean
    PasswordBreachChecker passwordBreachChecker;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Integer fixtureParagraphId;

    @BeforeEach
    void stubPasswordAsNotCompromisedByDefault() {
        when(passwordBreachChecker.isCompromised(anyString())).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(USERS).execute();
        if (fixtureParagraphId != null) {
            dsl.deleteFrom(PARAGRAPHS).where(PARAGRAPHS.ID.eq(fixtureParagraphId)).execute();
        }
    }

    @Test
    void deleteAccountPermanentlyRemovesPersonalDataAndInvalidatesEverySession() throws Exception {
        String email = "delete-account@example.com";
        String password = "current-password-long-enough";
        MockHttpSession registeredSession = registerAndGetSession(email, password);
        var userId = dsl.select(USERS.UUID).from(USERS).where(USERS.EMAIL.eq(email)).fetchOne(USERS.UUID);
        var quoteId = UUID.randomUUID();
        var tagId = UUID.randomUUID();
        assertThat(dsl.fetchCount(EMAIL_VERIFICATION_TOKENS)).isEqualTo(1);
        dsl.insertInto(PASSWORD_RESET_TOKENS)
                .set(PASSWORD_RESET_TOKENS.USER_ID, userId)
                .set(PASSWORD_RESET_TOKENS.TOKEN_HASH, UUID.randomUUID().toString().replace("-", ""))
                .set(PASSWORD_RESET_TOKENS.EXPIRES_AT, OffsetDateTime.now().plusHours(1))
                .execute();
        var nextPosition = dsl.select(DSL.coalesce(DSL.max(PARAGRAPHS.POSITION), 0).add(1))
                .from(PARAGRAPHS)
                .fetchOne(0, Integer.class);
        fixtureParagraphId = dsl.insertInto(PARAGRAPHS)
                .set(PARAGRAPHS.VOLUME_ID, 1)
                .set(PARAGRAPHS.PART_ID, 1)
                .set(PARAGRAPHS.POSITION, nextPosition)
                .set(PARAGRAPHS.PAGE_NUMBER, 1)
                .set(PARAGRAPHS.TEXT, "A")
                .returningResult(PARAGRAPHS.ID)
                .fetchSingle()
                .value1();

        dsl.insertInto(QUOTE_SELECTIONS)
                .set(QUOTE_SELECTIONS.ID, quoteId)
                .set(QUOTE_SELECTIONS.USER_ID, userId)
                .set(QUOTE_SELECTIONS.PARAGRAPH_ID, fixtureParagraphId)
                .set(QUOTE_SELECTIONS.START_OFFSET, 0)
                .set(QUOTE_SELECTIONS.END_OFFSET, 1)
                .set(QUOTE_SELECTIONS.SELECTED_TEXT, "A")
                .execute();
        dsl.insertInto(TAGS)
                .set(TAGS.ID, tagId)
                .set(TAGS.USER_ID, userId)
                .set(TAGS.NAME, "À conserver")
                .execute();
        dsl.insertInto(QUOTE_SELECTION_TAGS)
                .set(QUOTE_SELECTION_TAGS.QUOTE_SELECTION_ID, quoteId)
                .set(QUOTE_SELECTION_TAGS.TAG_ID, tagId)
                .execute();

        MvcResult secondLogin = mockMvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();
        var secondSession = (MockHttpSession) secondLogin.getRequest().getSession(false);

        mockMvc.perform(deleteAccount(registeredSession, password))
                .andExpect(status().isNoContent());

        assertThat(dsl.fetchCount(USERS)).isZero();
        assertThat(dsl.fetchCount(QUOTE_SELECTIONS)).isZero();
        assertThat(dsl.fetchCount(TAGS)).isZero();
        assertThat(dsl.fetchCount(QUOTE_SELECTION_TAGS)).isZero();
        assertThat(dsl.fetchCount(PASSWORD_RESET_TOKENS)).isZero();
        assertThat(dsl.fetchCount(EMAIL_VERIFICATION_TOKENS)).isZero();
        mockMvc.perform(get("/api/auth/me").session(registeredSession)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").session(secondSession)).andExpect(status().isUnauthorized());
    }

    @Test
    void incorrectCurrentPasswordPreservesAccountAndSession() throws Exception {
        String email = "delete-wrong-password@example.com";
        MockHttpSession session = registerAndGetSession(email, "current-password-long-enough");

        mockMvc.perform(deleteAccount(session, "not-the-current-password"))
                .andExpect(status().isUnauthorized());

        assertThat(dsl.fetchCount(USERS)).isEqualTo(1);
        mockMvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
    }

    @Test
    void missingCurrentPasswordIsRejectedWithoutDeletingTheAccount() throws Exception {
        String email = "delete-missing-password@example.com";
        MockHttpSession session = registerAndGetSession(email, "current-password-long-enough");

        mockMvc.perform(post("/api/auth/account/delete").with(csrf()).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\" \"}"))
                .andExpect(status().isBadRequest());

        assertThat(dsl.fetchCount(USERS)).isEqualTo(1);
    }

    @Test
    void deleteAccountWithoutSessionIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/account/delete").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"some-password\"}"))
                .andExpect(status().isUnauthorized());
    }

    private MockHttpSession registerAndGetSession(String email, String password) throws Exception {
        var result = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(email, password))))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder deleteAccount(
            MockHttpSession session, String currentPassword
    ) {
        return post("/api/auth/account/delete").with(csrf()).session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"" + currentPassword + "\"}");
    }
}
