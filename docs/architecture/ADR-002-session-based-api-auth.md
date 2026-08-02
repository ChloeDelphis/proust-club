# ADR-002: Session-based authentication for a JSON API without server-rendered login

## Decision

Programmatic session authentication: a custom `AuthController` calls Spring Security's `AuthenticationManager` directly and persists the resulting `SecurityContext` into the HTTP session via `SecurityContextRepository`. CSRF protection stays enabled, backed by a cookie-readable token (`CookieCsrfTokenRepository`) that the frontend echoes back in a request header.

## Context

The private cadrage's `adr-001-auth.md` already decided *server-side session (Spring Security's native `HttpSession`) vs JWT* in favor of session cookies — not the separate Spring Session module, which is only needed to share sessions across multiple instances (Redis/JDBC). That decision leaves open *how* a session gets established when there is no server-rendered login form — Proust Club's frontend is a pure JSON SPA, and Spring Security's `formLogin()` assumes an HTML login page.

Two implementation paths were considered:

**Option A — `formLogin()` with a custom AuthenticationSuccessHandler/FailureHandler**
Keep Spring Security's built-in login filter, but override the success/failure handlers to return JSON instead of redirects. Spring Security owns the request parsing (form-encoded `username`/`password`) and the session bootstrapping.

**Option B — Programmatic authentication in a plain `@RestController`**
Disable `formLogin()` entirely. `AuthController.login()` accepts a JSON body (`LoginRequest`), calls `AuthenticationManager.authenticate(...)` directly, and manually stores the resulting `Authentication` into a new `SecurityContext`, persisted via `SecurityContextRepository.saveContext(...)`.

## Why Option B

- **JSON in, JSON out.** `formLogin()` expects `application/x-www-form-urlencoded` parameters by default; making it accept and return JSON requires more configuration surface (custom `AuthenticationConverter`, handlers) than writing a small controller method.
- **Consistent with the rest of the API.** Every other endpoint (`/api/search`, and now `/api/auth/*`) is a plain `@RestController` with Jakarta validation and `ProblemDetail` errors. A `formLogin()` filter would be the only endpoint behaving differently — matched by a security filter before reaching MVC, not validated by `@Valid`.
- **Auto-login after registration falls out for free.** Since authentication is just a method (`AuthService.authenticate(username, password)`), `register()` calls it directly with the credentials just used to create the account, to open a session immediately. No separate mechanism is needed between "form login" and "programmatic login" — they are the same code path.

## CSRF

Spring Security's CSRF protection is **kept enabled** — never disabled — per the project's security baseline (`securité.md`, `adr-001-auth.md`). Since the frontend is a pure SPA with no server-rendered `<form>` carrying a hidden CSRF field, the token needs to reach it another way:

- `CookieCsrfTokenRepository.withHttpOnlyFalse()` writes the token into a JS-readable `XSRF-TOKEN` cookie.
- `apiFetch()` (`src/api/client.ts`) reads that cookie and echoes it back as an `X-XSRF-TOKEN` header on every non-GET request.
- A small `CsrfCookieFilter` forces the token (otherwise lazily resolved) to be written on every response. Without it, `CookieCsrfTokenRepository` never actually sets the cookie, because nothing in a JSON API naturally triggers `CsrfToken.getToken()` the way a server-rendered form would.

This is the pattern Spring Security itself documents for SPA integration, not a bespoke workaround.

## 401 entry point

`anyRequest().authenticated()` rejects unauthenticated requests before they reach a controller. By default, Spring Security's fallback entry point does not produce a response tailored to an API client. `HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)` is configured explicitly: a bare 401 with no body. The frontend only needs the status code — `GET /api/auth/me` returning 401 is exactly how `useCurrentUser()` detects "no active session." A `ProblemDetail` body is not needed here: this is not a business exception, it is the intended mechanism for a routine state check.

## Tradeoff accepted

The controller carries a small amount of session-plumbing (`SecurityContextHolder`, `SecurityContextRepository`) that `formLogin()` would otherwise hide. This is acceptable: it is about ten lines, isolated to `AuthController`, and buys consistency with the rest of the API surface.

## Date

2026-08-02

## Addendum (2026-08-02) — what "session-plumbing" turned out to mean in practice

A security audit (`private/impl/auth-3-audit-securite.md`) found that the "small amount of plumbing" above was, at first, incomplete in three concrete ways — all because `formLogin()`'s filter-based flow runs a few Spring Security mechanisms automatically that a programmatic controller has to invoke explicitly instead:

1. **Session fixation.** Successful authentication must rotate the session id. `SessionManagementFilter` does this via a `SessionAuthenticationStrategy`; our controller has to call one itself. Fixed by injecting a `SessionAuthenticationStrategy` bean and calling `.onAuthentication(...)` in `AuthController.persistSession()`.
2. **CSRF token rotation.** The pre-auth CSRF token should be invalidated on login/logout (`CsrfAuthenticationStrategy`, `CsrfLogoutHandler`) — otherwise it silently doesn't happen for a controller-driven flow.
3. **Logout composition.** `.logout()` normally assembles a chain of `LogoutHandler`s (session invalidation, CSRF cookie clearing, session cookie clearing). A hand-written `@PostMapping("/api/auth/logout")` has to assemble the same chain itself.

The fix for all three follows the same shape: assemble Spring Security's own composable objects as beans (`CompositeSessionAuthenticationStrategy` combining `ChangeSessionIdAuthenticationStrategy` + `CsrfAuthenticationStrategy`; a `List<LogoutHandler>` combining `CsrfLogoutHandler` + `CookieClearingLogoutHandler` + `SecurityContextLogoutHandler`), and have the controller invoke the assembled object — rather than hand-rolling the individual steps or skipping them. See `SecurityConfig.java` (`sessionAuthenticationStrategy`, `csrfLogoutHandler`, `cookieClearingLogoutHandler`, `securityContextLogoutHandler` beans) and `AuthController.persistSession()`/`logout()`.

Practical takeaway for future programmatic-auth work in this codebase: when bypassing a Spring Security filter to do something "by hand," check what `SessionManagementFilter`/`LogoutFilter` would normally have assembled on that code path, and reuse the same building blocks explicitly rather than assuming the manual version is complete.
