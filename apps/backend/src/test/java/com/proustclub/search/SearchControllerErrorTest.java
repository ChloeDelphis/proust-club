package com.proustclub.search;

import com.proustclub.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

// SpringBootTest.WebEnvironment.RANDOM_PORT + a real embedded server, not MockMvc: an unhandled
// RuntimeException falls through to the servlet container's own /error forwarding, which MockMvc's
// mock DispatcherServlet does not faithfully simulate (a forward() there is a no-op recording, not
// an actual re-dispatch to BasicErrorController). Plain java.net.http.HttpClient (JDK, no new test
// dependency) rather than TestRestTemplate, which isn't on this project's granular Boot 4 test
// starters — forced to HTTP/1.1 since HttpClient's default HTTP/2 upgrade attempt against this
// connector was misread by Spring's DisconnectedClientHelper as the client going away, silently
// suppressing the error response (200 empty instead of 500). Own dedicated context: SearchRepository
// is mocked to force an unexpected technical failure, isolated from SearchControllerTest (real
// repository + Testcontainers).
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SearchControllerErrorTest {

    @LocalServerPort
    int port;

    @MockitoBean
    SearchRepository searchRepository;

    @Test
    void unexpectedRepositoryFailureReturns500WithoutLeakingInternalDetails() throws Exception {
        when(searchRepository.search(anyString(), anyInt(), anyInt()))
                .thenThrow(new RuntimeException("SELECT * FROM paragraphs failed unexpectedly (simulated)"));
        when(searchRepository.count(any())).thenReturn(0L);

        HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/search?q=madeleine"))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(500);
        assertNoLeakedInternals(response.body());
    }

    private void assertNoLeakedInternals(String body) {
        String lower = body == null ? "" : body.toLowerCase();
        assertThat(lower)
                .doesNotContain("select")
                .doesNotContain("runtimeexception")
                .doesNotContain("com.proustclub")
                .doesNotContain("at java.")
                .doesNotContain("at org.springframework");
    }
}
