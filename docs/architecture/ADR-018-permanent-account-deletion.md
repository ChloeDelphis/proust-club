# ADR-018: Permanently delete accounts and private data

## Decision

Account deletion physically removes the account and all private user data. PostgreSQL cascades deletion from `users` to saved quote selections (including comments), tags, quote-tag associations, and authentication tokens. The fixed Proust corpus is retained. The authenticated user must re-enter the current password; all active sessions are invalidated and the current session cookies are cleared.

Security and audit events may include the account UUID when it is needed for traceability, including the deletion event. Logs must never contain email addresses, tokens, passwords, or personal content. Account deletion does not edit or individually purge historic logs; they follow the hosting environment's existing automatic retention and purge policy.

## Rationale

Soft deletion or retaining personal records would leave citations, comments, or tags recoverable after a user requests deletion. These records are private and have no shared-community or billing use in the MVP, so permanent deletion is the simplest policy that matches the feature's promise. Cascading foreign keys keep the data rule explicit and atomic at the database boundary.

## Consequences

- Deletion is irreversible and requires a fresh password check.
- A transaction removes all account-owned rows; public corpus rows are not touched.
- The application logs the deleted account UUID for traceability, without credentials or user content. Existing external log retention is managed by deployment operations; deletion does not reach into log storage.
