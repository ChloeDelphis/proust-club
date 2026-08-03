# Rate limiting — Technical Design

Token-bucket throttling on `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/search`, backed by Bucket4j with local in-memory storage. See [ADR-003](../architecture/ADR-003-rate-limiting.md) for the reasoning behind the library choice, the local-vs-distributed storage decision, and why login uses two independent buckets instead of one combined key.

---

## Buckets

| Endpoint | Bucket(s) | Default limit |
|---|---|---|
| `POST /api/auth/login` | per client IP | 10 attempts / minute |
| `POST /api/auth/login` | per submitted username (normalized) | 5 attempts / 5 minutes |
| `POST /api/auth/register` | per client IP | 5 creations / hour |
| `GET /api/search` | per client IP | 60 requests / minute |

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
- Wait past the refill window → requests succeed again without restarting the app.
