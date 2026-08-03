package com.proustclub.quote;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class QuoteControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private int paragraphId;

    @BeforeEach
    void setUp() {
        paragraphId = dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, 1, 1, "La madeleine est un symbole fort chez Proust.")
                .returning(DSL.field("id", Integer.class))
                .fetchOne(DSL.field("id", Integer.class));
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("quote_selection_tags")).execute();
        dsl.deleteFrom(DSL.table("quote_selections")).execute();
        dsl.deleteFrom(DSL.table("tags")).execute();
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    // --- POST /api/quotes ---

    @Test
    void createQuoteWithTagsSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of("Combray", "mémoire"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.selectedText").value("madeleine"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andExpect(jsonPath("$.tags[0].name").value("Combray"))
                .andExpect(jsonPath("$.tags[1].name").value("mémoire"));
    }

    @Test
    void createQuoteWithoutAnyTagSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tags.length()").value(0));
    }

    @Test
    void createQuoteWithMismatchedSelectedTextReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "wrong-text", List.of())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createQuoteWithOffsetsOutOfBoundsReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 0, 5000, "does not matter", List.of())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createQuoteWithUnknownParagraphReturnsNotFound() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(999999, 0, 5, "hello", List.of())))
                .andExpect(status().isNotFound());
    }

    @Test
    void createQuoteWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/quotes").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createQuoteWithoutCsrfTokenIsForbidden() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/quotes").session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of())))
                .andExpect(status().isForbidden());
    }

    // --- GET /api/quotes ---

    @Test
    void listQuotesReturnsOnlyMine() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");
        createQuote(alice, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(get("/api/quotes").session(bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(get("/api/quotes").session(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void listQuotesFiltersByTagId() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        MvcResult tagged = mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of("Combray"))))
                .andExpect(status().isCreated())
                .andReturn();

        mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 0, 2, "La", List.of("autre"))))
                .andExpect(status().isCreated());

        int tagId = objectMapper.readTree(tagged.getResponse().getContentAsString())
                .get("tags").get(0).get("id").asInt();

        mockMvc.perform(get("/api/quotes").session(session).param("tagId", String.valueOf(tagId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.results[0].selectedText").value("madeleine"));
    }

    @Test
    void listQuotesWithForeignTagIdReturnsEmptyNotNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");

        MvcResult tagResult = mockMvc.perform(post("/api/tags").with(csrf()).session(bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"BobTag\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        int bobTagId = objectMapper.readTree(tagResult.getResponse().getContentAsString()).get("id").asInt();

        mockMvc.perform(get("/api/quotes").session(alice).param("tagId", String.valueOf(bobTagId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.results.length()").value(0));
    }

    @Test
    void listQuotesWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/quotes"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listQuotesNegativePageReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(get("/api/quotes").session(session).param("page", "-1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listQuotesSizeBelowMinimumReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(get("/api/quotes").session(session).param("size", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listQuotesSizeAboveMaximumReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(get("/api/quotes").session(session).param("size", "21"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listQuotesTagIdBelowMinimumReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(get("/api/quotes").session(session).param("tagId", "0"))
                .andExpect(status().isBadRequest());
    }

    // --- DELETE /api/quotes/{id} ---

    @Test
    void deleteQuoteSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        int quoteId = createQuote(session, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(delete("/api/quotes/" + quoteId).with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/quotes").session(session))
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void deleteQuoteOfAnotherUserReturnsNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");
        int quoteId = createQuote(alice, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(delete("/api/quotes/" + quoteId).with(csrf()).session(bob))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteQuoteWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/quotes/1").with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // --- POST /api/quotes/{id}/tags ---

    @Test
    void addTagToQuoteUpsertsByName() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        int quoteId = createQuote(session, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(post("/api/quotes/" + quoteId + "/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(1))
                .andExpect(jsonPath("$.tags[0].name").value("Combray"));

        // Adding the same tag again (different casing) is idempotent, not an error.
        mockMvc.perform(post("/api/quotes/" + quoteId + "/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"combray\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(1));
    }

    @Test
    void addTagToQuoteWithBlankNameReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        int quoteId = createQuote(session, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(post("/api/quotes/" + quoteId + "/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addTagToQuoteOfAnotherUserReturnsNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");
        int quoteId = createQuote(alice, paragraphId, 3, 12, "madeleine");

        mockMvc.perform(post("/api/quotes/" + quoteId + "/tags").with(csrf()).session(bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isNotFound());
    }

    // --- DELETE /api/quotes/{id}/tags/{tagId} ---

    @Test
    void removeLastTagFromQuoteSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        MvcResult result = mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of("Combray"))))
                .andExpect(status().isCreated())
                .andReturn();

        var body = objectMapper.readTree(result.getResponse().getContentAsString());
        int quoteId = body.get("id").asInt();
        int tagId = body.get("tags").get(0).get("id").asInt();

        mockMvc.perform(delete("/api/quotes/" + quoteId + "/tags/" + tagId).with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/quotes").session(session))
                .andExpect(jsonPath("$.results[0].tags.length()").value(0));
    }

    @Test
    void removeTagNotAssociatedWithQuoteReturnsNotFound() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        int quoteId = createQuote(session, paragraphId, 3, 12, "madeleine");

        MvcResult tagResult = mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"UnrelatedTag\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        int unrelatedTagId = objectMapper.readTree(tagResult.getResponse().getContentAsString()).get("id").asInt();

        mockMvc.perform(delete("/api/quotes/" + quoteId + "/tags/" + unrelatedTagId).with(csrf()).session(session))
                .andExpect(status().isNotFound());
    }

    @Test
    void removeTagFromQuoteOfAnotherUserReturnsNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");

        MvcResult result = mockMvc.perform(post("/api/quotes").with(csrf()).session(alice).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, 3, 12, "madeleine", List.of("Combray"))))
                .andExpect(status().isCreated())
                .andReturn();

        var body = objectMapper.readTree(result.getResponse().getContentAsString());
        int quoteId = body.get("id").asInt();
        int tagId = body.get("tags").get(0).get("id").asInt();

        mockMvc.perform(delete("/api/quotes/" + quoteId + "/tags/" + tagId).with(csrf()).session(bob))
                .andExpect(status().isNotFound());
    }

    private MockHttpSession registerAndLogin(String username, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(username, email, "hunter2222password"))))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private int createQuote(MockHttpSession session, int paragraphId, int startOffset, int endOffset, String selectedText) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content(createQuoteJson(paragraphId, startOffset, endOffset, selectedText, List.of())))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asInt();
    }

    private String createQuoteJson(int paragraphId, int startOffset, int endOffset, String selectedText, List<String> tagNames) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("paragraphId", paragraphId);
        body.put("startOffset", startOffset);
        body.put("endOffset", endOffset);
        body.put("selectedText", selectedText);
        body.put("tagNames", tagNames);
        return objectMapper.writeValueAsString(body);
    }
}
