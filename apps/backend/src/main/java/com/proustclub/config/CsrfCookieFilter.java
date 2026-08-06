package com.proustclub.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forces resolution of the deferred CSRF token so that CookieCsrfTokenRepository
 * actually writes the XSRF-TOKEN cookie on the response, even though nothing
 * in a pure JSON API naturally reads the token (no server-rendered form).
 *
 * Resolved both BEFORE and AFTER the rest of the chain, not just once:
 * - Before: guarantees every response still carries a cookie even when the response
 *   commits early further down the chain (e.g. an anonymous 401/403 rejection) — this
 *   is also how the frontend obtains its very first token, via the anonymous
 *   GET /api/auth/me it fires on load (see docs/features/auth.md).
 * - After: login/register rotate the token mid-request (CsrfAuthenticationStrategy,
 *   see SecurityConfig) by replacing the CsrfToken request attribute with a fresh,
 *   unresolved one from inside the controller. Only resolving before doFilter() would
 *   always see the pre-rotation attribute, so the rotated token's cookie would never
 *   actually get written — leaving the client with a deleted CSRF cookie and no valid
 *   replacement after every successful login/register.
 * Resolving an already-resolved token is a cheap cached no-op, and writing the same
 * cookie value twice in one response is harmless — clients keep the last Set-Cookie.
 *
 * Known limit: if a future rotator (session strategy, logout handler) rotated the token
 * after the response had already committed downstream, the after-chain resolution here
 * would silently write nothing (Set-Cookie is a no-op post-commit) — not a bug today
 * (register/login write small, unflushed bodies), just a ceiling on this mechanism.
 */
class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        resolveCsrfToken(request);
        filterChain.doFilter(request, response);
        resolveCsrfToken(request);
    }

    private void resolveCsrfToken(HttpServletRequest request) {
        var csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            csrfToken.getToken();
        }
    }
}
