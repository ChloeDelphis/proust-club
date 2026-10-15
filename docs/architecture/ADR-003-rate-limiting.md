# ADR-003: Rate limiting — Bucket4j with local storage

## Decision

Use Bucket4j token buckets backed by bounded Caffeine caches. Login has independent IP and normalized-email buckets. Current limits cover login, registration, search, password-reset request and confirmation, password change, and email-verification resend. Authenticated account actions use the stable user UUID; unauthenticated account buckets use the submitted normalized email.

## Context and rationale

Rate limiting is required for authentication and search. A hand-written limiter would need to implement concurrency, refill, and bounded key lifecycle. Bucket4j provides the algorithm; Caffeine bounds and evicts per-key state. Storage remains process-local for the single-instance MVP.

Independent login IP and email buckets prevent attempts spread across accounts from bypassing one combined key. Email buckets are created for submitted values whether or not an account exists, avoiding account-existence-dependent throttling. No hard account lockout is used because an attacker could lock out another user.

## Behavior

Rejected requests return `429 Too Many Requests`, `Retry-After`, and the standard `ProblemDetail` shape without disclosing which bucket was exhausted. Caches are bounded and expire entries after twice the bucket refill period.

Client IP comes from the servlet request's remote address. Forwarded headers are not trusted without a known proxy that strips and sets them. Revisit IP resolution when a reverse proxy is introduced.

## Trade-off

Limits reset on restart and are not shared across instances. Use a distributed backend only if deployment requires shared limits. A real account lockout remains deliberately out of scope.

## Date

2026-08-02
