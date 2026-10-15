# ADR-002: Session-based authentication for a JSON API

## Decision

Use a JSON `AuthController` to authenticate through Spring Security's `AuthenticationManager`, then persist the `SecurityContext` in the HTTP session with `SecurityContextRepository`. Keep CSRF protection enabled. The SPA reads the `XSRF-TOKEN` cookie and sends it in `X-XSRF-TOKEN` for state-changing requests.

## Context

The frontend is a JSON SPA, so Spring Security's default HTML `formLogin()` flow does not fit its request and response contract. ADR-005 selects server-side sessions; this ADR records how the API establishes them.

## Rationale

A controller accepts validated JSON and shares the same authentication path between login and registration auto-login. CSRF uses Spring Security's cookie repository; `CsrfCookieFilter` resolves the deferred token so the browser receives the cookie.

Because the controller bypasses the login and logout filters, it explicitly invokes Spring Security's session-authentication strategy (session ID rotation, CSRF token rotation, and session registration) and logout handlers (session invalidation and cookie clearing).

Unauthenticated and access-denied requests use the API's `ProblemDetail` handlers, including filter-chain 401 and 403 responses.

## Trade-off

The controller owns a small amount of security plumbing that filter-based login would otherwise assemble. Keeping Spring Security's own strategies and handlers limits custom security behavior.

## Date

2026-08-02
