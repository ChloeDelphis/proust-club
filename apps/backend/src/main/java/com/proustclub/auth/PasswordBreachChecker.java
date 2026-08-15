package com.proustclub.auth;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.web.authentication.password.HaveIBeenPwnedRestApiPasswordChecker;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

// See ADR-011 for the full reasoning. Deliberately does NOT implement Spring Security's
// CompromisedPasswordChecker interface, and builds HaveIBeenPwnedRestApiPasswordChecker directly
// rather than exposing it as a CompromisedPasswordChecker @Bean. If a bean of that exact type
// existed in the context, Spring Security's InitializeUserDetailsBeanManagerConfigurer auto-wires
// it into the default DaoAuthenticationProvider for every authentication — silently extending
// this check to login() (not just register(), the only flow this ticket scoped it to) and
// bypassing the fail-open behavior below entirely. Confirmed by decompiling
// spring-security-config 7.1.0; not documented anywhere found.
@Component
class PasswordBreachChecker {

    private final HaveIBeenPwnedRestApiPasswordChecker delegate;

    // Must match HaveIBeenPwnedRestApiPasswordChecker's own private API_URL constant exactly.
    // Its no-arg constructor builds its default RestClient with this as baseUrl — setRestClient()
    // below replaces that whole RestClient, and there is no getter to recover the base URL it had.
    // Confirmed by decompiling spring-security-web 7.1.0: omitting this (as an earlier version of
    // this class did) makes every check() call throw on a relative URI before any HTTP request is
    // sent, silently triggering the fail-open path in AuthService.checkPasswordNotCompromised on
    // every single call — the check would never actually run against the real API.
    private static final String HIBP_API_URL = "https://api.pwnedpasswords.com/range/";

    PasswordBreachChecker() {
        var httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(2));

        this.delegate = new HaveIBeenPwnedRestApiPasswordChecker();
        this.delegate.setRestClient(RestClient.builder().baseUrl(HIBP_API_URL).requestFactory(requestFactory).build());
    }

    // Sends only the first 5 characters of the password's SHA-1 hash to the HIBP API
    // (k-anonymity model), never the password or the full hash.
    //
    // check() itself already swallows RestClientException (timeout, connection failure, HIBP
    // 4xx/5xx) internally and returns "not compromised" — this is the actual fail-open mechanism
    // for a real HIBP outage, not AuthService's own catch block (which only ever fires for
    // something this delegate doesn't already handle, e.g. a bug here). Confirmed by decompiling
    // HaveIBeenPwnedRestApiPasswordChecker.getLeakedPasswordsForPrefix in spring-security-web
    // 7.1.0: its entire RestClient call is wrapped in try/catch(RestClientException), which logs
    // internally (Log.error, this class's own logger) and returns Collections.emptyList().
    boolean isCompromised(String password) {
        return delegate.check(password).isCompromised();
    }
}
