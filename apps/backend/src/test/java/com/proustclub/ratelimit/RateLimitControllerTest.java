package com.proustclub.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proustclub.TestcontainersConfiguration;
import com.proustclub.auth.dto.LoginRequest;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Own dedicated Spring context: @TestPropertySource with tiny capacities lets this class exceed
// limits deterministically in a handful of requests, without affecting AuthControllerTest /
// SearchControllerTest (which run with the generous src/test/resources/application.yml override).
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "rate-limit.login.per-ip.capacity=2",
        "rate-limit.login.per-ip.refill-period=1h",
        "rate-limit.login.per-account.capacity=2",
        "rate-limit.login.per-account.refill-period=1h",
        "rate-limit.register.per-ip.capacity=2",
        "rate-limit.register.per-ip.refill-period=1h",
        "rate-limit.search.per-ip.capacity=2",
        "rate-limit.search.per-ip.refill-period=1h",
})
class RateLimitControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("users")).execute();
    }

    // Status + Retry-After header asserted, not the ProblemDetail body — see the comment on
    // ErrorHandlingIntegrationTest.malformedJsonReturnsBadRequest (same MockMvc limitation for
    // this resolution path). Manually verified against the real server: 429 body is
    // {"detail":"Too many requests. Please try again later.","status":429,"title":"Too Many Requests"}
    // with Content-Type: application/problem+json.
    @Test
    void registerExceedingIpLimitReturns429WithRetryAfter() throws Exception {
        mockMvc.perform(registerFrom("9.9.1.1", "ratelimit1", "ratelimit1@example.com"))
                .andExpect(status().isCreated());
        mockMvc.perform(registerFrom("9.9.1.1", "ratelimit2", "ratelimit2@example.com"))
                .andExpect(status().isCreated());

        mockMvc.perform(registerFrom("9.9.1.1", "ratelimit3", "ratelimit3@example.com"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void searchExceedingIpLimitReturns429() throws Exception {
        mockMvc.perform(searchFrom("9.9.2.1")).andExpect(status().isOk());
        mockMvc.perform(searchFrom("9.9.2.1")).andExpect(status().isOk());

        mockMvc.perform(searchFrom("9.9.2.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void searchRateLimitAppliesEvenWithAnAuthenticatedSession() throws Exception {
        // Registering from a different IP so it doesn't spend the search-by-ip bucket under test.
        mockMvc.perform(registerFrom("9.9.3.1", "ratelimit4", "ratelimit4@example.com"))
                .andExpect(status().isCreated());

        mockMvc.perform(searchFrom("9.9.3.2")).andExpect(status().isOk());
        mockMvc.perform(searchFrom("9.9.3.2")).andExpect(status().isOk());

        // Third search from the same IP, this time carrying a real authenticated session:
        // still 429 — an authenticated request is not exempt from the per-IP limit.
        mockMvc.perform(searchFrom("9.9.3.2"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void loginExceedingIpLimitReturns429() throws Exception {
        mockMvc.perform(registerFrom("9.9.4.1", "ratelimit5", "ratelimit5@example.com"))
                .andExpect(status().isCreated());

        mockMvc.perform(loginFrom("9.9.4.2", "ratelimit5", "wrong-password-a"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(loginFrom("9.9.4.2", "ratelimit5", "wrong-password-b"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(loginFrom("9.9.4.2", "ratelimit5", "wrong-password-c"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void sameAccountFromDifferentIpsStillHitsTheAccountLimit() throws Exception {
        mockMvc.perform(registerFrom("9.9.5.1", "ratelimit6", "ratelimit6@example.com"))
                .andExpect(status().isCreated());

        // Two failed attempts against the same account, each from its own IP — the per-IP
        // bucket for each of these IPs is nowhere near its limit, but the per-account bucket is.
        mockMvc.perform(loginFrom("9.9.5.10", "ratelimit6", "wrong-password-a"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(loginFrom("9.9.5.11", "ratelimit6", "wrong-password-b"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(loginFrom("9.9.5.12", "ratelimit6", "wrong-password-c"))
                .andExpect(status().isTooManyRequests());
    }

    private MockHttpServletRequestBuilder registerFrom(String ip, String username, String email) throws Exception {
        return post("/api/auth/register").with(csrf()).with(remoteAddr(ip))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RegisterRequest(username, email, "hunter2222password")));
    }

    private MockHttpServletRequestBuilder loginFrom(String ip, String username, String password) throws Exception {
        return post("/api/auth/login").with(csrf()).with(remoteAddr(ip))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(username, password)));
    }

    private MockHttpServletRequestBuilder searchFrom(String ip) {
        return get("/api/search").with(remoteAddr(ip)).param("q", "xyzzy-no-match");
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor remoteAddr(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }
}
