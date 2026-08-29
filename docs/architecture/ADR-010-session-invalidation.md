# ADR-010: Invalidating a user's other sessions — in-memory SessionRegistry, not Spring Session

## Decision

**`SessionRegistry` + `ConcurrentSessionFilter`, backed by Spring Security's default in-memory `SessionRegistryImpl`.** No new infrastructure dependency.

## Context

Password reset needs a capability the project has never had before: after a successful reset, invalidate every other active session for that account (protects against an attacker holding a session open in parallel while the real owner recovers access). The project has no session registry of any kind today — sessions are plain Spring Security `HttpSession`s, tracked only by the servlet container, with no server-side index of "which sessions belong to which user."

**Option A — Spring Session + Redis**
A shared, external session store. Every session becomes a Redis entry, queryable and deletable by key from anywhere, instantly. This is the standard way to get *true* immediate cross-session invalidation, and the natural next step if the app is ever deployed across multiple instances.

**Option B — `SessionRegistry` (Spring Security, in-memory) + `ConcurrentSessionFilter`**
Spring Security's own mechanism for tracking "which sessions belong to which principal," normally used for concurrent-session-limiting (`maximumSessions(1)`, etc.). Repurposed here just for the lookup/invalidate capability, with no cap (`maximumSessions(-1)`). Sessions stay exactly what they are today (plain servlet `HttpSession`s) — the registry is just an in-memory index on top, kept in sync via `RegisterSessionAuthenticationStrategy` (registration) and `HttpSessionEventPublisher` (cleanup on destroy).

## Why Option B

`CLAUDE.md`'s Spring Initializr section already documents that Spring Session was deliberately not selected for the MVP ("Spring Session non sélectionné (Spring Security gère nativement les sessions HttpOnly pour le MVP)") — introducing Redis now, for one feature, on a single-instance deployment, would reverse that decision for a capability Option B provides just as well at this scale. `SessionRegistry` needs no new dependency (already transitively available via `spring-boot-starter-security`) and no new infrastructure to run locally or in prod.

Every controller in this codebase already authenticates programmatically instead of through Spring Security's `formLogin()` filter chain (see ADR-002), which means the pieces that would normally wire themselves up automatically — `RegisterSessionAuthenticationStrategy`, in particular — have to be assembled by hand into `SecurityConfig.sessionAuthenticationStrategy()`, the same way `ChangeSessionIdAuthenticationStrategy` and `CsrfAuthenticationStrategy` already are. Not a new pattern, just one more strategy in the same composite.

The session-concurrency management is configured with no cap (`maximumSessions(-1)` — this is about lookup, not limiting), the shared `SessionRegistry`, and an expired-session strategy that returns the same `ProblemDetail` 401 as the rest of the API rather than the default plain-text 200.

The lookup/invalidate itself takes a real, already-meaningful principal — never a fabricated lookup key — and relies on that principal's `equals()`/`hashCode()` to make `SessionRegistry.getAllSessions()` a single O(1) call returning every session for that user. See `docs/features/auth.md` and `docs/architecture/ADR-013-authentication-identifiers-and-stable-identity.md` for what that principal is today and what its identity is based on — this has changed since this ADR was written, see the addendum below.

## Tradeoff accepted

`SessionInformation.expireNow()` only marks a session as expired in the registry — it does not reach into the servlet container and drop it immediately. The actual invalidation happens lazily, via `ConcurrentSessionFilter`, on that session's *next* request. On a single-instance deployment (the current reality) that's the next HTTP call from that browser tab, not a real-time push — a narrow window exists where a session marked "expired" is still technically usable for one more request. Judged acceptable for the MVP's threat model (this defends against a stale/forgotten session, not an attacker in an active race with the legitimate user).

True instant invalidation would need a session store the server can actively evict from — i.e., Option A. Revisit if: the app moves to multiple instances (which would need Spring Session/Redis anyway, for reasons unrelated to this feature), or a future feature's threat model specifically requires real-time revocation.

`invalidateOtherSessions` has since been promoted into its own `SessionInvalidator`, shared by `PasswordResetService` and the connected-password-change flow — the project's convention of promoting shared logic at the second real consumer, not in anticipation of one.

## Date

2026-08-10

## Addendum (2026-08-27) — the lookup principal changed with ADR-013

At the time this ADR was written, `SessionRegistry.getAllSessions()` was called with a principal built ad hoc for the lookup (a plain Spring Security `User`, equality based on `username` alone) — a "minimal" object that existed only to serve as a key. [ADR-013](ADR-013-authentication-identifiers-and-stable-identity.md) replaced it with `ProustClubPrincipal`, a real session principal whose `equals()`/`hashCode()` are based on the stable `userId` rather than `username`/`email`, and rejected fabricating a lookup-only object in favor of reusing the real principal both actual callers already hold. The mechanism this ADR decided on — `SessionRegistry`, no new infrastructure, O(1) lookup by principal equality — is unchanged; only what that principal *is* moved on. See ADR-013 for the full reasoning.
