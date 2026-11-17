# ADR-019: Send authentication emails after the database commit

## Decision

Authentication mail requests are published during the database transaction and delivered by a Spring `@TransactionalEventListener` after commit. SMTP failures remain best-effort and are logged without recipient addresses or message contents.

## Context

Registration, email confirmation, and password-reset flows create one-time tokens in the database and send a link containing the raw token. Sending synchronously inside the transaction holds a database connection during SMTP and can deliver a link before the corresponding token transaction commits.

## Rationale

After-commit delivery avoids keeping the transaction open for network I/O and ensures emailed links refer to committed token rows. Best-effort delivery preserves the existing product behavior: email confirmation does not block account use, and password-reset requests return the same generic response for known and unknown addresses.

## Trade-off

The event is in-memory, not a durable queue. A process failure after commit or a mail-server failure can lose a notification. Users can request another confirmation or reset email. If automatic delivery retries become a product requirement, replace this delivery path with a transactional outbox.

## Date

2026-11-17
