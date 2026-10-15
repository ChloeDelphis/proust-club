# ADR-015: Opaque identifiers for user-owned resources

## Decision

Use UUIDs for privately owned resources whose identifiers are exposed to the client. Keep sequential identifiers for shared corpus data and database keys that never leave the backend.

Applied to `quote_selections.id` and `tags.id`; their junction-table foreign keys are UUIDs too. `users.uuid` already follows this rule. Corpus IDs remain sequential, as do internal token-table primary keys.

## Context and rationale

Ownership checks filter by `user_id` and remain the authorization boundary. Opaque identifiers reduce blind enumeration and avoid exposing insertion-order metadata; they do not prevent BOLA if a future query omits its ownership check.

A separate `public_id` would preserve integer primary keys but require maintaining two identities and consistently exposing the correct one. These tables have no production data or legacy constraint, so migrating the primary keys directly is simpler while the change is still cheap.

## Trade-off

UUID indexes use more space and have lower locality than sequential integer indexes. This cost is small at the project's scale. Existing cross-user authorization tests, not UUID format, protect ownership boundaries.

The original V5 migration was edited in place because no environment had applied it. Do not edit historical migrations after an environment depends on their Flyway checksums.

## Date

2026-09-03
