# ADR-015: Opaque identifiers for user-owned resources

## Decision

Resources that are privately owned by a user and referenced by the client use opaque, non-predictable identifiers (UUID, `DEFAULT gen_random_uuid()`). Sequential identifiers remain acceptable for publicly shared data and for identifiers that are purely internal and never leave the backend.

Applied now to `quote_selections.id` and `tags.id` (previously `SERIAL`). `users.uuid` already followed this rule since its introduction. `paragraphs.id`, `volumes.id`, `parts.id` stay `SERIAL`/`INTEGER` — they identify shared corpus content, not user-owned data. `password_reset_tokens.id`/`email_verification_tokens.id` stay `BIGSERIAL` — internal database keys that never appear in any API response (only their opaque `token_hash` does).

## Context

`quote_selections.id` and `tags.id` were originally `SERIAL`, deliberately, on the reasoning documented in [data-model.md](data-model.md): ownership is enforced entirely by filtering on `user_id` in every query, and a sequential ID reveals nothing exploitable under that model — no reason to pay UUID's cost (larger index, less locality) for no security benefit.

Options considered when revisiting this:

1. **Keep `SERIAL`, do nothing** — the status quo. No IDOR/BOLA exists today: every repository method filters on `user_id` in the same query, so a guessed ID belonging to another user 404s exactly like a nonexistent one — there's no 404-vs-200 oracle to enumerate other users' resources.
2. **Add a separate `public_id UUID UNIQUE` column, keep `SERIAL` as the internal PK** — exposes the opaque id without touching existing PK/FK/joins.
3. **Migrate `id` itself to UUID** (this decision) — `quote_selections.id`, `tags.id`, and the `quote_selection_tags` junction table's two FK columns all become `UUID DEFAULT gen_random_uuid()`.

## Why not keep `SERIAL` (option 1)

Not chosen because a sequential ID still leaks a metadata signal in the exposed response: creating a resource and seeing `id=18472` tells the client the sequence has reached roughly that value (approximate insertion order/volume), even though it never reveals another user's data. More importantly, it's a fragile invariant, not a proof: the only thing preventing IDOR is that every current and every future query on these tables remembers to filter on `user_id`. A single missing filter in a future endpoint turns an easily-enumerable sequential ID into an immediately exploitable one. This wasn't urgent to fix — no active vulnerability existed — but it was cheap to fix now and expensive to fix later (see below), which is itself the argument for acting on it now rather than leaving it as a permanent theoretical risk.

## Why not the `public_id` column (option 2)

Valid architecture in general (OWASP documents it as a legitimate pattern), but rejected here as unnecessary complexity for this project: it means maintaining two notions of identity per row (internal `id`, external `public_id`), a permanent mapping between them, and a standing risk that a future endpoint accidentally serializes the wrong one. For two small tables with no legacy constraint forcing the internal key to stay a stable integer, migrating `id` itself is simpler to reason about going forward.

## Why UUID PK directly (option 3)

- **No production data to migrate.** The project has no deployed environment yet — no data to preserve, migrating the PK directly is a schema edit, not a backfill.
- **Cheapest possible moment.** Changing a PK type gets substantially more expensive once real rows, foreign keys, backups, and persistent environments exist. Doing it now, before any of that exists, is close to free compared to doing it after launch.
- **Matches the existing `users.uuid` pattern** — one way of doing this in the codebase, not two.

## Tradeoff accepted

- UUID primary keys are larger (16 bytes vs 4) and have worse index locality than a sequential integer — a real but small cost at this project's current and foreseeable scale.
- **A UUID is defense in depth, not a substitute for authorization.** If a future endpoint or repository method omitted the `user_id` filter, that would still be a BOLA (Broken Object Level Authorization) regardless of the ID's format — an attacker who obtains a valid UUID some other way (logs, a shared URL, another endpoint, a leak) could still exploit it. The UUID only removes the ability to *find* a valid ID by blind enumeration of the value space; it does not and cannot replace the `user_id` check. Tests asserting the ownership boundary (cross-user 404s on every mutating endpoint and on the `tagId` query filter) remain the real guarantee against BOLA, not the ID format.
- The migration itself was applied by editing the original `V5__quote_selections_and_tags.sql` migration in place rather than adding a new transitional migration — acceptable only because no environment has this schema applied yet (Flyway checksums would otherwise reject the edited file). Not a precedent for editing historical migrations once an environment exists.

## Date

2026-09-03
