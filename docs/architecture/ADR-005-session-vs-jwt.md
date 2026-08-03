# ADR-005: Authentication — server-side session vs JWT

## Decision

**Server-side HTTP session** (Spring Security's native `HttpSession`) with an `HttpOnly` cookie, for the MVP.

## Context

Two approaches were considered for authenticating users of a Spring Boot API:

**Option A — Server-side HTTP session (native Spring Security)**
The session is stored server-side (in memory, or Redis for multi-instance deployments). An `HttpOnly` + `Secure` + `SameSite=Strict` `JSESSIONID` cookie is sent to the browser. Spring Security handles CSRF protection natively.

Not the separate *Spring Session* module — that dependency is only useful for sharing sessions across multiple instances via Redis/JDBC. For a single instance, Spring Security's native mechanism (persisting the `SecurityContext` in the standard `HttpSession`) is enough. This is what is actually implemented (see ADR-002).

**Option B — JWT in an HttpOnly cookie**
A signed JWT is issued at login and stored in an `HttpOnly` cookie. The backend validates the signature on every request, with no server-side state.

Important nuance: a JWT placed in an `HttpOnly` cookie is still sent automatically by the browser on every request, so it remains just as exposed to CSRF as a classic session cookie. `SameSite=Strict` helps (defense in depth) but doesn't replace real CSRF protection — switching to a JWT-in-cookie doesn't mean CSRF protection can be dropped.

## Comparison

| Criterion | Server session (Spring Security) | JWT cookie |
|---|---|---|
| Implementation complexity | Low — native Spring Security | Medium — issuance, validation, refresh |
| Session revocation | Trivial (delete the session) | Complex (blacklist, or short-lived + refresh tokens) |
| Horizontal scaling | Needs Redis (or the Spring Session module) beyond one instance | Stateless, nothing to share |
| CSRF | Handled natively by Spring Security | Still required (cookie sent automatically) — `SameSite=Strict` is defense in depth only |
| Security by default | Good | Good if implemented correctly |

## Why server-side session

The application is served by a single instance. The frontend is the only client. There is no need for statelessness right now. This choice makes it possible to move on product value without dealing with key rotation, refresh tokens, or fine-grained expiration.

## Reconsider if

- **Mobile app** — mobile clients handle Bearer tokens better than session cookies.
- **Public API** — third-party clients need access without a browser.
- **Microservices** — multiple services need to validate identity without sharing a session.
- **External OAuth** — integrating an OAuth2 provider (Google, GitHub) doesn't by itself require JWT: the app can authenticate via OAuth and still keep a classic server session for the rest of the app. The actual driver for JWT is the criteria above (mobile, public API, microservices), not OAuth itself.

Spring Security supports JWT as a resource server (`oauth2ResourceServer`). Business contracts (resource shapes) could stay stable through a migration to JWT, but login/logout/CSRF behavior and the client layer (handling a token instead of a session cookie) would necessarily change — not a transparent migration.

## Date

2026-06-26
