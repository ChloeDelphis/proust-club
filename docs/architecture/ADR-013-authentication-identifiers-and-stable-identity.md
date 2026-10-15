# ADR-013: Authentication identifiers and stable session identity

## Decision

Keep three concepts separate: `email` is the login credential, `username` is the public display identity, and `users.uuid` is the stable technical identity. Store a project-owned `ProustClubPrincipal` in the session; its equality and hash code use `userId` only.

## Context

Login previously used `username` as both credential and session identity. Changing the credential to email raised the question of which value should identify sessions and authenticated users.

## Rationale

Resolve email inside `AuthenticationManager` through `AuthUserDetailsService`; do not look up the user before authentication. This preserves Spring Security's unknown-user password-encoder mitigation. The identity stored in the principal is the database UUID, not either mutable display or login field.

Using the real principal for `SessionRegistry` lookups lets password-change and reset flows find all sessions by stable user identity. `CurrentUser` reads the UUID from the principal without an extra lookup. Call sites that need the display name use it explicitly; authentication logs avoid exposing email addresses.

## Trade-off

The distinction requires a custom principal and updates to authentication, session invalidation, and account-scoped rate limits. Authenticated account limits use `userId`; unauthenticated login and reset limits use the submitted normalized email because no user identity is resolved yet.

## Date

2026-08-27
