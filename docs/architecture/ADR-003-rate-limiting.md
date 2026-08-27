# ADR-003: Rate limiting — Bucket4j, local in-memory storage

## Decision

**Bucket4j** (token-bucket algorithm) with **local in-memory storage** (Caffeine, bounded and self-evicting) for `POST /api/auth/login`, `POST /api/auth/register`, and `GET /api/search`. Login is protected by two independent buckets — per client IP and per submitted account identifier — rather than a single combined key.

## Context

The project's security baseline asks for rate limiting "from day one" on login, registration, and search. Two implementation paths were considered:

**Option A — Hand-rolled filter** (e.g. a `ConcurrentHashMap<String, ...>` with a manual sliding window)
Zero new dependency. But a rate limiter that looks trivial has to correctly handle concurrency, refill computation, bursts, time windows, clock access, time-to-availability, and bucket lifecycle (eviction) — problems a dedicated, mature library has already solved.

**Option B — Bucket4j**
A concurrent token-bucket implementation covering exactly the above. Chosen for the algorithm itself, not for a future need to scale — the bucket storage stays purely local (Caffeine) for now, independent of whether the app ever runs as more than one instance.

## Why Bucket4j, decoupled from ADR-005

This choice is **independent** of the session-vs-JWT decision in ADR-005. Rate limiting could pair with any combination — local session + local rate limiting, local session + distributed rate limiting, JWT + distributed rate limiting — there's no coupling between the two. A single-instance deployment is not, by itself, an argument against Bucket4j: it works identically well with a local backend as with a distributed one (Redis, Hazelcast, etc.), and the storage backend is swappable later without revisiting the decision to use Bucket4j at all.

## Local storage: Caffeine, not a raw `ConcurrentHashMap`

A `Map` that grows one entry per distinct IP/account ever seen, with no eviction, is itself a memory-exhaustion vector — an attacker sending requests from many source values could grow it unboundedly. Bucket storage is backed by a Caffeine `LoadingCache` per bucket group (login-by-ip, login-by-account, register-by-ip, search-by-ip), each bounded (`maximumSize`) and self-evicting (`expireAfterAccess`, set to twice the bucket's own refill period). No Bucket4j Spring Boot starter, no auto-configuration magic — both libraries (Bucket4j for the algorithm, Caffeine for the keyed storage) are used directly and explicitly.

## Login: two independent buckets, not one combined key

```
login request
     │
     ├── bucket login:<client IP>        must have capacity
     │
     └── bucket login-account:<username>  must have capacity
              │
              ▼
       authentication attempt
```

A single composite key (`login:<ip>:<username>`) would let one IP try five attempts against `alice`, five against `bob`, five against `carol`, and so on — never exhausting a single bucket. OWASP's anti-automation guidance specifically recommends combining IP-based and identity-based throttling for login, rather than relying on either alone. The account bucket is created for **any** submitted username, whether or not the account exists — if it were only created for real accounts, its mere existence (or absence) would become an account-enumeration side channel.

## No hard account lockout

Explicitly not implemented: "N failures → account locked for 24h." A hard lockout lets anyone deny another user access on purpose — precisely the risk OWASP flags for lockout mechanisms. Token-bucket throttling with automatic refill achieves the anti-brute-force goal without that failure mode.

## Response shape

`429 Too Many Requests` with a `Retry-After` header (seconds, rounded up). The body follows the same `ProblemDetail` convention used everywhere else in the API (`detail`/`status`/`title`) rather than a bespoke shape — generic on purpose: no field reveals which bucket (IP vs account) was hit, no remaining-attempts count, no account-existence hint.

## Client IP resolution

`request.getRemoteAddr()` — correct as long as no reverse proxy sits in front of the app (currently the case; no production deployment exists yet). `X-Forwarded-For` and similar headers are never trusted: a client can set that header itself, and without a specific, known, trusted proxy stripping/overwriting it, trusting it would let anyone pick their own rate-limit bucket. Revisit this when a real reverse proxy is introduced.

## Tradeoff accepted

Rate-limit state is lost on application restart, and isn't shared across instances. Acceptable for a single-instance MVP; revisit (Bucket4j supports distributed backends, e.g. Redis) only if and when multiple instances need to share the same limits — not before.

## Date

2026-08-02

## Addendum (2026-08-27)

The login account bucket is keyed by the submitted, normalized **email**, not `username` — the diagrams and prose above predate the switch of the login credential from username to email (see [ADR-013](ADR-013-authentication-identifiers-and-stable-identity.md)). The reasoning in this ADR (two independent buckets, account bucket created for any submitted value whether or not it resolves to a real account) is unchanged, only the identifier itself.
