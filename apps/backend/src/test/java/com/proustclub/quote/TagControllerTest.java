package com.proustclub.quote;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
import com.proustclub.auth.PasswordBreachCheckerTestConfig;
import com.proustclub.auth.dto.RegisterRequest;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import({TestcontainersConfiguration.class, PasswordBreachCheckerTestConfig.class})
@SpringBootTest
@AutoConfigureMockMvc
class TagControllerTest {

    // Syntactically valid but never-inserted UUID — used where a path variable must merely
    // parse (e.g. an unauthenticated request that should 401 before ownership is even checked,
    // or a lookup that should 404 because nothing has this id).
    private static final String NONEXISTENT_ID = "00000000-0000-4000-8000-000000000000";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("quote_selection_tags")).execute();
        dsl.deleteFrom(DSL.table("quote_selections")).execute();
        dsl.deleteFrom(DSL.table("tags")).execute();
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    @Test
    void createTagSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Combray"))
                .andExpect(jsonPath("$.id").exists());
    }

    @Test
    void createTagWithSameNameReturnsConflict() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void createTagWithDifferentCasingReturnsConflict() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"combray\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void createTagWithBlankNameReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTagWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/tags").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listTagsReturnsMineOnly() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");

        mockMvc.perform(post("/api/tags").with(csrf()).session(alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"AliceTag\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tags").with(csrf()).session(bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"BobTag\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/tags").session(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("AliceTag"));
    }

    @Test
    void listTagsIsEmptyWhenNoneCreated() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(get("/api/tags").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void listTagsWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/tags"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void renameTagSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        String tagId = createTag(session, "Jalouise");

        mockMvc.perform(patch("/api/tags/" + tagId).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jalousie\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tagId))
                .andExpect(jsonPath("$.name").value("Jalousie"));
    }

    @Test
    void renameTagToOwnNameWithDifferentCasingSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        String tagId = createTag(session, "combray");

        mockMvc.perform(patch("/api/tags/" + tagId).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Combray"));
    }

    @Test
    void renameTagToAnotherTagsNameReturnsConflict() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        createTag(session, "Combray");
        String otherTagId = createTag(session, "Jalousie");

        mockMvc.perform(patch("/api/tags/" + otherTagId).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"combray\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void renameTagWithBlankNameReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        String tagId = createTag(session, "Combray");

        mockMvc.perform(patch("/api/tags/" + tagId).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameNonExistentTagReturnsNotFound() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(patch("/api/tags/" + NONEXISTENT_ID).with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void renameTagWithMalformedIdReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(patch("/api/tags/not-a-uuid").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameTagOfAnotherUserReturnsNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");
        String aliceTagId = createTag(alice, "AliceTag");

        mockMvc.perform(patch("/api/tags/" + aliceTagId).with(csrf()).session(bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void renameTagWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(patch("/api/tags/" + NONEXISTENT_ID).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Combray\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteTagSucceeds() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        String tagId = createTag(session, "Combray");

        mockMvc.perform(delete("/api/tags/" + tagId).with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tags").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteTagStillAttachedToQuoteDetachesItWithoutAffectingTheQuote() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");
        int paragraphId = createParagraph();

        MvcResult quoteResult = mockMvc.perform(post("/api/quotes").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paragraphId\":" + paragraphId + ",\"startOffset\":3,\"endOffset\":12,\"selectedText\":\"madeleine\",\"tagNames\":[\"Combray\"]}"))
                .andExpect(status().isCreated())
                .andReturn();
        var body = objectMapper.readTree(quoteResult.getResponse().getContentAsString());
        String quoteId = body.get("id").asText();
        String tagId = body.get("tags").get(0).get("id").asText();

        mockMvc.perform(delete("/api/tags/" + tagId).with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/quotes").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[?(@.id == '" + quoteId + "')].tags.length()").value(0));
    }

    @Test
    void deleteNonExistentTagReturnsNotFound() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(delete("/api/tags/" + NONEXISTENT_ID).with(csrf()).session(session))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteTagWithMalformedIdReturnsBadRequest() throws Exception {
        var session = registerAndLogin("alice", "alice@example.com");

        mockMvc.perform(delete("/api/tags/not-a-uuid").with(csrf()).session(session))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deleteTagOfAnotherUserReturnsNotFound() throws Exception {
        var alice = registerAndLogin("alice", "alice@example.com");
        var bob = registerAndLogin("bob", "bob@example.com");
        String aliceTagId = createTag(alice, "AliceTag");

        mockMvc.perform(delete("/api/tags/" + aliceTagId).with(csrf()).session(bob))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteTagWithoutSessionReturnsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/tags/" + NONEXISTENT_ID).with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    private MockHttpSession registerAndLogin(String username, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(username, email, "hunter2222password"))))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String createTag(MockHttpSession session, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/tags").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    private int createParagraph() {
        return dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, 1, 1, "La madeleine est un symbole fort chez Proust.")
                .returning(DSL.field("id", Integer.class))
                .fetchOne(DSL.field("id", Integer.class));
    }
}
