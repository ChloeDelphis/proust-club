package com.proustclub.auth;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

// No test here hits the real HIBP API — deliberately, to avoid a test that depends on outbound
// internet access (first-ever concern of this kind in this backend; Mailhog/Testcontainers stay
// local). Instead, wiringReachesALocalStubAnd*() drive PasswordBreachChecker's real construction
// (baseUrl, timeout, RestClient) against a local HTTP stub (com.sun.net.httpserver.HttpServer, JDK
// built-in, no new test dependency) shaped like the real Pwned Passwords range API. This is exactly
// what would have caught the original baseUrl bug: a stub still requires an absolute URI to reach.
// The real end-to-end integration (real API, real account creation) was verified manually instead —
// browser, Swagger UI, and the Postman collection run via Newman — see -4-verification.md.
//
// Class-level @Timeout: every test here does real socket I/O (loopback stub or a deliberately
// unreachable host) — per CLAUDE.md's "Tests de câblage" convention, always bounded by an explicit
// timeout so a sandboxed/locked-down runner that silently stalls rather than fast-refuses can't
// hang the build indefinitely. Found missing on two of the three tests by /code-review.
@Timeout(5)
class PasswordBreachCheckerTest {

    // Validates the *actual* fail-open mechanism for a real HIBP outage — found by /code-review,
    // confirmed by decompiling spring-security-web 7.1.0: HaveIBeenPwnedRestApiPasswordChecker's
    // own check() already swallows RestClientException (connection failure, timeout, HIBP 4xx/5xx)
    // and returns "not compromised" — AuthService's own catch(RuntimeException) never gets a
    // chance to run for this failure mode. Goes through PasswordBreachChecker's own baseUrl-
    // overriding constructor (same one the two stub tests below use), pointed at a host guaranteed
    // not to resolve — found by /code-review: an earlier version of this test hand-built a separate
    // HaveIBeenPwnedRestApiPasswordChecker instead, so it never actually exercised
    // PasswordBreachChecker's own construction/timeout wiring, only a parallel reimplementation of
    // it. The class-level @Timeout above is the backstop for a sandboxed runner where outbound
    // DNS/TCP is silently dropped rather than fast-refused.
    @Test
    void hibpDelegateFailsOpenOnConnectionFailureRatherThanThrowing() {
        var checker = new PasswordBreachChecker("https://unreachable.invalid/range/");

        assertThat(checker.isCompromised("password123")).isFalse();
    }

    @Test
    void wiringReachesALocalStubAndDetectsAMatchingSuffix() throws IOException {
        var password = "wiremock-style-stub-test-password";
        var suffix = sha1Suffix(password);
        var server = startStubServer(suffix + ":42\r\n");
        try {
            var checker = new PasswordBreachChecker(stubBaseUrl(server));
            assertThat(checker.isCompromised(password)).isTrue();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void wiringReachesALocalStubAndAllowsANonMatchingSuffix() throws IOException {
        var password = "wiremock-style-stub-test-password-safe";
        // Any suffix that doesn't match this password's own — the stub always returns the same
        // body regardless of the requested prefix, which is fine: findLeakedPassword() only cares
        // whether this specific password's suffix appears in the returned lines.
        var server = startStubServer("0000000000000000000000000000000000:1\r\n");
        try {
            var checker = new PasswordBreachChecker(stubBaseUrl(server));
            assertThat(checker.isCompromised(password)).isFalse();
        } finally {
            server.stop(0);
        }
    }

    private static String stubBaseUrl(HttpServer server) {
        return "http://localhost:" + server.getAddress().getPort() + "/range/";
    }

    private static HttpServer startStubServer(String responseBody) throws IOException {
        var server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/range/", exchange -> {
            var bytes = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            try (var body = exchange.getResponseBody()) {
                body.write(bytes);
            }
        });
        server.start();
        return server;
    }

    // Same SHA-1-then-split-at-5 shape as HaveIBeenPwnedRestApiPasswordChecker.check() itself.
    private static String sha1Suffix(String password) {
        try {
            var digest = MessageDigest.getInstance("SHA-1").digest(password.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(digest).substring(5);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
