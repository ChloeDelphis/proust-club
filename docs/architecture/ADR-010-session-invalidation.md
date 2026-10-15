# ADR-010: Invalidating a user's other sessions

## Decision

Use Spring Security's in-memory `SessionRegistryImpl` and `ConcurrentSessionFilter` to find and expire a user's other sessions. Do not add Spring Session or Redis for the single-instance MVP.

## Context and rationale

Password reset and authenticated password change must invalidate sessions other than the one being established or used. The registry tracks sessions by principal without replacing the existing servlet `HttpSession` storage or adding infrastructure.

Because authentication is established programmatically (ADR-002), `SecurityConfig` explicitly includes `RegisterSessionAuthenticationStrategy` in the session strategy. `HttpSessionEventPublisher` removes registry entries when sessions are destroyed. There is no concurrent-session limit; the filter enforces registry expirations.

The lookup uses a real `ProustClubPrincipal`, whose equality is based on stable `userId` (ADR-013), so sessions for the same account are found together.

## Trade-off

`expireNow()` marks a session expired in the registry; `ConcurrentSessionFilter` invalidates it on its next request. This is not immediate revocation or cross-instance coordination. Revisit if deployment becomes multi-instance or a feature requires immediate invalidation.

## Date

2026-08-10
