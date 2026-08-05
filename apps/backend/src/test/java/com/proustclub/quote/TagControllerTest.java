package com.proustclub.quote;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TagControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("quote_selection_tags")).execute();
        dsl.deleteFrom(DSL.table("tags")).execute();
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

    private MockHttpSession registerAndLogin(String username, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(username, email, "hunter2222password"))))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
