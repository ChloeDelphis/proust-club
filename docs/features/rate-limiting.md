# Rate limiting — Technical Design

Token-bucket throttling across most auth endpoints and `GET /api/search`, backed by Bucket4j with local in-memory storage. See [ADR-003](../architecture/ADR-003-rate-limiting.md) for the reasoning behind the library choice, the local-vs-distributed storage decision, and why login uses two independent buckets instead of one combined key.

---

## Buckets

| Endpoint | Bucket(s) | Default limit |
|---|---|---|
| `POST /api/auth/login` | per client IP | 10 attempts / minute |
| `POST /api/auth/login` | per submitted username (normalized) | 5 attempts / 5 minutes |
| `POST /api/auth/register` | per client IP | 5 creations / hour |
| `GET /api/search` | per client IP | 60 requests / minute |
| `POST /api/auth/password-reset/request` | per client IP | 5 requests / hour |
| `POST /api/auth/password-reset/request` | per submitted email (normalized) | 3 requests / 15 minutes |
| `POST /api/auth/password-reset/confirm` | per client IP | 5 attempts / hour |
| `POST /api/auth/password` (change password) | per account (authenticated) | 5 attempts / 15 minutes |
| `POST /api/auth/email/confirm/resend` | per account (authenticated) | 3 requests / 15 minutes |

`password-reset/confirm` has no account bucket (the account isn't known until the token is resolved) and `password` (change) / `email/confirm/resend` have no IP bucket (both already require an authenticated session, so an anonymous IP-based bucket adds nothing a session cookie doesn't already gate) — same "no bucket that adds nothing" reasoning applied per endpoint, not a uniform IP+account pair everywhere. `password-reset/confirm` specifically got a bucket once it started being able to trigger a real outbound HTTP call (the compromised-password check, see [ADR-011](../architecture/ADR-011-compromised-password-check.md)) — before that it only did cheap local DB work and needed none.

Configurable under `rate-limit.*` in `application.yml` — never hardcoded scattered across controllers:

```yaml
rate-limit:
  login:
    per-ip:      { capacity: 10, refill-period: 1m }
    per-account: { capacity: 5,  refill-period: 5m }
  register:
    per-ip: { capacity: 5, refill-period: 1h }
  search:
    per-ip: { capacity: 60, refill-period: 1m }
  password-reset:
    per-ip:      { capacity: 5, refill-period: 1h }
    per-account: { capacity: 3, refill-period: 15m }
  password-reset-confirm:
    per-ip: { capacity: 5, refill-period: 1h }
  password-change:
    per-account: { capacity: 5, refill-period: 15m }
  email-verification-resend:
    per-account: { capacity: 3, refill-period: 15m }
```

Login checks **both** buckets before attempting authentication — either one being exhausted rejects the request. This is deliberate: a single IP-only limit lets an attacker distribute attempts across many IPs against one account; a single combined `ip+username` key lets one IP try many different accounts without ever tripping a per-IP limit. Two independent buckets close both gaps. The account bucket is keyed by the submitted username whether or not that account exists, so its behavior never reveals account existence.

---

## Storage

`RateLimiter` (`com.proustclub.ratelimit`) holds one Caffeine `LoadingCache<String, Bucket>` per bucket group above. Each cache is bounded (`maximumSize`) and self-evicting (`expireAfterAccess`, twice the bucket's refill period) — an unbounded map keyed by arbitrary client-supplied values (IP, username) would itself be a memory-exhaustion vector.

---

## Response on exceeding a limit

`429 Too Many Requests`, `Retry-After` header (seconds, rounded up so the client never sees "0s" and retries immediately into another rejection), body via the same `ProblemDetail` shape used by every other error in this API. No field in the response reveals which bucket was hit or how many attempts remain — that information has no legitimate client use and only helps an attacker calibrate.

---

## Client IP

`ClientIp.resolve(request)` currently just returns `request.getRemoteAddr()`. There is no reverse proxy in front of the app yet. `X-Forwarded-For` (or similar) is **not** read — a client can set that header itself, and trusting it without a specific, known proxy stripping/overwriting it would let anyone choose their own bucket. Revisit when a real proxy is introduced.

---

## Logging

Only on exceeding a limit, never per consumed token (that itself would be a log-flooding vector):

```
WARN rate_limit_exceeded endpoint=login keyType=ip
```

`endpoint`/`keyType` only — never the IP/username value beyond what the existing logging policy already allows, never the password.

---

## What this deliberately does not do

- **No hard account lockout.** A fixed "N failures → locked for 24h" rule would let anyone lock another user out on purpose. Token-bucket throttling with automatic refill avoids that failure mode.
- **No distributed storage (Redis, etc.).** Not needed for a single instance; would only be revisited if multiple instances ever need to share the same limits — a separate decision from choosing Bucket4j itself (see ADR-003).

---

## Manual verification

- Make more than the configured number of registrations from the same machine within the window → `429` with `Retry-After`.
- Same for login (per-IP) and search.
- Attempt login against the same username from several different source IPs → the account-level limit trips even though no single IP limit does.
- Log in successfully, then keep searching past the search limit from the same IP → still `429` (an authenticated session is not exempt).
- Make more than the configured number of `password-reset/confirm` attempts from the same IP within the window (regardless of token validity) → `429` with `Retry-After`.
- Wait past the refill window → requests succeed again without restarting the app.
