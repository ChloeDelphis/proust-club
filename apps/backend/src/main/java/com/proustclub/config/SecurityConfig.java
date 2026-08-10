package com.proustclub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.RegisterSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfLogoutHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.session.HttpSessionEventPublisher;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(
            HttpSecurity http, CsrfTokenRepository csrfTokenRepository, ProblemDetailSecurityHandlers securityHandlers,
            SessionRegistry sessionRegistry
    ) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/search").permitAll()
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/register", "/api/auth/login",
                                "/api/auth/password-reset/request", "/api/auth/password-reset/confirm"
                        ).permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // The servlet container's internal forward for an unhandled exception on
                        // ANY endpoint (including anonymous ones like GET /api/search) lands here.
                        // Without this, that forward re-enters the filter chain as a fresh request,
                        // is treated as anonymous access to an unlisted path, and the real 500
                        // never reaches the client — it's masked by a misleading 401 instead.
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated()
                )
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                )
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
                // Same ProblemDetail contract for both: Spring Security's filter chain runs before
                // DispatcherServlet, so neither exception ever reaches Spring MVC's own resolvers
                // (see ADR-004 / docs/features/error-handling.md for why both need this explicit wiring).
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(securityHandlers)
                        .accessDeniedHandler(securityHandlers)
                )
                // Default RequestCache (HttpSessionRequestCache) creates a session on every
                // anonymous 401/403 just to remember the URL for a post-login redirect — a
                // formLogin/browser mechanism this JSON API never uses. Disabling it avoids
                // creating throwaway sessions for visitors who never log in.
                .requestCache(RequestCacheConfigurer::disable)
                // No cap on concurrent sessions (-1) — this isn't about limiting how many devices
                // can be logged in at once. It only wires up ConcurrentSessionFilter, which is what
                // actually enforces a session that PasswordResetService marks expired via
                // SessionRegistry (see ADR-010): the filter checks the registry on every request and
                // invalidates a session found expired there, on that session's next request.
                .sessionManagement(session -> session
                        .sessionConcurrency(concurrency -> concurrency
                                .maximumSessions(-1)
                                .sessionRegistry(sessionRegistry)
                                // Default strategy writes a bare 200 with a plain-text body —
                                // inconsistent with this API's ProblemDetail contract everywhere
                                // else. securityHandlers already implements this interface too.
                                .expiredSessionStrategy(securityHandlers))
                )
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable);
        return http.build();
    }

    // Backing store for "all sessions of this user" lookups (see PasswordResetService). In-memory,
    // which is enough for a single backend instance — see docs/architecture/ADR-010 for why this
    // (rather than Spring Session + Redis) was chosen, and what it does not guarantee.
    @Bean
    SessionRegistry sessionRegistry() {
        return new SessionRegistryImpl();
    }

    // Without this listener, SessionRegistry never hears about session destruction (timeout,
    // logout, browser-side expiry) and would leak stale entries forever.
    @Bean
    HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        // Argon2id — current OWASP recommendation. Delegating encoder: the stored hash
        // self-describes its algorithm (prefixed with {argon2}), which would let a future
        // algorithm coexist without a migration script if this ever needs to change again.
        String defaultId = "argon2";
        return new DelegatingPasswordEncoder(defaultId, Map.of(
                defaultId, Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8()
        ));
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository() {
        return CookieCsrfTokenRepository.withHttpOnlyFalse();
    }

    // Our login/register controller authenticates programmatically (see ADR-002) instead of
    // going through Spring Security's filter-based login flow (UsernamePasswordAuthenticationFilter).
    // That flow is what normally runs this exact composite strategy on successful authentication —
    // rotating the session id (fixation protection) AND deleting the pre-auth CSRF token
    // (CsrfAuthenticationStrategy). Bypassing the filter chain means we must call it ourselves,
    // in the same order Spring Security's own SessionManagementConfigurer uses by default.
    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy(CsrfTokenRepository csrfTokenRepository, SessionRegistry sessionRegistry) {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(),
                new CsrfAuthenticationStrategy(csrfTokenRepository),
                // Registers every newly authenticated session with SessionRegistry — same reasoning
                // as the two strategies above: the formLogin flow that normally does this for free
                // never runs here, so it needs to be assembled into this composite explicitly.
                new RegisterSessionAuthenticationStrategy(sessionRegistry)
        ));
    }

    // Spring's own .logout() DSL wires this in automatically (part of its default LogoutHandler
    // composite). Our logout endpoint is a plain @PostMapping calling SecurityContextLogoutHandler
    // directly, which bypasses that default composite — so the CSRF token deletion needs the
    // same explicit treatment as the two strategies above.
    @Bean
    LogoutHandler csrfLogoutHandler(CsrfTokenRepository csrfTokenRepository) {
        return new CsrfLogoutHandler(csrfTokenRepository);
    }

    // SecurityContextLogoutHandler invalidates the session server-side (enough to make the
    // old JSESSIONID useless), but never sends a Set-Cookie to clear it client-side — that's
    // this handler's job, same story as the two beans above.
    @Bean
    LogoutHandler cookieClearingLogoutHandler() {
        return new CookieClearingLogoutHandler("JSESSIONID");
    }

    // All three logout handlers are plain Spring Security classes with no ordering dependency
    // on each other (each only touches its own cookie/session concern) — composed here as beans
    // like the two above, rather than one being hand-instantiated separately in the controller.
    @Bean
    LogoutHandler securityContextLogoutHandler() {
        return new SecurityContextLogoutHandler();
    }
}
